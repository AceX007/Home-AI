import { EventEmitter } from 'node:events'
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { homedir } from 'node:os'
import { writeFile, mkdir, readFile, rename, unlink, rm } from 'node:fs/promises'
import type { DesignCreateArgs, DesignIR, DesignListItem, DesignPatchEnvelope, FileEntry, TaskBoard, TaskCard, ToolCall, ToolResult } from '@homeai/core'
import { chunkCode } from '@homeai/rag'
import type { RagStore } from '@homeai/rag'
import type { TsIntelligence } from '@homeai/ts-intel'
import type { NodeDebugHost } from '@homeai/debug'
import {
  explore,
  gitLog,
  gitDiff,
  gitSnapshot,
  gitWorktreeAdd,
  gitWorktreeList,
  type IgnoreSet,
  assertInside,
  jailPath,
  applyDesignPatch,
  applyDtcgToIr,
  designTokenRel,
  defaultDesignIR,
  validateDesignIR,
  thinkRel,
  thinkSlug,
  validateThinkMarkdown,
  parseThinkFront,
  takeWorkspaceRel,
  designSlug,
  designRel,
  slugFromBrief,
  seedDesignIR,
  DEFAULT_DESIGN_SLUG,
  ragWriteRel,
  compileGrepRe,
  publicGrepHits,
  designGetContent,
  runCompute,
  extractHtml,
  looksLikeHtml,
  listNotes,
  writeNoteFile,
  listCalendar,
  upsertCalendar,
  inboxOcr,
  inboxStt,
  speak,
  parseTaskCall,
  runSubagentJobs,
  urlAllowed,
  loadPermissions,
  WEB_SEARCH_ENDPOINT,
  composePerceivePack,
  sessionHits,
  designThinkMarkdown,
  impactBeforeEdit,
  lspQuery,
  takeDapEvidence,
  dapEvidenceRel,
  gitImpactHunks,
  designMeshRoute,
  designFidelityReport,
  chromeDevtoolsDepth,
  acpWorktreeName,
  sceneIrJail,
  hitlStep,
  dnaScaffoldFromRecipes,
  dnaArtifactAllowed,
  mergeGraphHits,
  graphRel,
  takeStructuralGraph,
  buildStructuralGraph,
  queryGraph
} from '@homeai/runtime'

const SKIP = new Set(['node_modules', '.git', 'out', 'dist', 'vendor', 'cursor_3.17.21_amd64'])
const GRAPH_ROOTS = ['packages', 'apps'] as const
const GRAPH_SKIP = new Set(['node_modules', '.git', 'out', 'dist', 'vendor', 'data', 'AI Resources', 'Repos', 'cursor_3.17.21_amd64'])
const GRAPH_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.jsx'])
let workspaceGraph: ReturnType<typeof takeStructuralGraph> | null = null
let graphBuiltFor = ''

export interface BrowserHost {
  navigate: (url: string) => Promise<void>
  extract: () => Promise<{ url: string; title: string; text: string; saved: string }>
  click: (selector: string) => Promise<string>
  type: (selector: string, text: string) => Promise<string>
  screenshot: () => Promise<string>
  console: (persist?: boolean) => Promise<string>
}

export interface ToolHost {
  ignore?: IgnoreSet
  tsIntel?: TsIntelligence
  debug?: NodeDebugHost
  askUser?: (prompt: string, options?: string[]) => Promise<string>
  browser?: BrowserHost
  extraRoots?: string[]
  netAllowlist?: string[]
  unrestricted?: boolean
  depth?: number
  mode?: string
  nestedForge?: (job: { name: string; kind: string; query: string; path: string }) => Promise<ToolResult>
}

export { assertInside }

function collectGraphFiles(root: string): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = []
  const walk = (dir: string) => {
    if (out.length >= 64) return
    let names: string[] = []
    try {
      names = readdirSync(dir)
    } catch {
      return
    }
    for (const name of names) {
      if (GRAPH_SKIP.has(name) || name === 'AI Resources') continue
      const abs = join(dir, name)
      let st
      try {
        st = statSync(abs)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        walk(abs)
        continue
      }
      if (!GRAPH_EXT.has(extname(name))) continue
      const rel = relative(root, abs).replace(/\\/g, '/')
      if (!rel || rel.includes('..') || rel.startsWith('/') || rel.includes('AI Resources')) continue
      let text = ''
      try {
        text = readFileSync(abs, 'utf8').slice(0, 24_000)
      } catch {
        continue
      }
      out.push({ path: rel, text })
      if (out.length >= 64) return
    }
  }
  for (const name of GRAPH_ROOTS) {
    const abs = join(root, name)
    if (!existsSync(abs)) continue
    walk(abs)
  }
  return out
}

export function loadWorkspaceGraph(root: string): ReturnType<typeof takeStructuralGraph> {
  if (workspaceGraph && graphBuiltFor === root) return workspaceGraph
  try {
    const dest = assertInside(root, graphRel())
    if (existsSync(dest)) {
      workspaceGraph = takeStructuralGraph(JSON.parse(readFileSync(dest, 'utf8')))
      graphBuiltFor = root
      return workspaceGraph
    }
  } catch {
    /* empty graph */
  }
  workspaceGraph = takeStructuralGraph({ nodes: [] })
  graphBuiltFor = root
  return workspaceGraph
}

export function refreshWorkspaceGraph(root: string, force = false): ReturnType<typeof takeStructuralGraph> {
  if (!force && graphBuiltFor === root && workspaceGraph) return workspaceGraph
  const graph = buildStructuralGraph(collectGraphFiles(root))
  workspaceGraph = graph
  graphBuiltFor = root
  try {
    const dest = assertInside(root, graphRel())
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, JSON.stringify(graph) + '\n', 'utf8')
  } catch {
    /* graph file is optional */
  }
  return graph
}

function assertAgentUrl(root: string, host: ToolHost, url: string): void {
  if (!/^https?:\/\//i.test(url)) throw new Error('url must be http(s)')
  if (host.unrestricted) return
  const allow = host.netAllowlist ?? loadPermissions(root).netAllowlist
  if (!urlAllowed(url, allow)) throw new Error('url not allowed')
}

export function editablePath(root: string, path: string, extraRoots?: string[], rootId?: unknown): string {
  const j = jailPath(root, path, extraRoots, rootId)
  if (!j.extra) {
    const rel = relative(resolve(root), j.path).replace(/\\/g, '/')
    if (!takeWorkspaceRel(rel)) throw new Error('bad path')
  }
  if (j.path.replace(/\\/g, '/').includes('/data/secrets')) throw new Error('bad path')
  return j.path
}

export async function mkdirSafe(root: string, path: string): Promise<string> {
  const p = editablePath(root, path)
  await mkdir(p, { recursive: true })
  return p
}

export async function renameSafe(root: string, from: string, to: string): Promise<string> {
  const a = editablePath(root, from)
  const b = editablePath(root, to)
  if (existsSync(b)) throw new Error('exists')
  await rename(a, b)
  return b
}

export async function removeSafe(root: string, path: string): Promise<boolean> {
  const p = editablePath(root, path)
  const st = statSync(p)
  if (st.isDirectory()) {
    if (readdirSync(p).length) throw new Error('dir not empty')
    await rm(p)
  } else {
    await unlink(p)
  }
  return true
}

export async function listDir(
  root: string,
  path: string,
  extraRoots?: string[],
  rootId?: unknown
): Promise<FileEntry[]> {
  const dir = jailPath(root, path || '.', extraRoots, rootId).path
  if (!existsSync(dir)) return []
  const names = readdirSync(dir).filter((n) => n !== '.git')
  const entries: FileEntry[] = []
  for (const name of names) {
    if (name.endsWith('.gguf')) continue
    if (SKIP.has(name) && name !== 'RAG') continue
    const p = join(dir, name)
    try {
      const st = statSync(p)
      entries.push({ name, path: p, dir: st.isDirectory(), size: st.size })
    } catch {
      /* skip */
    }
  }
  entries.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name))
  return entries
}

export function readFileSafe(root: string, path: string): string {
  const p = assertInside(root, path)
  const st = statSync(p)
  if (st.size > 2_000_000) throw new Error('file too large')
  return readFileSync(p, 'utf8')
}

export async function writeFileSafe(
  root: string,
  path: string,
  content: string,
  extraRoots?: string[],
  rootId?: unknown
): Promise<void> {
  const p = editablePath(root, path, extraRoots, rootId)
  await mkdir(dirname(p), { recursive: true })
  await writeFile(p, content, 'utf8')
}

function runCmd(cwd: string, command: string, args: string[], timeoutMs = 30_000): Promise<string> {
  return new Promise((resolveP, reject) => {
    const child = spawn(command, args, { cwd, env: process.env })
    let out = ''
    const t = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('timeout'))
    }, timeoutMs)
    child.stdout?.on('data', (d) => {
      out += String(d)
      if (out.length > 80_000) out = out.slice(-40_000)
    })
    child.stderr?.on('data', (d) => {
      out += String(d)
    })
    child.on('error', (e) => {
      clearTimeout(t)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(t)
      resolveP((out || `(exit ${code})`).slice(0, 40_000))
    })
  })
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DS::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DS::/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`)
}

function globWalk(root: string, dir: string, pattern: string, hits: string[], cap: number, ignore?: IgnoreSet): string[] {
  const re = globToRegExp(pattern.replace(/^\.\//, ''))
  const walk = (d: string) => {
    if (hits.length >= cap) return
    let names: string[] = []
    try {
      names = readdirSync(d)
    } catch {
      return
    }
    for (const name of names) {
      if (SKIP.has(name) || name.startsWith('.')) continue
      const p = join(d, name)
      if (ignore?.ignoredPath(root, p)) continue
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      const rel = relative(root, p).replace(/\\/g, '/')
      if (st.isDirectory()) walk(p)
      else if (re.test(rel) || re.test(name)) hits.push(rel)
    }
  }
  walk(dir)
  return hits
}

function grepWalk(root: string, dir: string, re: RegExp, globExt: string | null, hits: string[], cap: number, ignore?: IgnoreSet): void {
  if (hits.length >= cap) return
  let names: string[] = []
  try {
    names = readdirSync(dir)
  } catch {
    return
  }
  for (const name of names) {
    if (SKIP.has(name) || name.startsWith('.')) continue
    const p = join(dir, name)
    if (ignore?.ignoredPath(root, p)) continue
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) grepWalk(root, p, re, globExt, hits, cap, ignore)
    else if (st.isFile() && st.size < 800_000) {
      if (globExt && extname(p) !== globExt) continue
      try {
        const text = readFileSync(p, 'utf8')
        const lines = text.split('\n')
        lines.forEach((line, i) => {
          if (hits.length >= cap) return
          if (re.test(line)) hits.push(`${relative(root, p)}:${i + 1}:${line.slice(0, 200)}`)
        })
      } catch {
        /* binary */
      }
    }
  }
}

export function workspaceGrep(root: string, query: string, ignore?: IgnoreSet): Array<{ path: string; line: number; text: string }> {
  const re = compileGrepRe(query)
  if (!re) return []
  const hits: string[] = []
  grepWalk(root, root, re, null, hits, 80, ignore)
  return publicGrepHits(hits)
}

export function loadBoard(root: string): TaskBoard {
  const p = join(root, 'taskboards', 'default.json')
  if (!existsSync(p)) {
    return {
      id: 'default',
      title: 'Workbench',
      columns: [
        { id: 'backlog', title: 'Backlog' },
        { id: 'doing', title: 'Doing' },
        { id: 'review', title: 'Review' },
        { id: 'done', title: 'Done' }
      ],
      cards: []
    }
  }
  return JSON.parse(readFileSync(p, 'utf8')) as TaskBoard
}

export function saveBoard(root: string, board: TaskBoard): void {
  const p = join(root, 'taskboards', 'default.json')
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(board, null, 2), 'utf8')
}

export function upsertTask(root: string, args: { id?: string; title: string; column?: string; body?: string }): TaskBoard {
  const board = loadBoard(root)
  const column = (args.column as TaskCard['column']) || 'backlog'
  if (args.id) {
    const card = board.cards.find((c) => c.id === args.id)
    if (card) {
      card.title = args.title || card.title
      if (args.body != null) card.body = args.body
      if (args.column) card.column = column
    }
  } else {
    board.cards.push({
      id: `t_${Date.now()}`,
      title: args.title,
      body: args.body ?? '',
      column,
      createdAt: Date.now()
    })
  }
  saveBoard(root, board)
  return board
}

export const designEvents = new EventEmitter()

const activeDesign = new Map<string, string>()

export function activeDesignSlug(root: string): string {
  return activeDesign.get(root) || DEFAULT_DESIGN_SLUG
}

export function setActiveDesignSlug(root: string, slug: string): string {
  const id = designSlug(slug)
  activeDesign.set(root, id)
  return id
}

function uniqueSlug(root: string, base: string): string {
  const s = designSlug(base)
  for (let i = 0; i < 40; i++) {
    const cand = i === 0 ? s : `${s.slice(0, 32)}-${i + 1}`
    try {
      designSlug(cand)
    } catch {
      continue
    }
    const abs = assertInside(root, designRel(cand))
    if (!existsSync(abs)) return cand
  }
  return designSlug(`draft-${Date.now().toString(36).slice(-8)}`)
}

function emitDesign(slug: string, revision: string): void {
  designEvents.emit('changed', { slug, revision })
}

function takeCreateArgs(raw: unknown): DesignCreateArgs {
  const a = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    brief: typeof a.brief === 'string' ? a.brief.slice(0, 2000) : '',
    template: typeof a.template === 'string' ? a.template.slice(0, 40) : 'blank',
    name: typeof a.name === 'string' ? a.name.slice(0, 80) : undefined,
    slug: typeof a.slug === 'string' ? a.slug : undefined
  }
}

export function loadDesign(root: string, slug?: string): DesignIR {
  const id = setActiveDesignSlug(root, slug || activeDesignSlug(root))
  const dest = assertInside(root, designRel(id))
  if (!existsSync(dest)) {
    if (id === DEFAULT_DESIGN_SLUG) return defaultDesignIR() as DesignIR
    throw new Error(`missing design ${id}`)
  }
  try {
    const raw = JSON.parse(readFileSync(dest, 'utf8')) as unknown
    const v = validateDesignIR(raw)
    if (!v.ok) {
      if (id === DEFAULT_DESIGN_SLUG) return defaultDesignIR() as DesignIR
      throw new Error(`invalid design ${id}`)
    }
    return raw as DesignIR
  } catch (err) {
    if (err instanceof Error && (err.message.startsWith('invalid') || err.message.startsWith('missing'))) throw err
    if (id === DEFAULT_DESIGN_SLUG) return defaultDesignIR() as DesignIR
    throw err instanceof Error ? err : new Error('bad design')
  }
}

export function patchDesign(root: string, envelope: DesignPatchEnvelope, slug?: string): DesignIR {
  const id = setActiveDesignSlug(root, slug || activeDesignSlug(root))
  const cur = loadDesign(root, id)
  const { doc } = applyDesignPatch(cur, envelope)
  const dest = assertInside(root, designRel(id))
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, JSON.stringify(doc, null, 2) + '\n', 'utf8')
  emitDesign(id, String(doc.revision))
  return doc as DesignIR
}

export function createDesign(root: string, raw?: unknown): { slug: string; doc: DesignIR; thinkPath?: string } {
  const args = takeCreateArgs(raw)
  const brief = String(args.brief || '').replace(/[<>]/g, '').slice(0, 2000)
  const wanted = args.slug ? designSlug(args.slug) : slugFromBrief(brief || args.name)
  const slug = uniqueSlug(root, wanted)
  const doc = seedDesignIR({ slug, brief, template: args.template, name: args.name })
  const v = validateDesignIR(doc)
  if (!v.ok) throw new Error(v.errors.join(', '))
  const dest = assertInside(root, designRel(slug))
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, JSON.stringify(doc, null, 2) + '\n', 'utf8')
  setActiveDesignSlug(root, slug)
  emitDesign(slug, doc.revision)
  const handoff = designThinkMarkdown({ slug, title: brief.slice(0, 80) || slug })
  if (handoff.ok) {
    try {
      const thinkDest = assertInside(root, handoff.rel)
      mkdirSync(dirname(thinkDest), { recursive: true })
      writeFileSync(thinkDest, handoff.markdown, 'utf8')
    } catch {
      /* design still created */
    }
  }
  return { slug, doc: doc as DesignIR, thinkPath: handoff.ok ? handoff.rel : '' }
}

export function listDesigns(root: string): DesignListItem[] {
  const dir = assertInside(root, 'designs')
  if (!existsSync(dir)) return []
  const out: DesignListItem[] = []
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.design.json')) continue
    let slug: string
    try {
      slug = designSlug(name.slice(0, -'.design.json'.length))
    } catch {
      continue
    }
    try {
      const abs = assertInside(root, designRel(slug))
      const st = statSync(abs)
      if (st.size > 2 * 1024 * 1024) continue
      const raw = JSON.parse(readFileSync(abs, 'utf8')) as DesignIR
      const v = validateDesignIR(raw)
      if (!v.ok) continue
      const label =
        typeof raw.artifact?.name === 'string' ? raw.artifact.name.replace(/[<>]/g, '').slice(0, 80) : slug
      out.push({ slug, name: label || slug, revision: raw.revision, mtime: st.mtimeMs })
    } catch {
      continue
    }
    if (out.length >= 64) break
  }
  return out.sort((a, b) => b.mtime - a.mtime)
}

export function ingestDesignTokens(root: string, rel?: string, slug?: string): { doc: DesignIR; applied: string[]; skipped: string[] } {
  const posix = designTokenRel(rel)
  const abs = assertInside(root, posix)
  if (!existsSync(abs)) throw new Error(`missing ${posix}`)
  const st = statSync(abs)
  if (st.size > 256 * 1024) throw new Error('token file too large')
  const dtcg = JSON.parse(readFileSync(abs, 'utf8')) as unknown
  const id = setActiveDesignSlug(root, slug || activeDesignSlug(root))
  const cur = loadDesign(root, id)
  const { doc, applied, skipped } = applyDtcgToIr(cur, dtcg, posix)
  const dest = assertInside(root, designRel(id))
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, JSON.stringify(doc, null, 2) + '\n', 'utf8')
  emitDesign(id, String(doc.revision))
  return { doc: doc as DesignIR, applied, skipped }
}

function readCapped(root: string, rel: string, max: number): string {
  try {
    const p = assertInside(root, rel)
    if (!existsSync(p)) return ''
    return readFileSync(p, 'utf8').slice(0, max)
  } catch {
    return ''
  }
}

export function libraryPack(root: string): string {
  return [
    readCapped(root, 'RAG/library/STATUS.md', 700),
    readCapped(root, 'RAG/library/ROADMAP.md', 1200),
    readCapped(root, 'RAG/recipes/INDEX.md', 700),
    readCapped(root, 'data/bug-memory/anti-patterns.md', 1400)
  ]
    .filter(Boolean)
    .join('\n---\n')
    .slice(0, 4000)
}

export async function gitPack(root: string): Promise<string> {
  try {
    const snap = await gitSnapshot(root)
    const diff = await gitDiff(root)
    return `branch ${snap.branch ?? '?'}\n${snap.porcelain.slice(0, 600)}\n${diff.slice(0, 2000)}`.slice(0, 2800)
  } catch (err) {
    return `(no git) ${err instanceof Error ? err.message : String(err)}`
  }
}

export async function perceivePack(
  root: string,
  rag: RagStore | null,
  task: string,
  extra?: {
    fleet?: string
    graphMcp?: boolean
    sessionText?: string
    graphHits?: Array<{ symbol?: string; path?: string }>
    debug?: string
  }
): Promise<string> {
  const hits = rag?.search(task, 6) ?? []
  const ragHits = hits.map((h) => ({
    path: String(h.path ?? ''),
    kind: String(h.kind ?? ''),
    snippet: String(h.snippet ?? '').slice(0, 180)
  }))
  let map: { nodes: Array<{ title?: string; id?: string }>; edges: unknown[] } = { nodes: [], edges: [] }
  let qa: Array<{ verdict?: string; prompt?: string }> = []
  try {
    map = rag?.getMap() ?? map
    qa = rag?.listQa() ?? []
  } catch {
    /* empty grounds */
  }
  const lib = libraryPack(root)
  const git = await gitPack(root)
  const ftsGraph = hits
    .filter((h) => h.kind === 'code' || h.symbol)
    .slice(0, 6)
    .map((h) => ({ symbol: String(h.symbol || h.path || '') }))
  const analogHits = queryGraph(loadWorkspaceGraph(root), task).map((h) => ({ symbol: h.symbol, path: h.path }))
  return composePerceivePack({
    library: lib,
    git,
    ragHits,
    map,
    qa,
    graphHits: mergeGraphHits(ftsGraph, [...(extra?.graphHits ?? []), ...analogHits]),
    sessionHits: sessionHits(hits),
    sessionText: extra?.sessionText,
    fleet: extra?.fleet,
    graphMcp: extra?.graphMcp ? 'codebase-memory pack-gated' : '',
    debug: extra?.debug || ''
  })
}

export function listThinkDocs(root: string): Array<{ path: string; title: string; status: string; mtime: number; files: string[] }> {
  const dir = join(root, 'RAG', 'plans')
  if (!existsSync(dir)) return []
  const out: Array<{ path: string; title: string; status: string; mtime: number; files: string[] }> = []
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.think.md')) continue
    const rel = `RAG/plans/${name}`
    const abs = join(dir, name)
    let title = name
    let status = ''
    let files: string[] = []
    try {
      const fm = parseThinkFront(readFileSync(abs, 'utf8'))
      title = fm.title || name
      status = fm.status
      files = Array.isArray(fm.files) ? fm.files.slice(0, 12) : []
    } catch {
      /* skip */
    }
    let mtime = 0
    try {
      mtime = statSync(abs).mtimeMs
    } catch {
      mtime = 0
    }
    out.push({ path: rel, title, status, mtime, files })
  }
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, 20)
}

export function loadThinkDoc(root: string, rel: string): { path: string; markdown: string; parsed: ReturnType<typeof validateThinkMarkdown> } {
  const posix = String(rel || '').replace(/\\/g, '/')
  if (!posix.startsWith('RAG/plans/') || !posix.endsWith('.think.md') || posix.includes('..')) {
    throw new Error('think doc must be RAG/plans/*.think.md')
  }
  const abs = assertInside(root, posix)
  const markdown = readFileSync(abs, 'utf8')
  return { path: posix, markdown, parsed: validateThinkMarkdown(markdown) }
}

export async function runTool(
  root: string,
  rag: RagStore,
  call: ToolCall,
  host: ToolHost = {}
): Promise<ToolResult> {
  const name = call.name
  const a = call.arguments
  try {
    switch (name) {
      case 'fs_read': {
        const j = jailPath(root, String(a.path ?? ''), host.extraRoots, a.root)
        if (host.ignore?.ignoredPath(root, j.path)) return { ok: false, name, content: `ignored: ${a.path}` }
        const st = statSync(j.path)
        if (st.size > 2_000_000) throw new Error('file too large')
        const content = readFileSync(j.path, 'utf8')
        return { ok: true, name, content: content.slice(0, 20_000) }
      }
      case 'fs_write': {
        const p = editablePath(root, String(a.path ?? ''), host.extraRoots, a.root)
        if (host.ignore?.ignoredPath(root, p)) return { ok: false, name, content: `ignored: ${a.path}` }
        let before = ''
        try {
          before = readFileSync(p, 'utf8')
        } catch {
          before = ''
        }
        await writeFileSafe(root, String(a.path ?? ''), String(a.content ?? ''), host.extraRoots, a.root)
        return {
          ok: true,
          name,
          content: `wrote ${a.path}`,
          extra: { path: p, before, after: String(a.content ?? '') }
        }
      }
      case 'fs_list': {
        const entries = await listDir(root, String(a.path ?? '.'), host.extraRoots, a.root)
        const visible = host.ignore ? entries.filter((e) => !host.ignore!.ignoredPath(root, e.path)) : entries
        return { ok: true, name, content: visible.map((e) => `${e.dir ? 'd' : 'f'} ${e.name}`).join('\n') }
      }
      case 'grep': {
        const re = compileGrepRe(a.pattern)
        if (!re) return { ok: false, name, content: 'bad pattern' }
        const start = a.path ? assertInside(root, String(a.path)) : root
        const glob = a.glob ? String(a.glob) : null
        const ext = glob?.startsWith('*.') ? glob.slice(1) : glob
        const hits: string[] = []
        grepWalk(root, start, re, ext, hits, 80, host.ignore)
        return { ok: true, name, content: hits.join('\n') || '(no matches)' }
      }
      case 'glob': {
        const pattern = String(a.pattern ?? '**/*')
        const hits = globWalk(root, root, pattern, [], 200, host.ignore)
        return { ok: true, name, content: hits.join('\n') || '(no files)' }
      }
      case 'str_replace': {
        const p = editablePath(root, String(a.path ?? ''), host.extraRoots, a.root)
        if (host.ignore?.ignoredPath(root, p)) return { ok: false, name, content: `ignored: ${a.path}` }
        const old = String(a.old_string ?? '')
        const neu = String(a.new_string ?? '')
        const text = readFileSync(p, 'utf8')
        const n = text.split(old).length - 1
        if (n === 0) throw new Error('old_string not found')
        if (n > 1) throw new Error(`old_string found ${n} times — must be unique`)
        const after = text.replace(old, neu)
        writeFileSync(p, after, 'utf8')
        const rel = relative(resolve(root), p).replace(/\\/g, '/')
        const impact =
          !rel || rel.includes('..') ? { warn: false, fanIn: 0 } : impactBeforeEdit(loadWorkspaceGraph(root), rel)
        return {
          ok: true,
          name,
          content: impact.warn ? `patched ${a.path} · impact fan-in ${impact.fanIn}` : `patched ${a.path}`,
          extra: { path: p, before: text, after }
        }
      }
      case 'rag_search': {
        const q = String(a.query ?? '')
        const hits = rag.search(q, Number(a.limit ?? 8))
        const who = queryGraph(loadWorkspaceGraph(root), q)
          .map((h) => {
            const callers = h.callers.filter((p) => p && !p.includes('..') && !p.startsWith('AI Resources')).slice(0, 8)
            return callers.length ? `who-calls ${h.path} ← ${callers.join(', ')}` : ''
          })
          .filter(Boolean)
          .slice(0, 4)
        const body = hits.map((h) => `${h.path} ${h.symbol ?? ''}\n${h.snippet}`).join('\n---\n') || '(empty)'
        return { ok: true, name, content: who.length ? `${body}\n${who.join('\n')}` : body }
      }
      case 'rag_write': {
        const dest = ragWriteRel(a.folder, a.name)
        if (!dest) throw new Error('bad folder')
        await writeFileSafe(root, dest, String(a.content ?? ''))
        return { ok: true, name, content: `wrote ${dest}` }
      }
      case 'git_status': {
        const content = await runCmd(root, 'git', ['status', '-sb'])
        return { ok: true, name, content }
      }
      case 'git_diff': {
        const args = a.staged ? ['diff', '--cached'] : ['diff']
        const content = await runCmd(root, 'git', args)
        const hunks = gitImpactHunks(content, loadWorkspaceGraph(root))
        const impact = hunks.filter((h) => h.warn).map((h) => h.path).slice(0, 8)
        const note = impact.length ? `\nimpact ${impact.join(', ')}` : ''
        return { ok: true, name, content: (content || '(clean)') + note }
      }
      case 'terminal_run': {
        const command = String(a.command ?? '')
        if (!command) throw new Error('empty command')
        const content = await runCmd(root, 'bash', ['-lc', command], Number(a.timeoutMs ?? 30_000))
        return { ok: true, name, content }
      }
      case 'http_fetch': {
        const url = String(a.url ?? '')
        assertAgentUrl(root, host, url)
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
        const text = await res.text()
        const ctype = res.headers.get('content-type') || ''
        const body = looksLikeHtml(text, ctype) ? extractHtml(text, url) : text.slice(0, 12_000)
        return { ok: true, name, content: `status ${res.status}\n${body}` }
      }
      case 'code_outline': {
        const p = assertInside(root, String(a.path ?? ''))
        if (host.ignore?.ignoredPath(root, p)) return { ok: false, name, content: `ignored: ${a.path}` }
        const text = readFileSync(p, 'utf8')
        const chunks = chunkCode(text, p)
        if (host.tsIntel && ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'].includes(extname(p))) {
          host.tsIntel.update(p, text)
          const kind = String(a.kind ?? 'symbols')
          if (kind === 'diagnostics') {
            const rows = host.tsIntel.diagnostics({ path: p })
            return {
              ok: true,
              name,
              content: rows.map((row) => `${row.severity} TS${row.code} L${row.startLine}:${row.startColumn} ${row.message}`).join('\n') || '(none)'
            }
          }
          if (kind === 'refs') {
            const rows = host.tsIntel.symbols({ path: p }).slice(0, 12).map((row) => {
              const refs = host.tsIntel?.references({ path: p, line: row.startLine, column: row.startColumn }) || []
              return `${row.name} ${refs.length}`
            })
            return { ok: true, name, content: rows.join('\n') || '(none)' }
          }
          if (kind === 'hover') {
            const line = Math.max(1, Number(a.line) || 1)
            const column = Math.max(1, Number(a.column) || 1)
            const row = host.tsIntel.hover({ path: p, line, column })
            return { ok: true, name, content: row ? `${row.display}\n${row.documentation}`.trim() : '(none)' }
          }
          const rows = host.tsIntel.symbols({ path: p })
          return {
            ok: true,
            name,
            content: rows.map((row) => `${row.kind} ${row.name} L${row.startLine}`).join('\n') || '(none)'
          }
        }
        const lsp = lspQuery(text, String(a.path ?? ''), String(a.kind ?? 'symbols'))
        const rows = lsp.ok && lsp.rows.length ? lsp.rows.map((r) => String(r.symbol || r.message || '')).filter(Boolean) : chunks.map((c) => c.symbol)
        return { ok: true, name, content: rows.join('\n') || '(none)' }
      }
      case 'test_run': {
        const kind = String(a.kind ?? 'auto')
        let content = ''
        if (kind === 'pytest' || (kind === 'auto' && existsSync(join(root, 'pytest.ini')))) {
          content = await runCmd(root, 'bash', ['-lc', 'pytest -q'], 60_000)
        } else {
          content = await runCmd(root, 'bash', ['-lc', 'npm test --silent'], 60_000)
        }
        const ev = takeDapEvidence({
          hypothesis: 'test_run',
          stack: content.split('\n').slice(0, 6).join(' | '),
          frames: content.split('\n').slice(0, 8),
          runId: 'test'
        })
        if (ev) {
          try {
            const dest = assertInside(root, dapEvidenceRel('test'))
            mkdirSync(dirname(dest), { recursive: true })
            writeFileSync(dest, JSON.stringify(ev) + '\n', 'utf8')
          } catch {
            /* test output still returned */
          }
        }
        host.debug?.noteTestFailure(content)
        return { ok: true, name, content }
      }
      case 'tasks_update': {
        const board = upsertTask(root, {
          id: a.id ? String(a.id) : undefined,
          title: String(a.title ?? 'task'),
          column: a.column ? String(a.column) : undefined,
          body: a.body ? String(a.body) : undefined
        })
        return { ok: true, name, content: JSON.stringify(board.cards.slice(-5)) }
      }
      case 'ask_user': {
        if (!host.askUser) return { ok: false, name, content: 'ask_user unavailable' }
        const delayMs = Number(a.delayMs ?? a.ms)
        const hitl = hitlStep({
          action: Number.isFinite(delayMs) && delayMs > 0 ? 'delay' : 'approve',
          ms: delayMs,
          reason: String(a.prompt ?? '')
        })
        const answer = await host.askUser(
          hitl.reason,
          Array.isArray(a.options) ? a.options.map(String) : undefined
        )
        const waitNote = hitl.wait ? `hitl delay ${hitl.ms}ms · ` : ''
        return { ok: true, name, content: waitNote + answer }
      }
      case 'explore': {
        const out = explore(root, String(a.query ?? ''), host.ignore)
        return { ok: true, name, content: out.summary }
      }
      case 'debug_log': {
        const dir = join(root, 'data', 'debug')
        mkdirSync(dir, { recursive: true })
        const line = JSON.stringify({
          at: new Date().toISOString(),
          hypothesis: String(a.hypothesis ?? ''),
          evidence: String(a.evidence ?? '')
        })
        appendFileSync(join(dir, 'session.jsonl'), line + '\n', 'utf8')
        const ev = takeDapEvidence({
          hypothesis: a.hypothesis,
          stack: a.evidence,
          runId: 'session'
        })
        if (ev) {
          try {
            const dest = assertInside(root, dapEvidenceRel('session'))
            writeFileSync(dest, JSON.stringify(ev) + '\n', 'utf8')
          } catch {
            /* jsonl still landed */
          }
        }
        return { ok: true, name, content: 'logged' }
      }
      case 'debug_start': {
        if (!host.debug) return { ok: false, name, content: 'debug host offline' }
        const snap = await host.debug.start(a)
        return { ok: true, name, content: host.debug.perceiveLine() || snap.status }
      }
      case 'debug_breakpoint': {
        if (!host.debug) return { ok: false, name, content: 'debug host offline' }
        await host.debug.breakpoint(a)
        return { ok: true, name, content: 'breakpoint' }
      }
      case 'debug_stack': {
        if (!host.debug) return { ok: false, name, content: 'debug host offline' }
        const snap = await host.debug.stack()
        const frames = snap.frames.map((row) => `${row.name} ${row.path}:${row.line}`).join('\n')
        const locals = snap.locals.map((row) => `${row.name}=${row.value}`).join(' ')
        return { ok: true, name, content: `${snap.status}\n${frames}\n${locals}`.slice(0, 1200) || '(none)' }
      }
      case 'debug_evaluate': {
        if (!host.debug) return { ok: false, name, content: 'debug host offline' }
        const value = await host.debug.evaluate(a)
        return { ok: true, name, content: value }
      }
      case 'debug_continue': {
        if (!host.debug) return { ok: false, name, content: 'debug host offline' }
        const snap = await host.debug.continue(a)
        return { ok: true, name, content: snap.status }
      }
      case 'debug_stop': {
        if (!host.debug) return { ok: false, name, content: 'debug host offline' }
        const snap = await host.debug.stop()
        return { ok: true, name, content: snap.status }
      }
      case 'browser_navigate': {
        if (!host.browser) return { ok: false, name, content: 'browser offline' }
        await host.browser.navigate(String(a.url ?? ''))
        return { ok: true, name, content: `navigated ${a.url}` }
      }
      case 'browser_extract': {
        if (!host.browser) return { ok: false, name, content: 'browser offline' }
        const cap = await host.browser.extract()
        const ax = [cap.title, ...cap.text.split('\n').map((l) => l.trim()).filter(Boolean)].slice(0, 12)
        const som = ax.slice(0, 8).map((l, i) => `${i + 1}:${l}`)
        const scene = sceneIrJail({
          id: 'browser',
          ax,
          som,
          ocr: cap.text,
          approval: 'ask'
        })
        if (scene) {
          try {
            const dest = assertInside(root, scene.rel)
            mkdirSync(dirname(dest), { recursive: true })
            writeFileSync(dest, JSON.stringify(scene.scene) + '\n', 'utf8')
          } catch {
            /* extract still returned */
          }
        }
        return { ok: true, name, content: `${cap.title}\n${cap.url}\n${cap.text.slice(0, 8000)}` }
      }
      case 'browser_click': {
        if (!host.browser) return { ok: false, name, content: 'browser offline' }
        const msg = await host.browser.click(String(a.selector ?? ''))
        return { ok: true, name, content: msg }
      }
      case 'browser_type': {
        if (!host.browser) return { ok: false, name, content: 'browser offline' }
        const msg = await host.browser.type(String(a.selector ?? ''), String(a.text ?? ''))
        return { ok: true, name, content: msg }
      }
      case 'browser_screenshot': {
        if (!host.browser) return { ok: false, name, content: 'browser offline' }
        const path = await host.browser.screenshot()
        return { ok: true, name, content: path }
      }
      case 'browser_console': {
        if (!host.browser) return { ok: false, name, content: 'browser offline' }
        const content = await host.browser.console(true)
        const depth = chromeDevtoolsDepth('console') ? ' · devtools analog' : ''
        return { ok: true, name, content: content + depth }
      }
      case 'git_log': {
        const content = await gitLog(root, Number(a.n ?? 12))
        return { ok: true, name, content }
      }
      case 'git_worktree': {
        const action = String(a.action ?? 'list')
        if (action === 'add') {
          const content = await gitWorktreeAdd(root, acpWorktreeName(a.name ?? `wt_${Date.now()}`))
          return { ok: true, name, content }
        }
        return { ok: true, name, content: await gitWorktreeList(root) }
      }
      case 'web_search': {
        const q = encodeURIComponent(String(a.query ?? ''))
        const url = `${WEB_SEARCH_ENDPOINT}?q=${q}`
        assertAgentUrl(root, host, url)
        const res = await fetch(url, {
          signal: AbortSignal.timeout(12_000),
          headers: { 'User-Agent': 'HomeAI/0.1' }
        })
        const html = await res.text()
        const titles = [...html.matchAll(/class="result__a"[^>]*>([^<]+)/g)].map((m) => m[1])
        const urls = [...html.matchAll(/class="result__url"[^>]*>([^<]+)/g)].map((m) => m[1].trim())
        const lines = titles.slice(0, 8).map((t, i) => `- ${t} · ${urls[i] ?? ''}`)
        return { ok: true, name, content: lines.join('\n') || html.replace(/<[^>]+>/g, ' ').slice(0, 3000) }
      }
      case 'design_get': {
        const slug = a.id != null && String(a.id) !== '' ? String(a.id) : undefined
        const doc = loadDesign(root, slug)
        return { ok: true, name, content: designGetContent(doc) }
      }
      case 'design_patch': {
        const slug = a.id != null && String(a.id) !== '' ? String(a.id) : undefined
        const envelope = {
          baseRevision: a.baseRevision ? String(a.baseRevision) : undefined,
          intentId: a.intentId ? String(a.intentId) : 'agent',
          scope: Array.isArray(a.scope) ? a.scope.map(String) : undefined,
          patch: a.patch,
          _raw: typeof a._raw === 'string' ? a._raw.slice(0, 8000) : undefined
        }
        const doc = patchDesign(root, envelope as DesignPatchEnvelope, slug)
        const mesh = designMeshRoute(String(a.intentId || a.note || 'patch'))
        const fid = designFidelityReport({ revision: envelope.baseRevision }, doc, String(a.intentId || a.note || 'patch'))
        return { ok: true, name, content: `revision ${doc.revision} · mesh ${mesh} · ${fid}` }
      }
      case 'design_ingest_tokens': {
        const slug = a.id != null && String(a.id) !== '' ? String(a.id) : undefined
        const { doc, applied, skipped } = ingestDesignTokens(root, a.path ? String(a.path) : undefined, slug)
        return {
          ok: true,
          name,
          content: `revision ${doc.revision} · ${applied.join(', ')}${skipped.length ? ` · skipped ${skipped.length}` : ''}`
        }
      }
      case 'library_pack': {
        return { ok: true, name, content: libraryPack(root) || '(no library)' }
      }
      case 'git_pack': {
        return { ok: true, name, content: await gitPack(root) }
      }
      case 'plan_write': {
        const rawName = String(a.name ?? 'handoff')
        if (/^dna-/i.test(rawName) || a.kind === 'dna') {
          const slugs = Array.isArray(a.recipes) ? a.recipes.map(String) : [rawName.replace(/^dna-/i, '')]
          const recipeDocs = slugs
            .map((value) => thinkSlug(value))
            .filter(Boolean)
            .slice(0, 8)
            .map((slug) => ({ slug, markdown: readCapped(root, `RAG/recipes/${slug}.md`, 4000) }))
          const dna = dnaScaffoldFromRecipes(slugs, libraryPack(root).slice(0, 80), recipeDocs)
          if (!dna.ok || !dna.files.length) return { ok: false, name, content: 'dna plan denied' }
          const wrote: string[] = []
          const dnaSlug = thinkSlug(slugs[0] ?? 'dna')
          for (const file of dna.files) {
            if (!dnaArtifactAllowed(file.rel, dnaSlug)) {
              return { ok: false, name, content: 'dna plan denied' }
            }
            await writeFileSafe(root, file.rel, file.body)
            wrote.push(file.rel)
          }
          return { ok: true, name, content: `wrote ${wrote.join(' ')}` }
        }
        const rel = thinkRel(rawName)
        const body = String(a.content ?? '')
        const v = validateThinkMarkdown(body)
        if (!v.ok) return { ok: false, name, content: `think doc invalid: ${v.errors.join(', ')}` }
        await writeFileSafe(root, rel, body)
        return { ok: true, name, content: `wrote ${rel} · ${v.status} · ${v.files.length} files` }
      }
      case 'task': {
        if (host.depth) return { ok: false, name, content: 'nested task denied' }
        const think = host.mode === 'think'
        const jobs = parseTaskCall(a, { think })
        const content = await runSubagentJobs(
          jobs,
          (child) => runTool(root, rag, child, { ...host, depth: (host.depth ?? 0) + 1, nestedForge: undefined }),
          { nestedForge: think ? undefined : host.nestedForge, think }
        )
        return { ok: true, name, content }
      }
      case 'compute_run': {
        const content = await runCompute(root, {
          runtime: String(a.runtime ?? 'python'),
          code: String(a.code ?? ''),
          timeoutMs: Number(a.timeoutMs ?? 8000)
        })
        return { ok: true, name, content }
      }
      case 'notes_list': {
        return { ok: true, name, content: JSON.stringify(listNotes(root)).slice(0, 8000) }
      }
      case 'notes_write': {
        const rel = writeNoteFile(root, a.name, a.content)
        return { ok: true, name, content: `wrote ${rel}` }
      }
      case 'calendar_list': {
        return { ok: true, name, content: JSON.stringify(listCalendar(root)) }
      }
      case 'calendar_upsert': {
        const rel = upsertCalendar(root, a.name, a)
        return { ok: true, name, content: `wrote ${rel}` }
      }
      case 'web_extract': {
        const url = String(a.url ?? '')
        assertAgentUrl(root, host, url)
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
        const html = await res.text()
        return { ok: true, name, content: extractHtml(html, url) }
      }
      case 'inbox_ocr': {
        const content = await inboxOcr(root, String(a.path ?? ''))
        return { ok: true, name, content }
      }
      case 'inbox_stt': {
        const content = await inboxStt(root, String(a.path ?? ''))
        return { ok: true, name, content }
      }
      case 'speak': {
        const content = await speak(root, String(a.text ?? ''))
        return { ok: true, name, content }
      }
      default:
        return { ok: false, name, content: `unknown tool ${name}` }
    }
  } catch (err) {
    return { ok: false, name, content: err instanceof Error ? err.message : String(err) }
  }
}

export function quickOpen(root: string, query: string, limit = 40): string[] {
  const hits: string[] = []
  globWalk(root, root, '**/*', hits, 2500, undefined)
  const q = query.toLowerCase().trim()
  if (!q) return hits.slice(0, limit)
  return hits
    .map((p) => {
      const n = p.toLowerCase()
      const base = n.split('/').pop() ?? n
      let score = 0
      if (base === q) score = 100
      else if (base.startsWith(q)) score = 80
      else if (base.includes(q)) score = 60
      else if (n.includes(q)) score = 30
      return { p, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p)
}

export function gitBranch(root: string): string | undefined {
  try {
    const head = readFileSync(join(root, '.git', 'HEAD'), 'utf8').trim()
    if (head.startsWith('ref:')) return head.split('/').pop()
    return head.slice(0, 8)
  } catch {
    return undefined
  }
}

export function expandHome(p: string): string {
  if (p.startsWith('~/')) return join(homedir(), p.slice(2))
  return p
}

export { readFile }

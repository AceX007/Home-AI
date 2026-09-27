/** Hex 2028 compiler-OS helpers. Backends/shape only — never unjail, never foreign UI. */

import { thinkRel, thinkSlug, validateThinkMarkdown } from './think.mjs'
import { designRel, designSlug } from './design-path.mjs'
import { MCP_STARTER_IDS } from './mcp-packs.mjs'
import { harvestRow, starterForbidden, COMPILER_OS_PORTS } from './resource-harvest.mjs'
import { sanitizeMcpRule } from './policy.mjs'
import { toolCallName, workflowId } from './activity.mjs'
import { parseSkillFrontMatter } from './front-matter.mjs'

const SURFACES = new Set(['desktop', 'telegram', 'miniapp'])
const PORT_KINDS = new Set(['analog', 'port', 'next'])
const MESH = new Set(['specialist', 'deterministic', 'frontier'])
const DAP_KEYS = new Set(['hypothesis', 'stack', 'frames', 'runId'])
const RECIPE_STACKS = new Set(['electron', 'web', 'api', 'mobile', 'any'])
const CAPABILITY_PROFILES = new Set(['web-cli', 'web-cli-api'])
const CAPABILITY_PORTS = new Set(['web', 'api', 'desktop', 'mobile', 'worker', 'cli'])

const kernelRuns = new Map()

export function bugMemoryDirName() {
  return 'bug-memory'
}

export function ragIngestAllowed(rel) {
  const n = String(rel || '').replace(/\\/g, '/')
  if (!n || n.includes('\0') || n.includes('..')) return false
  if (n.includes('/data/secrets/') || n.startsWith('data/secrets/')) return false
  if (n.includes('/data/')) {
    return n.includes('/data/bug-memory/') || n.startsWith('data/bug-memory/')
  }
  if (n.startsWith('data/') && !n.startsWith('data/bug-memory/')) return false
  return true
}

export function needsPerceivePack(mode) {
  return mode === 'think' || mode === 'agent' || mode === 'debug' || mode === 'plan' || mode === 'multitask'
}

function jailToken(raw, fallback) {
  const s = String(raw || fallback || 'x')
    .replace(/\.\./g, '')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .replace(/^\.+/, '')
    .slice(0, 40)
  return s || fallback || 'x'
}

function stripLine(s, max) {
  return String(s ?? '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function composePerceivePack(parts) {
  const p = parts && typeof parts === 'object' && !Array.isArray(parts) ? parts : {}
  const lib = stripLine(p.library, 4000)
  const git = stripLine(p.git, 2800)
  const hits = Array.isArray(p.ragHits) ? p.ragHits : []
  const ragBits =
    hits
      .slice(0, 6)
      .map((h) => {
        const path = stripLine(h && h.path, 160)
        if (!path || path.includes('..')) return ''
        const kind = stripLine(h.kind, 24)
        const snip = stripLine(h.snippet, 180)
        return `- ${path}${kind ? ` (${kind})` : ''}: ${snip}`
      })
      .filter(Boolean)
      .join('\n') || '(none)'
  const nodes = Array.isArray(p.map?.nodes) ? p.map.nodes : Array.isArray(p.mapNodes) ? p.mapNodes : []
  const mapBits =
    nodes
      .slice(0, 8)
      .map((n) => stripLine(n && (n.title || n.id), 60))
      .filter(Boolean)
      .join('; ') || '(none)'
  const qa = Array.isArray(p.qa) ? p.qa : []
  const qaBits =
    qa
      .slice(0, 4)
      .map((q) => `${stripLine(q.verdict, 24)}: ${stripLine(q.prompt, 80)}`)
      .filter((x) => x.length > 2)
      .join('\n') || '(none)'
  const graph = Array.isArray(p.graphHits) ? p.graphHits : []
  const graphBits =
    graph
      .slice(0, 6)
      .map((g) => stripLine(g && (g.symbol || g.path), 80))
      .filter(Boolean)
      .join(', ') || '(none)'
  const graphNote = stripLine(p.graphMcp, 80)
  const sess = Array.isArray(p.sessionHits) ? p.sessionHits : sessionHits(hits)
  const sessionBits =
    sess
      .slice(0, 6)
      .map((h) => stripLine(h && (h.path || h.kind), 80))
      .filter((x) => x && !x.includes('..'))
      .join('; ') || ''
  const sessionText = stripLine(p.sessionText, 400)
  const sessionBody = [sessionBits, sessionText].filter(Boolean).join('\n') || '(none)'
  const fleet = stripLine(p.fleet, 200)
  const debug = stripLine(p.debug, 400)
  return [
    'PERCEIVE PACK (already gathered — do not repeat these calls)',
    `## Library + APs\n${lib || '(none)'}`,
    `## Git\n${git || '(none)'}`,
    `## RAG\n${ragBits}`,
    `## Maps\n${mapBits}`,
    `## QA\n${qaBits}`,
    `## Graph\n${graphBits}${graphNote ? `\n${graphNote}` : ''}`,
    `## Session\n${sessionBody}`,
    `## Fleet\n${fleet || '(none)'}`,
    `## Debug\n${debug || '(none)'}`
  ].join('\n')
}

export function fleetReceiptLine(snap) {
  const o = snap && typeof snap === 'object' && !Array.isArray(snap) ? snap : {}
  const repos = Array.isArray(o.repos) ? o.repos : []
  const bots = Array.isArray(o.bots) ? o.bots : []
  const live = repos.filter((r) => r && r.running === true).length
  return stripLine(`fleet · repos ${repos.length} · bots ${bots.length} · live ${live}`, 120)
}

export function promoteRel(stamp) {
  return `RAG/discoveries/${jailToken(stamp, 'x')}.promote.md`
}

export function promoteDiscovery(input) {
  const o = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const task = stripLine(o.task, 80)
  const text = stripLine(o.text, 400)
  const tools = Array.isArray(o.tools) ? o.tools.map((t) => stripLine(t, 80)).filter(Boolean) : []
  const stamp = jailToken(o.stamp, 'promote')
  const rel = promoteRel(stamp || 'promote')
  if (rel.includes('..') || /[<>]/.test(task + text)) {
    return { apply: false, kind: 'skip', slug: '', rel: '', body: '' }
  }
  const hay = `${task} ${text} ${tools.join(' ')}`.toLowerCase()
  let kind = 'recipe'
  if (/\b(xss|idor|path|jail|secret|allowlist)\b/.test(hay)) kind = 'anti-pattern'
  if (!task || tools.length < 1) kind = 'skip'
  const slug = thinkSlug(task || 'discovery').slice(0, 40)
  const body =
    kind === 'skip'
      ? ''
      : [
          '---',
          `kind: ${kind}`,
          `slug: ${slug}`,
          'apply: ask',
          '---',
          '',
          `# Promote ${slug}`,
          '',
          `Task: ${task}`,
          '',
          '## Tools',
          tools.slice(0, 12).join('\n') || '(none)',
          '',
          'Ask the operator before writing RAG/recipes or data/bug-memory.'
        ].join('\n')
  return { apply: false, kind, slug, rel, body }
}

export function starterTrustRules(serverIds) {
  const ids = Array.isArray(serverIds) ? serverIds : MCP_STARTER_IDS
  const out = []
  const forbidden = starterForbidden().map((x) => String(x).toLowerCase())
  for (const id of ids) {
    const s = String(id || '').trim()
    if (!s || s === '__proto__') continue
    if (forbidden.some((f) => s.toLowerCase().includes(f))) continue
    if (!MCP_STARTER_IDS.includes(s)) continue
    const rule = sanitizeMcpRule(`${s}:*`)
    if (rule) out.push(rule)
  }
  return out
}

export function mergeStarterAllowlist(existing, serverIds) {
  const next = []
  const seen = new Set()
  for (const x of [...(Array.isArray(existing) ? existing : []), ...starterTrustRules(serverIds)]) {
    const rule = sanitizeMcpRule(String(x || ''))
    if (!rule || seen.has(rule)) continue
    seen.add(rule)
    next.push(rule)
    if (next.length >= 64) break
  }
  return next
}

export function designThinkRel(slug) {
  return thinkRel(`design-${designSlug(slug)}`)
}

export function designThinkMarkdown(opts) {
  const o = opts && typeof opts === 'object' ? opts : {}
  const slug = designSlug(o.slug || 'handoff')
  const title = stripLine(o.title || slug, 80) || slug
  const file = designRel(slug)
  const md = `---
title: ${title}
status: ready
files: ${file}
---

## Goal
Compile DesignIR ${slug} into product code.

## Map
${file}

## Edges
Do not copy foreign UI. Typed patches only.

## Edits
Implement from the IR; surgical str_replace.

## Verify
npm test

## Out of scope
Cassowary. GitHub design-sync.
`
  const v = validateThinkMarkdown(md)
  return { ok: v.ok, errors: v.errors, rel: designThinkRel(slug), markdown: md, slug, file }
}

export function registerKernelRun(id, source, abort) {
  const rid = workflowId(id) || `wf_${toolCallName(id) || 'run'}`
  const src = SURFACES.has(source) ? source : 'desktop'
  kernelRuns.set(rid, { source: src, abort: typeof abort === 'function' ? abort : null })
  return rid
}

export function stopKernelRun(id) {
  const rid = workflowId(id) || `wf_${toolCallName(id) || ''}`
  const row = kernelRuns.get(rid)
  if (!row) return false
  try {
    row.abort?.()
  } catch {
    /* already dead */
  }
  kernelRuns.delete(rid)
  return true
}

export function kernelRunOwner(id) {
  const rid = workflowId(id) || `wf_${toolCallName(id) || ''}`
  return kernelRuns.get(rid)?.source || ''
}

export function forgetKernelRun(id) {
  const rid = workflowId(id) || `wf_${toolCallName(id) || ''}`
  return kernelRuns.delete(rid)
}

export function resetKernelRuns() {
  kernelRuns.clear()
}

export function kernelRunCount() {
  return kernelRuns.size
}

export function kernelSurface(raw) {
  return SURFACES.has(raw) ? raw : 'desktop'
}

export function scanDiscoveryDrafts(names) {
  const list = Array.isArray(names) ? names : []
  const out = []
  for (const n of list) {
    const s = String(n || '')
    if (s.includes('..') || s.includes('/') || s.includes('\\')) continue
    if (!/^[A-Za-z0-9._-]{1,80}\.(promote|skill)\.md$/.test(s)) continue
    out.push(s)
    if (out.length >= 24) break
  }
  return out
}

export function bootCurate(names, existing) {
  const drafts = scanDiscoveryDrafts(names)
  if (drafts.some((n) => n.endsWith('.skill.md'))) return { apply: false, slug: '', body: '' }
  const promotes = drafts.filter((n) => n.endsWith('.promote.md'))
  if (promotes.length < 2) return { apply: false, slug: '', body: '' }
  return curateSkillProposal({
    discoveries: ['verify ok', 'prevent shipped'],
    task: 'overnight curator',
    existing
  })
}

export function mergeGraphHits(fts, mcp) {
  const out = []
  const seen = new Set()
  const add = (h) => {
    const symbol = stripLine(h && (h.symbol || h.path), 80)
    if (!symbol || symbol.includes('..') || seen.has(symbol)) return
    seen.add(symbol)
    out.push({ symbol })
  }
  for (const h of Array.isArray(fts) ? fts : []) add(h)
  for (const h of Array.isArray(mcp) ? mcp : []) add(h)
  return out.slice(0, 8)
}

export function freezeToolList(defs) {
  const list = Array.isArray(defs) ? defs : []
  const names = []
  const frozen = []
  for (const t of list) {
    const name = toolCallName(t && t.name)
    if (!name || name.includes('..') || name === '__proto__') continue
    if (names.includes(name)) continue
    names.push(name)
    frozen.push(t)
    if (frozen.length >= 48) break
  }
  return { names: Object.freeze([...names]), defs: frozen, hash: names.join('|') }
}

export function filterFrozenTools(frozen, next) {
  const allow = new Set(frozen && Array.isArray(frozen.names) ? frozen.names : [])
  const list = Array.isArray(next) ? next : []
  return list.filter((t) => allow.has(toolCallName(t && t.name) || ''))
}

export function parseStructuralIndex(text, path) {
  const rel = stripLine(path, 200)
  if (!rel || rel.includes('..') || rel.startsWith('/') || rel.includes('AI Resources')) return { path: '', symbols: [], imports: [] }
  const src = String(text || '')
  const symbols = []
  const re = /(?:export\s+)?(?:async\s+)?(?:function|class|const|let)\s+([A-Za-z_][\w]*)/g
  let m
  while ((m = re.exec(src))) {
    symbols.push(m[1])
    if (symbols.length >= 40) break
  }
  const imports = []
  const ire = /from\s+['"](\.[^'"]+)['"]/g
  while ((m = ire.exec(src))) {
    const p = stripLine(m[1], 160)
    if (p && !p.includes('..')) imports.push(p)
    if (imports.length >= 24) break
  }
  return { path: rel, symbols, imports }
}

export function impactBeforeEdit(index, path) {
  const rel = stripLine(path, 200)
  const nodes = Array.isArray(index?.nodes) ? index.nodes : []
  const node = nodes.find((n) => n && n.path === rel) || null
  const callers = Array.isArray(node?.callers) ? node.callers.map((c) => stripLine(c, 80)).filter(Boolean) : []
  const fanIn = callers.length
  return { warn: fanIn >= 3, fanIn, callers: callers.slice(0, 8), path: rel }
}

export function curateSkillProposal(input) {
  const o = input && typeof input === 'object' ? input : {}
  const discoveries = Array.isArray(o.discoveries) ? o.discoveries : []
  const existing = Array.isArray(o.existing) ? o.existing.map((s) => String(s)) : []
  const verified = discoveries.filter((d) => /verify|ok |prevent/i.test(String(d))).length
  if (verified < 2) return { apply: false, slug: '', body: '' }
  const slug = thinkSlug(o.task || 'learned-loop').slice(0, 40)
  if (existing.includes(slug)) return { apply: false, slug, body: '' }
  return {
    apply: false,
    slug,
    body: `---\nname: ${slug}\n---\n\n# ${slug}\n\nLearned from verified ships. Ask before install.\n`
  }
}

export function harnessRel() {
  return '.homeai/harness.json'
}

export function takeHarness(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const own = (k) => Object.prototype.hasOwnProperty.call(raw, k)
  const out = Object.create(null)
  if (own('stack')) out.stack = stripLine(raw.stack, 40)
  if (own('statusPhase')) out.statusPhase = stripLine(raw.statusPhase, 24)
  if (own('evolve')) out.evolve = raw.evolve === true
  if (own('skills') && Array.isArray(raw.skills)) {
    out.skills = raw.skills.map((s) => stripLine(s, 40)).filter(Boolean).slice(0, 24)
  }
  if (own('mcpAllowlist') && Array.isArray(raw.mcpAllowlist)) {
    out.mcpAllowlist = mergeStarterAllowlist(raw.mcpAllowlist, MCP_STARTER_IDS)
  }
  if (own('verifyOk')) out.verifyOk = raw.verifyOk !== false
  if (own('localOk')) out.localOk = raw.localOk !== false
  if (own('hasSidecar')) out.hasSidecar = raw.hasSidecar === true
  return out
}

export function mintHarness(fingerprint, extra) {
  const fp = fingerprint && typeof fingerprint === 'object' ? fingerprint : {}
  const extraObj = extra && typeof extra === 'object' ? extra : {}
  const payload = {
    stack: fp.stack || 'electron',
    skills: Array.isArray(fp.skills) ? fp.skills : ['explore-first'],
    mcpAllowlist: extraObj.mcpAllowlist,
    statusPhase: fp.statusPhase || '4/5',
    evolve: extraObj.evolve === true && extraObj.approvalMode === 'auto-review'
  }
  const own = (k) => Object.prototype.hasOwnProperty.call(extraObj, k)
  if (own('verifyOk')) payload.verifyOk = extraObj.verifyOk
  if (own('localOk')) payload.localOk = extraObj.localOk
  if (own('hasSidecar')) payload.hasSidecar = extraObj.hasSidecar
  const taken = takeHarness(payload)
  return { rel: harnessRel(), harness: taken, evolve: taken.evolve === true }
}

export function graphRel() {
  return '.homeai/graph.json'
}

export function takeStructuralGraph(raw) {
  const own = raw && typeof raw === 'object' && !Array.isArray(raw) && Object.prototype.hasOwnProperty.call(raw, 'nodes')
  const nodesIn = own && Array.isArray(raw.nodes) ? raw.nodes : []
  const nodes = []
  for (const n of nodesIn) {
    const path = stripLine(n && n.path, 200)
    if (!path || path.includes('..') || path.startsWith('/') || path.includes('AI Resources')) continue
    const symbols = Array.isArray(n.symbols)
      ? n.symbols.map((s) => stripLine(s, 80)).filter(Boolean).slice(0, 40)
      : []
    const imports = Array.isArray(n.imports)
      ? n.imports.map((s) => stripLine(s, 160)).filter((p) => p && !p.includes('..')).slice(0, 24)
      : []
    const callers = Array.isArray(n.callers)
      ? n.callers.map((s) => stripLine(s, 200)).filter((p) => p && !p.includes('..') && !p.includes('AI Resources')).slice(0, 8)
      : []
    nodes.push({ path, symbols, imports, callers })
    if (nodes.length >= 80) break
  }
  return { nodes }
}

export function buildStructuralGraph(files) {
  const parsed = []
  const list = Array.isArray(files) ? files : []
  for (const f of list) {
    const idx = parseStructuralIndex(f && f.text, f && f.path)
    if (!idx.path) continue
    parsed.push({ path: idx.path, symbols: idx.symbols, imports: idx.imports, callers: [] })
    if (parsed.length >= 80) break
  }
  for (const a of parsed) {
    for (const b of parsed) {
      if (a.path === b.path) continue
      for (const imp of a.imports) {
        const base = stripLine(String(imp).replace(/^\.\//, ''), 160)
        if (!base || base.includes('..')) continue
        if (b.path.endsWith(base) || b.path.endsWith(`${base}.ts`) || b.path.endsWith(`${base}.js`) || b.path.endsWith(`${base}.mjs`)) {
          if (!b.callers.includes(a.path) && b.callers.length < 8) b.callers.push(a.path)
        }
      }
    }
  }
  return takeStructuralGraph({ nodes: parsed })
}

export function queryGraph(graph, query) {
  const q = stripLine(query, 80).toLowerCase()
  if (!q || q.includes('..')) return []
  const nodes =
    graph && typeof graph === 'object' && !Array.isArray(graph) && Object.prototype.hasOwnProperty.call(graph, 'nodes') && Array.isArray(graph.nodes)
      ? graph.nodes
      : []
  const hits = []
  for (const n of nodes) {
    const path = stripLine(n && n.path, 200)
    if (!path || path.includes('..') || path.includes('AI Resources')) continue
    const symbols = Array.isArray(n.symbols) ? n.symbols : []
    const match = symbols.find((s) => String(s).toLowerCase().includes(q)) || (path.toLowerCase().includes(q) ? path : '')
    if (!match) continue
    const callers = Array.isArray(n.callers)
      ? n.callers.map((c) => stripLine(c, 80)).filter((p) => p && !p.includes('..') && !p.includes('AI Resources')).slice(0, 8)
      : []
    hits.push({ path, symbol: stripLine(match, 80), callers })
    if (hits.length >= 8) break
  }
  return hits
}

export function designFidelityReport(before, after, task) {
  const mesh = designMeshRoute(task)
  const b = before && typeof before === 'object' ? before : {}
  const a = after && typeof after === 'object' ? after : {}
  return stripLine(`fidelity mesh ${mesh} revision ${stripLine(b.revision, 24) || '0'}→${stripLine(a.revision, 24) || '0'}`, 160)
}

export function lspQuery(text, path, kind) {
  const idx = parseStructuralIndex(text, path)
  if (!idx.path) return { ok: false, kind: 'symbols', rows: [] }
  if (kind === 'refs') {
    const src = String(text || '')
    const rows = idx.symbols
      .slice(0, 12)
      .map((sym) => ({ symbol: sym, count: src.split(sym).length - 1 }))
      .filter((r) => r.count > 0)
    return { ok: true, kind: 'refs', rows }
  }
  if (kind === 'diagnostics') {
    const src = String(text || '')
    const open = (src.match(/\{/g) || []).length
    const close = (src.match(/\}/g) || []).length
    const rows = []
    if (open !== close) rows.push({ code: 'brace', message: 'unmatched braces' })
    return { ok: true, kind: 'diagnostics', rows }
  }
  return { ok: true, kind: 'symbols', rows: idx.symbols.map((symbol) => ({ symbol })) }
}

export function takeDapEvidence(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out = Object.create(null)
  for (const k of DAP_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, k)) continue
    if (k === 'frames' && Array.isArray(raw.frames)) {
      out.frames = raw.frames.map((f) => stripLine(f, 120)).filter(Boolean).slice(0, 16)
    } else {
      out[k] = stripLine(raw[k], 240)
    }
  }
  if (out.stack && (out.stack.includes('..') || out.stack.includes('/etc/'))) return null
  return out
}

export function dapEvidenceRel(id) {
  return `data/debug/${jailToken(id, 'session')}.evidence.json`
}

export function gitImpactHunks(diff, index) {
  const text = String(diff || '')
  const paths = [...text.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm)].map((m) => stripLine(m[2], 200)).filter(Boolean)
  const nodes = Array.isArray(index?.nodes) ? index.nodes : []
  return paths.slice(0, 24).map((path) => {
    const hit = impactBeforeEdit({ nodes }, path)
    return { path, fanIn: hit.fanIn, warn: hit.warn, callers: hit.callers }
  })
}

export function chromeDevtoolsDepth(name) {
  const n = String(name || '').toLowerCase()
  if (!n || n.includes('desktopcommander') || n.includes('gitmcp') || n.includes('scrapegraph')) return false
  return /console|screenshot|performance|tracing|network|coverage/.test(n)
}

export function designMeshRoute(task) {
  const t = String(task || '').toLowerCase()
  if (/\b(new page|concept|brand|narrative|campaign)\b/.test(t)) return 'frontier'
  if (/\b(token|spacing|align|resize|color|dtcg)\b/.test(t)) return 'deterministic'
  return 'specialist'
}

export function sceneIrJail(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const id = jailToken(o.id, 'scene')
  const approval = o.approval === 'allow' || o.approval === 'deny' ? o.approval : 'ask'
  const ax = Array.isArray(o.ax) ? o.ax.map((x) => stripLine(x, 80)).filter(Boolean).slice(0, 32) : []
  const som = Array.isArray(o.som) ? o.som.map((x) => stripLine(x, 80)).filter(Boolean).slice(0, 32) : []
  const ocr = stripLine(o.ocr, 400)
  const rel = `data/scene/${id}.json`
  if (rel.includes('..')) return null
  return { rel, scene: { id, approval, ax, som, ocr } }
}

export function acpWorktreeName(raw) {
  const s = String(raw || 'acp')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  if (!s || s.includes('..')) return 'acp'
  return s
}

export function hitlStep(raw) {
  const o = raw && typeof raw === 'object' ? raw : {}
  const action = o.action === 'delay' ? 'delay' : 'approve'
  let ms = Math.trunc(Number(o.ms)) || 0
  if (ms < 0) ms = 0
  if (ms > 60_000) ms = 60_000
  return { action, ms, reason: stripLine(o.reason, 80), wait: action === 'delay' && ms > 0 }
}

export function gatewayContinuity(surface, threadId) {
  const src = SURFACES.has(surface) ? surface : 'desktop'
  const tid = stripLine(threadId, 64) || 'home'
  if (tid.includes('..')) return { surface: src, threadId: 'home' }
  return { surface: src, threadId: tid }
}

export function dnaPlanRel(slug) {
  const s = thinkSlug(slug || 'dna')
  return `RAG/plans/dna-${s}.md`
}

export function dnaPlanFromRecipes(slugs, statusLine) {
  const list = Array.isArray(slugs) ? slugs.map((s) => stripLine(s, 40)).filter(Boolean).slice(0, 8) : []
  const status = stripLine(statusLine, 80)
  if (!list.length) return { ok: false, rel: '', markdown: '' }
  const rel = dnaPlanRel(list[0])
  if (rel.includes('.think.md')) return { ok: false, rel: '', markdown: '' }
  const markdown = [
    `# DNA generate ${list[0]}`,
    '',
    `Library: ${status || '(none)'}`,
    '',
    'Recipes (cite, do not clone source):',
    ...list.map((s) => `- ${s}`),
    '',
    'Emit an original app from recipe shapes. Never copy AI Resources or Cursor UI.'
  ].join('\n')
  return { ok: true, rel, markdown }
}

export function takeRecipeMeta(markdown) {
  const parsed = parseSkillFrontMatter(markdown)
  const meta = parsed && typeof parsed === 'object' ? parsed.meta : null
  const own = (key) => meta && Object.prototype.hasOwnProperty.call(meta, key)
  const stack = own('stack') && RECIPE_STACKS.has(meta.stack) ? meta.stack : 'any'
  return {
    id: own('id') ? stripLine(meta.id, 48) : '',
    title: own('title') ? stripLine(meta.title, 80) : '',
    stack,
    status: own('status') ? stripLine(meta.status, 24) : ''
  }
}

export function takeRecipeMechanism(markdown) {
  const parsed = parseSkillFrontMatter(markdown)
  const body = String(parsed && parsed.body ? parsed.body : '')
  const shape = body.match(/(?:^|\n)## Shape[^\n]*\n([\s\S]*?)(?=\n## |\s*$)/i)
  const mechanism = shape && shape[1].match(/(?:^|\n)-\s*Mechanism:\s*([^\n]+)/i)
  return stripLine(mechanism ? mechanism[1] : '', 160)
}

export function takeRecipePorts(markdown) {
  const parsed = parseSkillFrontMatter(markdown)
  const body = String(parsed && parsed.body ? parsed.body : '')
  const section = body.match(/(?:^|\n)## Ports[^\n]*\n([\s\S]*?)(?=\n## |\s*$)/i)
  const out = Object.create(null)
  if (!section) return out
  for (const line of section[1].split('\n')) {
    const match = line.match(/^\s*-\s*([^:]+):\s*(.+)$/)
    if (!match) continue
    const label = String(match[1]).toLowerCase()
    const value = stripLine(match[2], 120)
    if (!value) continue
    for (const key of CAPABILITY_PORTS) {
      if (new RegExp(`\\b${key}\\b`).test(label)) out[key] = value
    }
  }
  return out
}

export function dnaAppRel(slug, file) {
  const safeSlug = thinkSlug(slug || 'dna')
  const rawFile = String(file || '')
  if (!/^(index\.html|app\.css|app\.js)$/.test(rawFile)) return ''
  const rel = `RAG/plans/dna-${safeSlug}/app/${rawFile}`
  return rel.includes('..') || rel.includes('.think.md') ? '' : rel
}

export function dnaIrRel(slug) {
  return `RAG/plans/dna-${thinkSlug(slug || 'dna')}/ir.json`
}

export function dnaCliRel(slug) {
  return `RAG/plans/dna-${thinkSlug(slug || 'dna')}/cli/run.mjs`
}

export function dnaApiRel(slug, file) {
  const safeSlug = thinkSlug(slug || 'dna')
  const rawFile = String(file || '')
  if (!/^(server\.mjs|openapi\.json)$/.test(rawFile)) return ''
  const rel = `RAG/plans/dna-${safeSlug}/api/${rawFile}`
  return rel.includes('..') || rel.includes('.think.md') ? '' : rel
}

export function dnaDesktopRel(slug, file) {
  const safeSlug = thinkSlug(slug || 'dna')
  const rawFile = String(file || '')
  if (!/^(main\.mjs|preload\.cjs|manifest\.json)$/.test(rawFile)) return ''
  const rel = `RAG/plans/dna-${safeSlug}/desktop/${rawFile}`
  return rel.includes('..') || rel.includes('.think.md') ? '' : rel
}

export function dnaArtifactAllowed(rel, slug) {
  const safeSlug = thinkSlug(slug || 'dna')
  const allowed = new Set([
    dnaPlanRel(safeSlug),
    `RAG/plans/dna-${safeSlug}/README.md`,
    dnaIrRel(safeSlug),
    dnaAppRel(safeSlug, 'index.html'),
    dnaAppRel(safeSlug, 'app.css'),
    dnaAppRel(safeSlug, 'app.js'),
    dnaCliRel(safeSlug),
    dnaApiRel(safeSlug, 'server.mjs'),
    dnaApiRel(safeSlug, 'openapi.json'),
    dnaDesktopRel(safeSlug, 'main.mjs'),
    dnaDesktopRel(safeSlug, 'preload.cjs'),
    dnaDesktopRel(safeSlug, 'manifest.json')
  ])
  return allowed.has(String(rel || ''))
}

function irText(raw, max) {
  if (typeof raw !== 'string' || /[<>\u0000-\u001f\u007f]|url\s*\(/i.test(raw)) return ''
  const value = stripLine(raw, max)
  return value
}

export function takeCapabilityIr(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const own = (obj, key) => obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key)
  if (!own(raw, 'schema') || raw.schema !== 'capabilityir/0.1') return null
  if (!own(raw, 'revision') || raw.revision !== 'rev_1') return null
  if (!own(raw, 'artifact') || !raw.artifact || typeof raw.artifact !== 'object' || Array.isArray(raw.artifact)) return null
  const artifactId = own(raw.artifact, 'id') ? irText(raw.artifact.id, 64) : ''
  const profile = own(raw.artifact, 'profile') ? String(raw.artifact.profile) : ''
  if (!/^dna-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(artifactId) || !CAPABILITY_PROFILES.has(profile)) return null
  if (!own(raw, 'source') || !raw.source || typeof raw.source !== 'object' || Array.isArray(raw.source)) return null
  const recipesIn = own(raw.source, 'recipes') && Array.isArray(raw.source.recipes) ? raw.source.recipes : []
  const recipes = recipesIn.map((slug) => irText(slug, 48)).filter((slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
  if (
    !recipes.length ||
    recipes.length > 8 ||
    recipes.length !== recipesIn.length ||
    new Set(recipes).size !== recipes.length ||
    artifactId !== `dna-${recipes[0]}`
  ) {
    return null
  }
  if (
    own(raw.source, 'status') &&
    (typeof raw.source.status !== 'string' || /[<>\u0000-\u001f\u007f]|url\s*\(/i.test(raw.source.status))
  ) {
    return null
  }
  const sourceStatus = own(raw.source, 'status') ? irText(raw.source.status, 80) : ''
  if (!own(raw, 'capabilities') || !Array.isArray(raw.capabilities) || !raw.capabilities.length || raw.capabilities.length > 8) return null
  const capabilities = []
  for (const cap of raw.capabilities) {
    if (!cap || typeof cap !== 'object' || Array.isArray(cap)) return null
    const slug = own(cap, 'slug') ? irText(cap.slug, 48) : ''
    const id = own(cap, 'id') ? irText(cap.id, 64) : ''
    const title = own(cap, 'title') ? irText(cap.title, 80) : ''
    const stack = own(cap, 'stack') ? String(cap.stack) : ''
    const mechanism = own(cap, 'mechanism') ? irText(cap.mechanism, 160) : ''
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || id !== `cap-${slug}` || !title || !mechanism || !RECIPE_STACKS.has(stack)) return null
    const portsIn = own(cap, 'ports') && cap.ports && typeof cap.ports === 'object' && !Array.isArray(cap.ports) ? cap.ports : {}
    const ports = Object.create(null)
    for (const key of Object.keys(portsIn)) {
      if (!CAPABILITY_PORTS.has(key)) return null
      const value = irText(portsIn[key], 120)
      if (!value) return null
      ports[key] = value
    }
    capabilities.push({ id, slug, title, stack, mechanism, ports })
  }
  if (capabilities.length !== recipes.length || capabilities.some((cap, index) => cap.slug !== recipes[index])) return null
  if (!own(raw, 'composition') || !raw.composition || typeof raw.composition !== 'object' || Array.isArray(raw.composition)) return null
  const kind = own(raw.composition, 'kind') ? String(raw.composition.kind) : ''
  const runLabel = own(raw.composition, 'runLabel') ? irText(raw.composition.runLabel, 40) : ''
  if (kind !== 'cards-run' || !runLabel || !own(raw, 'theme') || raw.theme !== 'hex-dark') return null
  return {
    schema: 'capabilityir/0.1',
    revision: 'rev_1',
    artifact: { id: artifactId, profile },
    source: { recipes, status: sourceStatus },
    capabilities,
    composition: { kind, runLabel },
    theme: 'hex-dark'
  }
}

export function validateCapabilityIr(raw) {
  const ir = takeCapabilityIr(raw)
  return ir ? { ok: true, errors: [], ir } : { ok: false, errors: ['invalid capabilityir/0.1'], ir: null }
}

export function compileCapabilityIr(slugs, statusLine, recipeDocs) {
  const list = Array.isArray(slugs) ? slugs.map((slug) => thinkSlug(slug)).filter(Boolean).slice(0, 8) : []
  if (!list.length) return { ok: false, errors: ['recipes required'], ir: null }
  const docs = Array.isArray(recipeDocs) ? recipeDocs : []
  const capabilities = list.map((slug) => {
    const row = docs.find((item) => thinkSlug(item && item.slug ? item.slug : '') === slug)
    const markdown = row && typeof row.markdown === 'string' ? row.markdown : ''
    const meta = takeRecipeMeta(markdown)
    return {
      id: `cap-${slug}`,
      slug,
      title: meta.title || slug,
      stack: meta.stack,
      mechanism: takeRecipeMechanism(markdown) || 'Compose an original capability from recipe shapes.',
      ports: takeRecipePorts(markdown)
    }
  })
  const candidate = {
    schema: 'capabilityir/0.1',
    revision: 'rev_1',
    artifact: { id: `dna-${list[0]}`, profile: 'web-cli-api' },
    source: { recipes: list, status: stripLine(statusLine, 80) },
    capabilities,
    composition: { kind: 'cards-run', runLabel: 'Run composition' },
    theme: 'hex-dark'
  }
  return validateCapabilityIr(candidate)
}

function escapeHtml(raw) {
  return stripLine(raw, 180)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function emitWebStatic(raw) {
  const ir = takeCapabilityIr(raw)
  if (!ir) return []
  const slug = ir.artifact.id.replace(/^dna-/, '')
  const rows = ir.capabilities
  const title = escapeHtml(rows[0].title)
  const cards = rows
    .map(
      (row) =>
        `<article class="recipe"><p class="eyebrow">${escapeHtml(row.stack)} · ${escapeHtml(row.slug)}</p><h2>${escapeHtml(row.title)}</h2><p>${escapeHtml(row.mechanism)}</p></article>`
    )
    .join('\n')
  const index = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\'; object-src \'none\'; base-uri \'none\'">',
    `<title>${title} · DNA</title>`,
    '<link rel="stylesheet" href="./app.css">',
    '<script src="./app.js" defer></script>',
    '</head>',
    '<body>',
    '<main>',
    '<p class="eyebrow">HEX DNA · ORIGINAL BUILD</p>',
    `<h1>${title}</h1>`,
    '<p class="lead">A runnable local composition generated from recipe mechanisms, not copied source or UI.</p>',
    `<section class="grid">${cards}</section>`,
    `<button id="run" type="button">${escapeHtml(ir.composition.runLabel)}</button>`,
    '<output id="result" aria-live="polite">Ready.</output>',
    '</main>',
    '</body>',
    '</html>'
  ].join('\n')
  const css = [
    ':root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui;background:#0b0c0f;color:#f4f1e8}',
    '*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 0,#2b2114 0,transparent 34%),#0b0c0f}',
    'main{width:min(880px,calc(100% - 32px));margin:0 auto;padding:72px 0}',
    '.eyebrow{color:#e2a84b;font:700 12px/1.4 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase}',
    'h1{font-size:clamp(38px,8vw,76px);line-height:.95;margin:12px 0 20px}.lead{max-width:640px;color:#b9b5aa}',
    '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:36px 0}',
    '.recipe{border:1px solid #34312b;border-radius:14px;padding:20px;background:#111217}.recipe h2{margin:8px 0;font-size:20px}.recipe p:last-child{color:#b9b5aa}',
    'button{border:0;border-radius:999px;padding:12px 18px;background:#e2a84b;color:#17120a;font-weight:800;cursor:pointer}',
    'output{display:block;margin-top:18px;color:#d9c7a4}'
  ].join('\n')
  const js = [
    "const run = document.querySelector('#run')",
    "const result = document.querySelector('#result')",
    "run?.addEventListener('click', () => {",
    "  const desktop = globalThis.dna?.compose?.()",
    `  const count = desktop?.ok && Array.isArray(desktop.capabilities) ? desktop.capabilities.length : ${rows.length}`,
    "  result.textContent = `Composed ${count} recipe shape${count === 1 ? '' : 's'} locally.`",
    "  document.documentElement.dataset.state = 'complete'",
    '})'
  ].join('\n')
  return [
    { rel: dnaAppRel(slug, 'index.html'), body: index },
    { rel: dnaAppRel(slug, 'app.css'), body: css },
    { rel: dnaAppRel(slug, 'app.js'), body: js }
  ]
}

export function emitCliRunner(raw) {
  const ir = takeCapabilityIr(raw)
  if (!ir) return []
  const slug = ir.artifact.id.replace(/^dna-/, '')
  const summary = ir.capabilities.map((cap) => ({
    id: cap.id,
    title: cap.title,
    stack: cap.stack,
    mechanism: cap.mechanism
  }))
  const body = [
    '#!/usr/bin/env node',
    `const capabilities = ${JSON.stringify(summary, null, 2)}`,
    "const result = { schema: 'capability-result/0.1', ok: true, capabilities }",
    'process.stdout.write(JSON.stringify(result, null, 2) + "\\n")'
  ].join('\n')
  return [{ rel: dnaCliRel(slug), body }]
}

export function takeComposeRequest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const keys = Object.keys(raw)
  if (keys.length !== 1 || keys[0] !== 'action' || !Object.prototype.hasOwnProperty.call(raw, 'action')) return null
  return raw.action === 'compose' ? { action: 'compose' } : null
}

export function composeCapabilityResult(raw) {
  const ir = takeCapabilityIr(raw)
  if (!ir) return null
  return {
    schema: 'capability-result/0.1',
    ok: true,
    capabilities: ir.capabilities.map((cap) => ({
      id: cap.id,
      title: cap.title,
      stack: cap.stack,
      mechanism: cap.mechanism
    }))
  }
}

export function emitApiLoopback(raw) {
  const ir = takeCapabilityIr(raw)
  if (!ir) return []
  const slug = ir.artifact.id.replace(/^dna-/, '')
  const result = composeCapabilityResult(ir)
  if (!result) return []
  const server = [
    "import { createServer } from 'node:http'",
    "import { resolve } from 'node:path'",
    "import { pathToFileURL } from 'node:url'",
    '',
    'const MAX_BODY = 8192',
    `const artifact = ${JSON.stringify(ir.artifact.id)}`,
    `const composeResult = ${JSON.stringify(result, null, 2)}`,
    '',
    'export function takeComposeRequest(raw) {',
    "  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null",
    '  const keys = Object.keys(raw)',
    "  if (keys.length !== 1 || keys[0] !== 'action' || !Object.prototype.hasOwnProperty.call(raw, 'action')) return null",
    "  return raw.action === 'compose' ? { action: 'compose' } : null",
    '}',
    '',
    'function reply(res, status, body) {',
    "  const text = JSON.stringify(body).slice(0, 8000)",
    "  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })",
    '  res.end(text)',
    '}',
    '',
    'function readJson(req) {',
    '  return new Promise((resolveBody) => {',
    '    let size = 0',
    "    let text = ''",
    '    let settled = false',
    '    const finish = (value) => { if (!settled) { settled = true; resolveBody(value) } }',
    "    req.on('data', (chunk) => {",
    '      if (settled) return',
    '      size += chunk.length',
    "      if (size > MAX_BODY) return finish({ ok: false, status: 413, error: 'body too large' })",
    "      text += String(chunk)",
    '    })',
    "    req.on('end', () => {",
    '      if (settled) return',
    "      try { finish({ ok: true, value: JSON.parse(text || '{}') }) }",
    "      catch { finish({ ok: false, status: 400, error: 'bad json' }) }",
    '    })',
    "    req.on('error', () => finish({ ok: false, status: 400, error: 'bad body' }))",
    '  })',
    '}',
    '',
    'export function createDnaApiServer() {',
    '  const api = createServer(async (req, res) => {',
    "    const url = new URL(req.url || '/', 'http://127.0.0.1')",
    "    if (req.method === 'GET' && url.pathname === '/health') {",
    "      return reply(res, 200, { schema: 'capability-health/0.1', ok: true, artifact })",
    '    }',
    "    if (req.method === 'POST' && url.pathname === '/compose') {",
    "      const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()",
    "      if (type !== 'application/json') return reply(res, 415, { schema: 'capability-error/0.1', ok: false, error: 'json required' })",
    '      const body = await readJson(req)',
    "      if (!body.ok) return reply(res, body.status, { schema: 'capability-error/0.1', ok: false, error: body.error })",
    "      if (!takeComposeRequest(body.value)) return reply(res, 400, { schema: 'capability-error/0.1', ok: false, error: 'bad request' })",
    '      return reply(res, 200, composeResult)',
    '    }',
    "    return reply(res, 404, { schema: 'capability-error/0.1', ok: false, error: 'not found' })",
    '  })',
    '  api.requestTimeout = 5000',
    '  api.headersTimeout = 5000',
    '  api.maxHeadersCount = 32',
    '  return api',
    '}',
    '',
    'function takePort(raw) {',
    '  const n = Number(raw)',
    '  return Number.isInteger(n) && n >= 1024 && n <= 65535 ? n : 8799',
    '}',
    '',
    'export function start(port = process.env.DNA_API_PORT) {',
    '  const api = createDnaApiServer()',
    "  api.listen(takePort(port), '127.0.0.1')",
    '  return api',
    '}',
    '',
    "const main = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href",
    'if (main) {',
    '  const api = start()',
    '  const stop = () => api.close(() => process.exit(0))',
    "  process.once('SIGINT', stop)",
    "  process.once('SIGTERM', stop)",
    '}'
  ].join('\n')
  const openapi = {
    openapi: '3.0.3',
    info: { title: `${ir.capabilities[0].title} DNA API`, version: '0.1.0' },
    servers: [{ url: 'http://127.0.0.1:8799' }],
    paths: {
      '/health': {
        get: {
          responses: {
            200: { description: 'Loopback health' }
          }
        }
      },
      '/compose': {
        post: {
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['action'],
                  properties: { action: { type: 'string', enum: ['compose'] } }
                }
              }
            }
          },
          responses: {
            200: { description: 'Capability composition result' },
            400: { description: 'Invalid request' },
            413: { description: 'Body too large' },
            415: { description: 'JSON required' }
          }
        }
      }
    }
  }
  return [
    { rel: dnaApiRel(slug, 'server.mjs'), body: server },
    { rel: dnaApiRel(slug, 'openapi.json'), body: JSON.stringify(openapi, null, 2) + '\n' }
  ]
}

export function emitDesktopShell(raw) {
  const ir = takeCapabilityIr(raw)
  if (!ir) return []
  const slug = ir.artifact.id.replace(/^dna-/, '')
  const result = composeCapabilityResult(ir)
  if (!result) return []
  const snapshot = {
    schema: 'desktop-bridge/0.1',
    artifact: { id: ir.artifact.id, profile: ir.artifact.profile },
    capabilities: result.capabilities,
    composition: ir.composition,
    theme: ir.theme
  }
  const preload = [
    "'use strict'",
    "const { contextBridge } = require('electron')",
    '',
    'function deepFreeze(value) {',
    "  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value",
    '  for (const child of Object.values(value)) deepFreeze(child)',
    '  return Object.freeze(value)',
    '}',
    `const snapshot = deepFreeze(${JSON.stringify(snapshot, null, 2)})`,
    `const result = deepFreeze(${JSON.stringify(result, null, 2)})`,
    "contextBridge.exposeInMainWorld('dna', Object.freeze({",
    '  snapshot: () => snapshot,',
    '  compose: () => result',
    '}))'
  ].join('\n')
  const title = `${ir.capabilities[0].title} · DNA`
  const main = [
    "import { app, BrowserWindow } from 'electron'",
    "import { dirname, join, resolve } from 'node:path'",
    "import { fileURLToPath, pathToFileURL } from 'node:url'",
    '',
    'const here = dirname(fileURLToPath(import.meta.url))',
    "const renderer = join(here, '..', 'app', 'index.html')",
    "const preload = join(here, 'preload.cjs')",
    'const allowedRenderer = pathToFileURL(renderer).href',
    '',
    'export function createDnaWindow() {',
    '  const win = new BrowserWindow({',
    '    width: 960,',
    '    height: 720,',
    '    minWidth: 640,',
    '    minHeight: 480,',
    "    backgroundColor: '#0b0c0f',",
    `    title: ${JSON.stringify(title)},`,
    '    autoHideMenuBar: true,',
    '    show: false,',
    '    webPreferences: {',
    '      preload,',
    '      contextIsolation: true,',
    '      nodeIntegration: false,',
    '      sandbox: true,',
    '      webviewTag: false,',
    '      webSecurity: true,',
    '      safeDialogs: true,',
    '      allowRunningInsecureContent: false',
    '    }',
    '  })',
    '  win.webContents.session.setPermissionCheckHandler(() => false)',
    '  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))',
    "  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))",
    "  win.webContents.on('will-navigate', (event, url) => {",
    "    if (url !== allowedRenderer && !url.startsWith(`${allowedRenderer}#`)) event.preventDefault()",
    '  })',
    "  win.webContents.on('will-attach-webview', (event) => event.preventDefault())",
    "  win.once('ready-to-show', () => win.show())",
    '  void win.loadFile(renderer)',
    '  return win',
    '}',
    '',
    'const main = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href',
    'if (main) {',
    '  void app.whenReady().then(() => createDnaWindow())',
    "  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createDnaWindow() })",
    "  app.on('window-all-closed', () => app.quit())",
    '}'
  ].join('\n')
  const manifest = {
    schema: 'desktop-emitter/0.1',
    artifact: ir.artifact.id,
    entry: 'desktop/main.mjs',
    preload: 'desktop/preload.cjs',
    renderer: 'app/index.html',
    bridge: 'desktop-bridge/0.1',
    manualStart: true,
    security: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      permissions: 'deny',
      navigation: 'local-file-only',
      windowOpen: 'deny'
    }
  }
  return [
    { rel: dnaDesktopRel(slug, 'main.mjs'), body: main },
    { rel: dnaDesktopRel(slug, 'preload.cjs'), body: preload },
    { rel: dnaDesktopRel(slug, 'manifest.json'), body: JSON.stringify(manifest, null, 2) + '\n' }
  ]
}

export function dnaScaffoldFromRecipes(slugs, statusLine, recipeDocs) {
  const plan = dnaPlanFromRecipes(slugs, statusLine)
  if (!plan.ok) return { apply: false, ok: false, files: [] }
  const slug = thinkSlug(Array.isArray(slugs) && slugs[0] ? slugs[0] : 'dna')
  const readmeRel = `RAG/plans/dna-${slug}/README.md`
  if (readmeRel.includes('..') || readmeRel.includes('.think.md') || plan.rel.includes('.think.md')) {
    return { apply: false, ok: false, files: [] }
  }
  const readme = [
    `# ${slug}`,
    '',
    'Original runnable app scaffold from recipe shapes. Never copy source or foreign UI.',
    '',
    'Run web: open `app/index.html` locally, or serve this folder with any static file server.',
    '',
    'Run CLI: `node cli/run.mjs`.',
    '',
    'Run API manually: `DNA_API_PORT=8799 node api/server.mjs` (loopback only).',
    '',
    `Run desktop manually from the workspace root: \`./node_modules/.bin/electron RAG/plans/dna-${slug}/desktop/main.mjs\`.`,
    '',
    plan.markdown
  ].join('\n')
  const compiled = compileCapabilityIr(slugs, statusLine, recipeDocs)
  if (!compiled.ok || !compiled.ir) return { apply: false, ok: false, files: [] }
  const emitted = [
    ...emitWebStatic(compiled.ir),
    ...emitCliRunner(compiled.ir),
    ...emitApiLoopback(compiled.ir),
    ...emitDesktopShell(compiled.ir)
  ]
  if (!emitted.length || emitted.some((file) => !dnaArtifactAllowed(file.rel, slug))) {
    return { apply: false, ok: false, files: [] }
  }
  return {
    apply: false,
    ok: true,
    files: [
      { rel: plan.rel, body: plan.markdown },
      { rel: readmeRel, body: readme },
      { rel: dnaIrRel(slug), body: JSON.stringify(compiled.ir, null, 2) + '\n' },
      ...emitted
    ]
  }
}

export { outcomeRoute } from './outcome-route.mjs'

export function harvestPortKind(kind) {
  const k = String(kind || '')
  return PORT_KINDS.has(k) ? k : null
}

export function compilerOsHarvestIds() {
  return COMPILER_OS_PORTS.filter((id) => harvestPortKind(harvestRow(id)?.kind))
}

export function meshKind(raw) {
  return MESH.has(raw) ? raw : 'specialist'
}

export function sessionHits(hits) {
  const list = Array.isArray(hits) ? hits : []
  return list.filter((h) => h && (h.kind === 'conversation' || h.kind === 'discovery' || h.kind === 'anti-pattern')).slice(0, 6)
}

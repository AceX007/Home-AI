import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { ContextRing, RuleCard, SkillCard } from '@homeai/core'

const CHARS_PER_TOKEN = 4

export function tokensOf(s: string): number {
  return Math.ceil((s || '').length / CHARS_PER_TOKEN)
}

export function ringFrom(parts: {
  system: string
  tools: string
  rules: string
  skills: string
  rag: string
  mentions: string
  chat: string
  cap: number
}): ContextRing {
  const system = tokensOf(parts.system)
  const tools = tokensOf(parts.tools)
  const rules = tokensOf(parts.rules)
  const skills = tokensOf(parts.skills)
  const rag = tokensOf(parts.rag)
  const mentions = tokensOf(parts.mentions)
  const chat = tokensOf(parts.chat)
  return {
    system,
    tools,
    rules,
    skills,
    rag,
    mentions,
    chat,
    total: system + tools + rules + skills + rag + mentions + chat,
    cap: parts.cap
  }
}

export interface MentionCtx {
  workspace: string
  readFile: (relOrAbs: string) => string
  listDir: (relOrAbs: string) => Array<{ name: string; dir: boolean; path: string }>
  gitDiff?: string
  gitStatus?: string
  terminals?: string
  chats?: string
  browser?: string
}

const SPECIAL = new Set([
  'codebase',
  'rag',
  'web',
  'git',
  'diff',
  'terminals',
  'terminal',
  'chats',
  'chat',
  'browser',
  'folder'
])

export function extractMentionTokens(task: string): string[] {
  const out: string[] = []
  const re = /@([A-Za-z0-9_./:@-]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(task))) out.push(m[1])
  return out
}

export function resolveMentions(task: string, ctx: MentionCtx): string {
  const blobs: string[] = []
  for (const token of extractMentionTokens(task)) {
    const key = token.toLowerCase()
    if (key === 'codebase' || key === 'rag') continue
    if (key === 'web') continue
    if (key === 'git' || key === 'diff') {
      if (ctx.gitStatus) blobs.push(`@git status\n${ctx.gitStatus.slice(0, 4000)}`)
      if (ctx.gitDiff) blobs.push(`@git diff\n${ctx.gitDiff.slice(0, 8000)}`)
      continue
    }
    if (key === 'terminals' || key === 'terminal') {
      if (ctx.terminals) blobs.push(`@Terminals\n${ctx.terminals.slice(0, 6000)}`)
      continue
    }
    if (key === 'chats' || key === 'chat') {
      if (ctx.chats) blobs.push(`@Chats\n${ctx.chats.slice(0, 4000)}`)
      continue
    }
    if (key === 'browser') {
      if (ctx.browser) blobs.push(`@Browser\n${ctx.browser.slice(0, 8000)}`)
      continue
    }
    const rel = token.replace(/^file:/, '').replace(/^folder:/, '')
    try {
      const listed = ctx.listDir(rel)
      if (listed.some((e) => e.dir) || listed.length > 0) {
        const files = listed.filter((e) => !e.dir).slice(0, 12)
        const bits = [`@folder ${rel}`, listed.map((e) => `${e.dir ? 'd' : 'f'} ${e.name}`).join('\n')]
        for (const f of files) {
          try {
            const body = ctx.readFile(f.path)
            if (body.length < 4000) bits.push(`--- ${f.name} ---\n${body}`)
          } catch {
            /* skip */
          }
        }
        blobs.push(bits.join('\n'))
        continue
      }
    } catch {
      /* file */
    }
    try {
      blobs.push(`@${rel}\n${ctx.readFile(rel).slice(0, 8000)}`)
    } catch {
      /* unresolved */
    }
  }
  return blobs.join('\n\n')
}

export function parseSlash(task: string): { skill?: string; rest: string; customMode: boolean } {
  const m = task.match(/^\/([A-Za-z0-9_-]+)(!?)\s*([\s\S]*)/)
  if (!m) return { rest: task, customMode: false }
  const rest = m[3].trim()
  return { skill: m[1], rest: rest || task, customMode: m[2] === '!' }
}

export function lastConversation(root: string): string {
  const dir = join(root, 'RAG', 'conversations')
  if (!existsSync(dir)) return ''
  const names = readdirSync(dir)
    .filter((n) => n.endsWith('.md'))
    .map((n) => ({ n, t: statSync(join(dir, n)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
    .slice(0, 3)
  if (!names.length) return ''
  const bits: string[] = []
  for (const row of names) {
    try {
      bits.push(readFileSync(join(dir, row.n), 'utf8').slice(0, 2500))
    } catch {
      /* skip */
    }
  }
  return bits.join('\n\n---\n\n').slice(0, 8000)
}

export function selectRules(rules: RuleCard[], openFiles: string[], task: string): RuleCard[] {
  const always = rules.filter((r) => r.alwaysApply !== false && (r.kind === 'always' || r.kind == null || r.alwaysApply))
  const globbed = rules.filter((r) => r.kind === 'glob' && r.globs?.length)
  const hit = globbed.filter((r) =>
    openFiles.some((f) => r.globs!.some((g) => matchGlob(f.replace(/\\/g, '/'), g)))
  )
  const intel = rules.filter((r) => r.kind === 'intelligent')
  const q = task.toLowerCase()
  const intelHit = intel.filter((r) => {
    const hay = `${r.title} ${r.description ?? ''} ${r.body}`.toLowerCase()
    return q.split(/\s+/).filter((w) => w.length > 3).some((w) => hay.includes(w))
  })
  const seen = new Set<string>()
  const out: RuleCard[] = []
  for (const r of [...always, ...hit, ...intelHit]) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    out.push(r)
  }
  return out.slice(0, 10)
}

function matchGlob(path: string, glob: string): boolean {
  const g = glob.replace(/\\/g, '/').replace(/^\.\//, '')
  const re = g
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DS::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DS::/g, '.*')
  return new RegExp(re).test(path) || path.endsWith(g.replace(/^\*\*\//, ''))
}

export function pickSkill(skills: SkillCard[], name: string): SkillCard | undefined {
  const n = name.toLowerCase()
  return skills.find((s) => s.slash === n || s.name.toLowerCase() === n || s.name.toLowerCase().replace(/\s+/g, '-') === n)
}

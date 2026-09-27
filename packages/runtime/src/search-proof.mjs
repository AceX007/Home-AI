import { stripActivityText } from './activity.mjs'

const RAG_FOLDERS = new Set([
  'code',
  'thoughts',
  'discoveries',
  'skills',
  'rules',
  'notes',
  'routines',
  'conversations',
  'tasks',
  'plans'
])

/** Relative dest for rag_write. Plan mode uses folder `plans` → RAG/plans/*.md, never .think.md. */
export function ragWriteRel(folder, name) {
  const f = String(folder || 'thoughts')
    .replace(/[^a-z]/gi, '')
    .toLowerCase()
  if (!RAG_FOLDERS.has(f)) return null
  let fname = String(name || 'note.md').replace(/[^a-zA-Z0-9._-]/g, '_')
  if (!fname || fname.includes('..') || fname.includes('\0')) return null
  if (f === 'plans') {
    const base = fname
      .replace(/\.md$/i, '')
      .replace(/\.think$/i, '')
    if (!base || /\.think$/i.test(base) || base.includes('..')) return null
    return `RAG/plans/${base.slice(0, 80)}.md`
  }
  if (!fname.endsWith('.md')) fname += '.md'
  if (fname.endsWith('.think.md')) return null
  if (f === 'notes') return `notes/${fname.slice(0, 80)}`
  return `RAG/${f}/${fname.slice(0, 80)}`
}

export function skipSkillFile(file) {
  const parts = String(file || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
  const base = parts[parts.length - 1] || ''
  if (base === 'README.md' || base === 'AGENT_SNIPPET.md' || base === 'INDEX.md') return true
  if (parts.includes('reference') || parts.includes('scripts') || parts.includes('assets')) return true
  return false
}

export function parseRuleAlwaysApply(md) {
  const s = String(md || '')
  if (!s.startsWith('---')) return false
  const end = s.indexOf('\n---', 3)
  if (end < 0) return false
  const raw = s.slice(3, end)
  for (const line of raw.split('\n')) {
    const i = line.indexOf(':')
    if (i < 0) continue
    const k = line.slice(0, i).trim()
    const v = line.slice(i + 1).trim()
    if (k === 'alwaysApply') return /^(true|1|yes)$/i.test(v)
  }
  return false
}

export function takeGrepQuery(raw) {
  const s0 = String(raw ?? '')
  if (/[\n\r\0]/.test(s0)) return null
  const s = s0.trim().slice(0, 80)
  if (!s) return null
  return s
}

export function compileGrepRe(raw) {
  const q = takeGrepQuery(raw)
  if (!q) return null
  try {
    return new RegExp(q, 'i')
  } catch {
    const lit = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(lit, 'i')
  }
}

export function publicGrepHits(rows) {
  const out = []
  const src = Array.isArray(rows) ? rows : []
  for (const row of src) {
    const s = String(row || '')
    const m = s.match(/^([^:]+):(\d+):(.*)$/)
    if (!m) continue
    const path = m[1].replace(/\\/g, '/')
    if (!path || path.startsWith('/') || path.includes('..') || /[<>]/.test(path)) continue
    const line = Number(m[2])
    if (!Number.isInteger(line) || line < 1) continue
    out.push({
      path: path.slice(0, 240),
      line,
      text: stripActivityText(m[3], 200)
    })
    if (out.length >= 80) break
  }
  return out
}

export function takeHitRel(path, root) {
  const n = String(path || '')
    .replace(/\\/g, '/')
    .replace(/\0/g, '')
  const base = String(root || '').replace(/\\/g, '/')
  let rel = n
  if (base && (n === base || n.startsWith(`${base}/`))) rel = n.slice(base.length).replace(/^\//, '')
  if (!rel || rel.startsWith('/') || rel.includes('..') || /[\n\r<>]/.test(rel) || /^[a-zA-Z]:/.test(rel)) return null
  return rel.slice(0, 240)
}

const TABLE_STATUS = new Set(['done', 'required', 'missing', 'tested', 'tracked', 'wont'])

/** Count table rows by an exact status cell. Prove text may contain `|` so $5 is not status. */
export function countTableStatus(md, want) {
  const w = String(want || '')
  if (!TABLE_STATUS.has(w)) return 0
  let n = 0
  const lines = String(md || '').split('\n')
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i]
    if (!line.includes('|')) continue
    const cols = line.split('|').map((c) => String(c || '').trim())
    if (cols.some((c) => c === w)) n++
  }
  return n
}

export const EMPTY_METERS = {
  phase: '',
  features: 0,
  testsDone: 0,
  testsRequired: 0,
  edgesTested: 0,
  edgesTracked: 0,
  updated: ''
}

export function parseLibraryStatus(md) {
  const out = { ...EMPTY_METERS }
  if (!String(md || '').trim()) return out
  for (const raw of String(md).split('\n')) {
    const line = raw.trim()
    const phase = line.match(/^- Phase:\s*(.+)$/)
    if (phase) out.phase = phase[1].trim()
    const feat = line.match(/^- Features:\s*documented\s+(\d+)/i)
    if (feat) out.features = Number(feat[1])
    const tests = line.match(/^- Tests:\s*done\s+(\d+)\s*\/\s*required\s+(\d+)/i)
    if (tests) {
      out.testsDone = Number(tests[1])
      out.testsRequired = Number(tests[2])
    }
    const edges = line.match(/^- Edges:\s*tested\s+(\d+)\s*\/\s*tracked\s+(\d+)/i)
    if (edges) {
      out.edgesTested = Number(edges[1])
      out.edgesTracked = Number(edges[2])
    }
    const upd = line.match(/^- Updated:\s*(.+)$/)
    if (upd) out.updated = upd[1].trim()
  }
  return out
}

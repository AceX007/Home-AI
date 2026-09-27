const STATUSES = new Set(['think', 'ready', 'implementing', 'done'])
export const THINK_HEADINGS = ['Goal', 'Map', 'Edges', 'Edits', 'Verify', 'Out of scope']

export function thinkSlug(name) {
  const s = String(name || 'handoff')
    .replace(/\.think\.md$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return s || 'handoff'
}

export function thinkRel(name) {
  const rel = `RAG/plans/${thinkSlug(name)}.think.md`
  if (rel.includes('..') || rel.includes('\0')) throw new Error('path escapes workspace')
  return rel
}

export function redactCloudText(s) {
  return String(s ?? '')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\b(api[_-]?key|secret|token)\s*[:=]\s*\S+/gi, '$1=[redacted]')
}

export function parseThinkFront(md) {
  const text = String(md ?? '')
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return { status: '', title: '', files: [] }
  const block = m[1]
  const status = (block.match(/^status:\s*(\S+)/m) || [])[1] || ''
  const title = ((block.match(/^title:\s*(.+)$/m) || [])[1] || '').trim()
  const filesLine = (block.match(/^files:\s*(.+)$/m) || [])[1] || ''
  const files = filesLine
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  return { status, title, files }
}

export function validateThinkMarkdown(md) {
  const errors = []
  const text = String(md ?? '')
  if (text.length > 24_000) errors.push('too long')
  if (/[<>]/.test(text)) errors.push('html')
  const fm = parseThinkFront(text)
  if (!STATUSES.has(fm.status)) errors.push('status')
  if (!fm.title) errors.push('title')
  if (!fm.files.length) errors.push('files')
  for (const f of fm.files) {
    if (!f || f.includes('..') || f.includes('\0') || f.startsWith('/') || f.includes('\\')) errors.push(`file ${f}`)
  }
  const body = text.replace(/^---[\s\S]*?---/, '')
  for (const h of THINK_HEADINGS) {
    if (!new RegExp(`^## ${h}\\s*$`, 'm').test(body)) errors.push(`heading ${h}`)
  }
  return { ok: errors.length === 0, errors, ...fm }
}

export function thinkRelFromOpen(path) {
  const n = String(path || '').replace(/\\/g, '/')
  const m = n.match(/(?:^|\/)(RAG\/plans\/[A-Za-z0-9._-]+\.think\.md)$/)
  return m ? m[1] : ''
}

/** Implementing think docs stay implementing unless the forge completed with no error chunks. */
export function shouldCloseThink(hadError) {
  return hadError === false
}

export function chunkIsForgeError(chunk) {
  return Boolean(chunk && typeof chunk === 'object' && chunk.type === 'error')
}

export function bumpThinkStatus(md, to) {
  if (to !== 'implementing' && to !== 'done') throw new Error('status')
  const v = validateThinkMarkdown(md)
  if (!v.ok) throw new Error(`invalid think: ${v.errors.join(',')}`)
  if (to === 'implementing') {
    if (v.status === 'implementing') return { markdown: String(md), status: 'implementing', changed: false }
    if (v.status !== 'ready') throw new Error('need ready')
  }
  if (to === 'done' && v.status !== 'implementing' && v.status !== 'ready') throw new Error('need implementing')
  const text = String(md)
  const m = text.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/)
  if (!m) throw new Error('frontmatter')
  const block = m[2].replace(/^status:\s*\S+/m, `status: ${to}`)
  if (block === m[2]) throw new Error('no status line')
  const next = `${m[1]}${block}${m[3]}${text.slice(m[0].length)}`
  const v2 = validateThinkMarkdown(next)
  if (!v2.ok) throw new Error(`bump invalid: ${v2.errors.join(',')}`)
  if (v2.status !== to) throw new Error('status mismatch')
  return { markdown: next, status: to, changed: true }
}

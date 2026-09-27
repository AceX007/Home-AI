const KINDS = new Set(['explore', 'outline', 'grep', 'read', 'bash', 'browser', 'research'])
const NAME = /^[\w.-]{1,40}$/

export function parseWorkerJobs(raw) {
  if (!Array.isArray(raw)) throw new Error('jobs must be an array')
  if (raw.length > 4) throw new Error('max 4 workers')
  const out = []
  const seen = new Set()
  for (const j of raw) {
    if (!j || typeof j !== 'object' || Array.isArray(j)) continue
    const name = String(j.name ?? '').trim()
    const kind = String(j.kind ?? 'explore')
    const query = String(j.query ?? '').slice(0, 200).trim()
    const path = typeof j.path === 'string' ? j.path.trim() : ''
    if (!NAME.test(name)) throw new Error(`bad worker name ${name}`)
    if (seen.has(name)) throw new Error(`duplicate worker ${name}`)
    if (!KINDS.has(kind)) throw new Error(`bad worker kind ${kind}`)
    if (!query && !path) throw new Error(`empty worker ${name}`)
    if (path.includes('..') || path.includes('\0')) throw new Error('path escapes')
    seen.add(name)
    out.push({ name, kind, query: query || path, path })
  }
  if (!out.length) throw new Error('no workers')
  return out
}

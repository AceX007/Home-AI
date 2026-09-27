const ID_RE = /^[\w.-]{1,80}$/

export function cursorAgentId(raw) {
  const s = String(raw ?? '').trim()
  return ID_RE.test(s) ? s : null
}

function scrub(s, max) {
  return String(s ?? '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function cursorJobSummary(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw
  const id = cursorAgentId(rec.id ?? rec.agentId)
  if (!id) return null
  const status = scrub(rec.status ?? rec.state ?? 'unknown', 32) || 'unknown'
  const prompt = rec.prompt && typeof rec.prompt === 'object' ? rec.prompt : null
  const nameSrc =
    typeof rec.name === 'string'
      ? rec.name
      : typeof rec.title === 'string'
        ? rec.title
        : prompt && typeof prompt.text === 'string'
          ? prompt.text
          : id
  const target = rec.target && typeof rec.target === 'object' ? rec.target : null
  const summarySrc =
    typeof rec.summary === 'string'
      ? rec.summary
      : target && typeof target.url === 'string'
        ? target.url
        : ''
  return {
    id,
    status,
    name: scrub(nameSrc, 80) || id,
    summary: scrub(summarySrc, 200)
  }
}

export function cursorJobList(raw) {
  if (!raw) return []
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.agents)
      ? raw.agents
      : Array.isArray(raw.data)
        ? raw.data
        : Array.isArray(raw.jobs)
          ? raw.jobs
          : []
  const out = []
  const seen = new Set()
  for (const row of arr) {
    const job = cursorJobSummary(row)
    if (!job || seen.has(job.id)) continue
    seen.add(job.id)
    out.push(job)
    if (out.length >= 50) break
  }
  return out
}

export function cursorGetUrl(id) {
  const safe = cursorAgentId(id)
  if (!safe) throw new Error('bad agent id')
  return `https://api.cursor.com/v1/agents/${encodeURIComponent(safe)}`
}

import { parseWorkerJobs } from './spawn-workers.mjs'
import { extractHtml, looksLikeHtml } from './web-extract.mjs'

export const SUBAGENT_KINDS = ['explore', 'bash', 'browser', 'research']

export const SUBAGENT_TOOLS = {
  explore: ['explore', 'grep', 'glob', 'fs_read', 'code_outline'],
  bash: ['terminal_run'],
  browser: [
    'browser_navigate',
    'browser_extract',
    'browser_click',
    'browser_type',
    'browser_screenshot',
    'browser_console'
  ],
  research: ['web_search', 'http_fetch', 'web_extract', 'rag_search']
}

export function normalizeSubagentKind(raw) {
  const k = String(raw || 'explore').toLowerCase()
  if (k === 'outline' || k === 'grep' || k === 'read') return 'explore'
  if (SUBAGENT_KINDS.includes(k)) return k
  return null
}

export function toolsForSubagent(kind, builtins) {
  const k = normalizeSubagentKind(kind)
  const allow = new Set(k ? SUBAGENT_TOOLS[k] : [])
  const list = Array.isArray(builtins) ? builtins : []
  return list.filter((t) => t && allow.has(t.name))
}

/** Nested explore forge: skip critic + remember, two turns. Think never uses this. */
export function nestedExploreForgeFlags() {
  return { skipVerify: true, skipRemember: true, maxTurns: 2 }
}

function lastLines(text, n) {
  const lines = String(text || '').split('\n')
  return lines.slice(Math.max(0, lines.length - n)).join('\n')
}

function digestBody(content) {
  let s = String(content || '')
  if (looksLikeHtml(s, '')) s = extractHtml(s, '')
  return s.replace(/[<>]/g, '')
}

export function digestSubagent(kind, results) {
  const rows = Array.isArray(results) ? results : []
  const bits = rows.map((r) => {
    const ok = r && r.ok ? 'ok' : 'err'
    const name = r && r.name ? r.name : 'tool'
    const body = digestBody(r && r.content ? r.content : '')
    return `${ok} ${name}\n${body}`
  })
  const joined = bits.join('\n---\n')
  if (kind === 'bash') return lastLines(joined, 80).slice(0, 4000)
  return joined.slice(0, 4000)
}

export function parseTaskCall(args, opts) {
  const a = args && typeof args === 'object' && !Array.isArray(args) ? args : {}
  const think = opts && opts.think === true
  if (Array.isArray(a.jobs)) {
    const jobs = parseWorkerJobs(a.jobs)
    if (think && jobs.some((j) => normalizeSubagentKind(j.kind) !== 'explore')) {
      throw new Error('think subagents are explore-only')
    }
    return jobs
  }
  const kind = normalizeSubagentKind(a.subagent_type || a.kind || 'explore')
  if (!kind) throw new Error('bad subagent_type')
  if (think && kind !== 'explore') throw new Error('think subagents are explore-only')
  const query = String(a.query ?? a.prompt ?? '').trim().slice(0, 200)
  if (!query) throw new Error('empty subagent query')
  return [{ name: kind, kind, query, path: '' }]
}

function callsForJob(job) {
  const kind = job.kind
  const q = job.query
  const path = job.path
  if (kind === 'bash') {
    return [{ id: `bash-${job.name}`, name: 'terminal_run', arguments: { command: q, timeoutMs: 30_000 } }]
  }
  if (kind === 'browser') {
    if (/^https?:\/\//i.test(q)) {
      return [
        { id: `nav-${job.name}`, name: 'browser_navigate', arguments: { url: q } },
        { id: `ex-${job.name}`, name: 'browser_extract', arguments: {} }
      ]
    }
    return [{ id: `ex-${job.name}`, name: 'browser_extract', arguments: {} }]
  }
  if (kind === 'research') {
    if (/^https?:\/\//i.test(q)) {
      return [{ id: `rs-${job.name}`, name: 'web_extract', arguments: { url: q } }]
    }
    return [{ id: `rs-${job.name}`, name: 'web_search', arguments: { query: q } }]
  }
  if (kind === 'outline') {
    return [{ id: `out-${job.name}`, name: 'code_outline', arguments: { path: path || q } }]
  }
  if (kind === 'grep') {
    return [{ id: `g-${job.name}`, name: 'grep', arguments: { pattern: q } }]
  }
  if (kind === 'read') {
    return [{ id: `r-${job.name}`, name: 'fs_read', arguments: { path: path || q } }]
  }
  return [{ id: `ex-${job.name}`, name: 'explore', arguments: { query: q } }]
}

function formatJobDigest(job, kind, results) {
  const body = `### ${job.name} (${kind})\n${digestSubagent(kind, results)}`
  return kind === 'explore' ? `Explore finished\n${body}` : body
}

export async function runSubagentJobs(jobs, runChildTool, opts) {
  const list = Array.isArray(jobs) ? jobs.slice(0, 4) : []
  const nestedForge = opts && typeof opts.nestedForge === 'function' ? opts.nestedForge : null
  const think = Boolean(opts && opts.think)
  const rows = await Promise.all(
    list.map(async (job) => {
      const kind = normalizeSubagentKind(job.kind) || 'explore'
      if (kind === 'explore' && nestedForge && !think) {
        try {
          const forged = await nestedForge(job)
          const results = Array.isArray(forged) ? forged : [forged]
          return formatJobDigest(job, kind, results)
        } catch {
          /* sidecar miss — deterministic explore still works */
        }
      }
      const calls = callsForJob(job)
      const results = []
      for (const call of calls) {
        results.push(await runChildTool(call))
      }
      return formatJobDigest(job, kind, results)
    })
  )
  return rows.join('\n\n').slice(0, 8000)
}

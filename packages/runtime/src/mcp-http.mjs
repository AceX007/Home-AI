const BLOCK_ENV = /^(LD_|DYLD_|NODE_OPTIONS|PYTHONHOME|PYTHONPATH)/i
const BLOCK_HDR = new Set([
  'host',
  'content-length',
  'transfer-encoding',
  'connection',
  'cookie',
  'set-cookie',
  'upgrade'
])

export function sanitizeMcpEnv(env) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) return undefined
  const out = {}
  for (const [k, v] of Object.entries(env)) {
    if (typeof k !== 'string' || typeof v !== 'string') continue
    if (BLOCK_ENV.test(k) || k.includes('\0') || /[\n\r]/.test(k) || /[\n\r]/.test(v)) continue
    if (k.length > 80 || v.length > 4000) continue
    out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}

export function sanitizeMcpHeaders(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return {}
  const out = {}
  for (const [k, v] of Object.entries(headers)) {
    if (typeof k !== 'string' || typeof v !== 'string') continue
    const name = k.trim()
    if (!/^[A-Za-z0-9-]+$/.test(name) || name.length > 80) continue
    if (BLOCK_HDR.has(name.toLowerCase())) continue
    if (/[\n\r]/.test(v) || v.length > 4000) continue
    out[name] = v
  }
  return out
}

function own(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined
}

export function takeMcpServerCfg(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const command = own(raw, 'command')
  const args = own(raw, 'args')
  const url = own(raw, 'url')
  const env = own(raw, 'env')
  const headers = own(raw, 'headers')
  const cfg = {}
  if (typeof command === 'string' && command.trim()) cfg.command = command.trim()
  if (Array.isArray(args)) cfg.args = args.filter((x) => typeof x === 'string').slice(0, 32)
  if (typeof url === 'string' && url.trim()) cfg.url = url.trim()
  const envClean = sanitizeMcpEnv(env)
  if (envClean) cfg.env = envClean
  const hdrs = sanitizeMcpHeaders(headers)
  if (Object.keys(hdrs).length) cfg.headers = hdrs
  if (!cfg.command && !cfg.url) return null
  return cfg
}

/** Pick the JSON-RPC message whose id matches from an SSE (or raw JSON) body. */
export function parseSseJsonRpc(text, id) {
  const raw = String(text ?? '')
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    const msg = JSON.parse(trimmed)
    if (msg && msg.id === id) return msg
  }
  let data = ''
  const flush = () => {
    const chunk = data.trim()
    data = ''
    if (!chunk || chunk === '[DONE]') return null
    try {
      const msg = JSON.parse(chunk)
      if (msg && msg.id === id) return msg
    } catch {
      /* ignore */
    }
    return null
  }
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('data:')) {
      data += (data ? '\n' : '') + line.slice(5).replace(/^ /, '')
      continue
    }
    if (line.trim() === '') {
      const hit = flush()
      if (hit) return hit
    }
  }
  const tail = flush()
  if (tail) return tail
  throw new Error('mcp sse: no matching id')
}

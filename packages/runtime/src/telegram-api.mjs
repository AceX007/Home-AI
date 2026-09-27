import { redactCloudText } from './think.mjs'
import { takeRetryAfterMs } from './pack-chrome.mjs'

const API = 'https://api.telegram.org'

export function telegramTokenOk(raw) {
  const s = String(raw || '').trim()
  if (s.length < 20 || s.length > 200) return false
  if (/\s/.test(s) || s.includes('..')) return false
  return true
}

export function telegramCallUrl(token, method) {
  const t = String(token || '')
  if (t !== 'TEST' && !telegramTokenOk(t)) throw new Error('bad token')
  const m = String(method || '')
  if (!/^[a-zA-Z]{1,64}$/.test(m)) throw new Error('bad method')
  return `${API}/bot${t}/${m}`
}

function scrubErr(msg) {
  return redactCloudText(String(msg || 'telegram error')).replace(/\d+:[A-Za-z0-9_-]{10,}/g, '[redacted]')
}

export async function telegramCall(token, method, body, fetchImpl = fetch) {
  const url = telegramCallUrl(token, method)
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body && typeof body === 'object' ? body : {})
    })
    const json = await res.json().catch(() => ({}))
    const retryAfterMs = takeRetryAfterMs(res.headers?.get?.('retry-after') || res.headers?.get?.('Retry-After'), json)
    if (res.status === 429 || json?.error_code === 429) {
      const err = new Error(scrubErr(json?.description || 'telegram rate limit'))
      err.retryAfterMs = retryAfterMs || 5000
      throw err
    }
    if (!json || json.ok !== true) throw new Error(scrubErr(json?.description || 'telegram error'))
    return json.result
  } catch (err) {
    const e = new Error(scrubErr(err instanceof Error ? err.message : String(err)))
    if (err && typeof err === 'object' && Number(err.retryAfterMs) > 0) e.retryAfterMs = Number(err.retryAfterMs)
    throw e
  }
}

export function nextBackoff(ms, retryAfterMs) {
  const forced = Math.max(0, Number(retryAfterMs) || 0)
  if (forced > 0) return Math.min(120_000, Math.floor(forced))
  const n = Math.max(400, Number(ms) || 400)
  return Math.min(30_000, Math.floor(n * 1.7))
}

export function telegramFileId(raw) {
  const s = String(raw || '')
  return /^[\w-]{8,256}$/.test(s) ? s : null
}

export function telegramFilePath(raw) {
  const p = String(raw || '').replace(/\\/g, '/')
  if (!p || p.includes('..') || p.startsWith('/') || p.length > 200) return null
  if (!/^[A-Za-z0-9_./-]+$/.test(p)) return null
  return p
}

export function telegramFileUrl(token, path) {
  const t = String(token || '')
  const p = telegramFilePath(path)
  if ((t !== 'TEST' && !telegramTokenOk(t)) || !p) throw new Error('bad file')
  return `${API}/file/bot${t}/${p}`
}

export async function telegramDownloadFile(token, path, fetchImpl = fetch) {
  const url = telegramFileUrl(token, path)
  try {
    const res = await fetchImpl(url)
    const buf = Buffer.from(await res.arrayBuffer())
    if (!res.ok || !buf.length || buf.length > 2_000_000) throw new Error('file too large')
    return buf
  } catch (err) {
    throw new Error(scrubErr(err instanceof Error ? err.message : String(err)))
  }
}

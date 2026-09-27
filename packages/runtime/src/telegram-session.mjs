import { chatThreadId, jobRunId } from './conversations.mjs'
import { takeMind } from './mind.mjs'
import { telegramUserId } from './telegram-auth.mjs'
import { plainLine, takeMode } from './telegram-chrome.mjs'

const LLAMA = new Set(['on', 'off', 'missing'])

export function takeTelegramSession(raw) {
  const empty = {
    configured: false,
    online: false,
    peers: [],
    pairing: null,
    mode: 'ask',
    mind: 'local',
    llama: 'off',
    keys: 'none',
    cursor: 'off',
    live: [],
    threads: [],
    glass: false
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty
  const peers = []
  const seen = new Set()
  const src = Array.isArray(raw.peers) ? raw.peers : []
  for (const row of src) {
    const id = telegramUserId(row && typeof row === 'object' ? row.id : row)
    if (id == null || seen.has(id)) continue
    seen.add(id)
    peers.push(id)
    if (peers.length >= 32) break
  }
  let pairing = null
  const exp = Number(raw.pairing && typeof raw.pairing === 'object' ? raw.pairing.exp : raw.pairingExp)
  if (Number.isInteger(exp) && exp > 0) pairing = { exp }
  const live = []
  const jobs = Array.isArray(raw.live) ? raw.live : []
  for (const row of jobs) {
    if (!row || typeof row !== 'object') continue
    const id = jobRunId(row.id)
    if (!id || id.includes('..')) continue
    live.push({
      id,
      title: plainLine(row.title, 80) || id,
      mode: takeMode(row.mode) || 'ask'
    })
    if (live.length >= 8) break
  }
  const threads = []
  const rows = Array.isArray(raw.threads) ? raw.threads : []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const id = chatThreadId(row.id)
    if (!id) continue
    threads.push({ id, title: plainLine(row.title, 80) || id })
    if (threads.length >= 16) break
  }
  const keys = plainLine(raw.keys, 48) || 'none'
  return {
    configured: raw.configured === true,
    online: raw.online === true,
    peers,
    pairing,
    mode: takeMode(raw.mode) || 'ask',
    mind: takeMind(typeof raw.mind === 'string' ? raw.mind : '') || 'local',
    llama: LLAMA.has(raw.llama) ? raw.llama : 'off',
    keys: keys.includes('sk-') || keys.includes('<') ? 'none' : keys,
    cursor: plainLine(raw.cursor, 80) || 'off',
    live,
    threads,
    glass: raw.glass === true
  }
}

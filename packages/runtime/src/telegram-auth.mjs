import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CODE_RE = /^[A-Z0-9]{8}$/
const PAIR_MS = 10 * 60 * 1000
const SEEN_CAP = 200
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function telegramUserId(raw) {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isInteger(n) || n <= 0 || n > Number.MAX_SAFE_INTEGER) return null
  return n
}

export function normalizePairCode(raw) {
  const s = String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  return CODE_RE.test(s) ? s : null
}

export function hashPairCode(code) {
  const c = normalizePairCode(code)
  if (!c) throw new Error('bad pair code')
  return createHash('sha256').update(c).digest('hex')
}

export function defaultTelegramState() {
  return { peers: [], pairing: null, offset: 0, seen: [] }
}

export function takeTelegramState(raw) {
  const d = defaultTelegramState()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d
  const peers = []
  const seenPeer = new Set()
  if (Array.isArray(raw.peers)) {
    for (const p of raw.peers) {
      const id = telegramUserId(p && typeof p === 'object' ? p.id : p)
      if (id == null || seenPeer.has(id)) continue
      seenPeer.add(id)
      peers.push({ id, pairedAt: Number(p?.pairedAt) || 0 })
    }
  }
  let pairing = null
  if (raw.pairing && typeof raw.pairing === 'object' && !Array.isArray(raw.pairing)) {
    const hash = String(raw.pairing.hash || '')
    const exp = Number(raw.pairing.exp) || 0
    if (/^[a-f0-9]{64}$/.test(hash) && exp > 0) pairing = { hash, exp }
  }
  const offset = Math.max(0, Math.floor(Number(raw.offset) || 0))
  const seen = []
  if (Array.isArray(raw.seen)) {
    for (const u of raw.seen) {
      const n = Number(u)
      if (Number.isInteger(n) && n > 0) seen.push(n)
      if (seen.length >= SEEN_CAP) break
    }
  }
  return { peers, pairing, offset, seen }
}

export function isPeer(state, userId) {
  const id = telegramUserId(userId)
  if (id == null) return false
  return takeTelegramState(state).peers.some((p) => p.id === id)
}

export function startPairing(state, now = Date.now()) {
  const buf = randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) code += ALPHABET[buf[i] % ALPHABET.length]
  const next = takeTelegramState(state)
  next.pairing = { hash: hashPairCode(code), exp: now + PAIR_MS }
  return { state: next, code, exp: next.pairing.exp }
}

export function consumePair(state, code, userId, now = Date.now()) {
  const id = telegramUserId(userId)
  const c = normalizePairCode(code)
  const next = takeTelegramState(state)
  if (id == null || !c) return { ok: false, reason: 'bad', state: next }
  if (!next.pairing || next.pairing.exp <= now) {
    next.pairing = null
    return { ok: false, reason: 'expired', state: next }
  }
  if (hashPairCode(c) !== next.pairing.hash) return { ok: false, reason: 'mismatch', state: next }
  next.pairing = null
  if (!next.peers.some((p) => p.id === id)) next.peers.push({ id, pairedAt: now })
  return { ok: true, state: next }
}

export function unpair(state, userId) {
  const id = telegramUserId(userId)
  const next = takeTelegramState(state)
  next.peers = next.peers.filter((p) => p.id !== id)
  return next
}

export function rememberUpdate(state, updateId) {
  const next = takeTelegramState(state)
  const n = Number(updateId)
  if (!Number.isInteger(n) || n <= 0) return { state: next, fresh: false }
  if (next.seen.includes(n)) return { state: next, fresh: false }
  next.seen.push(n)
  if (next.seen.length > SEEN_CAP) next.seen = next.seen.slice(-SEEN_CAP)
  if (n > next.offset) next.offset = n
  return { state: next, fresh: true }
}

export function loadTelegramState(root) {
  const p = join(root, 'data', 'telegram', 'state.json')
  if (!existsSync(p)) return defaultTelegramState()
  try {
    return takeTelegramState(JSON.parse(readFileSync(p, 'utf8')))
  } catch {
    return defaultTelegramState()
  }
}

export function saveTelegramState(root, state) {
  const dir = join(root, 'data', 'telegram')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'state.json'), JSON.stringify(takeTelegramState(state), null, 2), 'utf8')
}

export function telegramStatusView(state, configured, online, now = Date.now()) {
  const s = takeTelegramState(state)
  const live = s.pairing && s.pairing.exp > now
  return {
    configured: Boolean(configured),
    online: Boolean(online),
    peers: s.peers.map((p) => p.id),
    pairing: live ? { exp: s.pairing.exp } : null
  }
}

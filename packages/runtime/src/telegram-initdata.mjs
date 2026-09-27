import { createHmac, timingSafeEqual } from 'node:crypto'
import { stripActivityText } from './activity.mjs'
import { chatThreadId } from './conversations.mjs'
import { telegramUserId } from './telegram-auth.mjs'
import { parseHttpUrl } from './policy.mjs'
import { takeMind } from './mind.mjs'
import { thinkRelFromOpen } from './think.mjs'
import { takeGitHttpsUrl } from './git-safe.mjs'
import { takeFleetId, takeFleetKind, takeFleetRecipe, takeRepoRel, idFromCloneUrl, kindFromAddRel, defaultRecipeForKind } from './fleet.mjs'

const MAX_AGE_MS = 24 * 60 * 60 * 1000
export const DEFAULT_MINIAPP_PORT = 18766

export function miniAppPort(raw) {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1024 && n <= 65535 ? n : DEFAULT_MINIAPP_PORT
}

export function loopbackMiniAppUrl(port) {
  return `http://127.0.0.1:${miniAppPort(port)}`
}

export function resolveMiniAppUrl(raw, port) {
  return takeMiniAppUrl(raw) || loopbackMiniAppUrl(port)
}

export function miniMenuButton(url, text = 'HOME') {
  const safe = takeMiniAppUrl(url)
  const label = String(text || 'HOME').replace(/[^\w .·-]/g, '').slice(0, 16) || 'HOME'
  if (!safe) return { type: 'default' }
  return { type: 'web_app', text: label, web_app: { url: safe } }
}

export function takeMiniAppUrl(raw) {
  const u = parseHttpUrl(raw)
  if (!u) return null
  const host = u.hostname.toLowerCase()
  const loopback = host === '127.0.0.1' || host === 'localhost'
  if (u.protocol === 'http:' && !loopback) return null
  if (u.protocol !== 'https:' && !loopback) return null
  const path = u.pathname === '/' ? '' : u.pathname
  if (path.includes('..')) return null
  const out = `${u.origin}${path}`
  return out.length > 200 ? null : out
}

export function validateTelegramInitData(token, raw, now = Date.now()) {
  const t = String(token || '')
  const s = String(raw || '')
  if (t.length < 20 || t.length > 200 || s.length < 20 || s.length > 4000) return null
  let params
  try {
    params = new URLSearchParams(s)
  } catch {
    return null
  }
  const hash = String(params.get('hash') || '')
  if (!/^[a-f0-9]{64}$/.test(hash)) return null
  params.delete('hash')
  const pairs = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const dataCheck = pairs.join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(t).digest()
  const digest = createHmac('sha256', secret).update(dataCheck).digest()
  let expected
  try {
    expected = Buffer.from(hash, 'hex')
  } catch {
    return null
  }
  if (expected.length !== digest.length || !timingSafeEqual(digest, expected)) return null
  const authDate = Number(params.get('auth_date'))
  if (!Number.isInteger(authDate) || authDate <= 0) return null
  if (now - authDate * 1000 > MAX_AGE_MS) return null
  let userId = null
  try {
    const user = JSON.parse(String(params.get('user') || ''))
    userId = telegramUserId(user && user.id)
  } catch {
    return null
  }
  if (userId == null) return null
  return { userId }
}

function jailRunId(raw) {
  const id = String(raw || '').trim()
  if (!/^[\w.-]{1,80}$/.test(id) || id.includes('..')) return null
  return id
}

export function takeMiniBody(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const action = String(raw.action || '')
  const ok = new Set([
    'session',
    'chat',
    'stop',
    'pulse',
    'approve',
    'board',
    'stack',
    'glance',
    'mind',
    'threads',
    'new',
    'skills',
    'think',
    'pin',
    'goal',
    'steer',
    'answer',
    'implement',
    'inbox',
    'use',
    'health',
    'provider',
    'cursor',
    'llama',
    'fleet',
    'fleet-clone',
    'fleet-add',
    'fleet-start',
    'fleet-stop',
    'fleet-restart',
    'fleet-fork',
    'fleet-sub',
    'mode'
  ])
  if (!ok.has(action)) return null
  const rec = { action }
  if (action === 'chat') {
    const task = String(raw.task || '').slice(0, 8000).trim()
    if (!task) return null
    const mode = String(raw.mode || 'ask').toLowerCase()
    rec.task = task
    rec.mode = new Set(['ask', 'think', 'agent', 'plan', 'debug', 'multitask']).has(mode) ? mode : 'ask'
  }
  if (action === 'mode') {
    const mode = String(raw.mode || '').toLowerCase()
    if (!new Set(['ask', 'think', 'agent', 'plan', 'debug', 'multitask']).has(mode)) return null
    rec.mode = mode
  }
  if (action === 'stop' || action === 'approve' || action === 'steer' || action === 'answer') {
    const id = jailRunId(raw.runId)
    if (!id) return null
    rec.runId = id
    if (action === 'approve') rec.ok = raw.ok === true
    if (action === 'steer') {
      const text = stripActivityText(raw.text, 800)
      if (!text) return null
      rec.text = text
    }
    if (action === 'answer') {
      const pick = Number(raw.pick)
      if (Number.isInteger(pick) && pick >= 0 && pick <= 7) rec.pick = pick
      else {
        const text = stripActivityText(raw.text, 200)
        if (!text) return null
        rec.text = text
      }
    }
  }
  if (action === 'pulse') {
    if (raw.runId) {
      const id = jailRunId(raw.runId)
      if (!id) return null
      rec.runId = id
    }
  }
  if (action === 'pin') {
    const title = stripActivityText(raw.title || raw.text, 120)
    if (!title) return null
    rec.title = title
  }
  if (action === 'goal') {
    rec.text = stripActivityText(raw.text, 200)
  }
  if (action === 'implement') {
    const path = thinkRelFromOpen(raw.path)
    if (!path) return null
    rec.path = path
  }
  if (action === 'use') {
    const threadId = chatThreadId(raw.threadId)
    if (!threadId) return null
    rec.threadId = threadId
  }
  if (action === 'provider') {
    const provider = takeMind(raw.provider)
    if (!provider) return null
    rec.provider = provider
  }
  if (action === 'inbox') {
    const name = String(raw.name || '').replace(/[^\w.-]/g, '_').slice(0, 64)
    const data = String(raw.data || '')
    if (!name || name.includes('..') || data.length < 8 || data.length > 2_800_000) return null
    rec.name = name
    rec.data = data
  }
  if (action === 'fleet-fork') {
    const fromId = takeFleetId(raw.fromId)
    if (!fromId) return null
    if (raw.url) return null
    rec.fromId = fromId
    const id = takeFleetId(raw.id)
    if (id) rec.id = id
  }
  if (action === 'fleet-clone') {
    const url = takeGitHttpsUrl(raw.url)
    const id = takeFleetId(raw.id) || idFromCloneUrl(raw.url)
    if (!url || !id) return null
    rec.url = url
    rec.id = id
    rec.kind = takeFleetKind(raw.kind) || 'website'
  }
  if (action === 'fleet-add') {
    const id = takeFleetId(raw.id)
    const rel = takeRepoRel(raw.rel)
    if (!id || !rel) return null
    rec.id = id
    rec.rel = rel
    rec.kind = takeFleetKind(raw.kind) || kindFromAddRel(rel) || 'generic'
    rec.recipe = takeFleetRecipe(raw.recipe) || defaultRecipeForKind(rec.kind)
  }
  if (action === 'fleet-start' || action === 'fleet-stop' || action === 'fleet-restart') {
    const id = takeFleetId(raw.id)
    if (!id) return null
    rec.id = id
  }
  return rec
}

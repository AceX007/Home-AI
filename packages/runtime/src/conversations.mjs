import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertInside } from './paths.mjs'
import { stripActivityText } from './activity.mjs'
import { redactCloudText } from './think.mjs'

export const HOME_THREAD_ID = 'chat_home'
const ID_RE = /^chat_[\w.-]{1,64}$/
const RUN_RE = /^[\w.-]{1,80}$/
const ROLE_OK = new Set(['user', 'assistant', 'system-note'])
const SOURCE_OK = new Set(['desktop', 'telegram', 'both'])
const MAX_TEXT = 4000
const MAX_TURNS = 400

export function chatThreadId(raw) {
  const s = String(raw ?? '').trim()
  return ID_RE.test(s) ? s : null
}

export function jobRunId(raw) {
  const s = String(raw ?? '').trim()
  return RUN_RE.test(s) ? s : null
}

export function telegramChatId(raw) {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isInteger(n) || n === 0 || Math.abs(n) > Number.MAX_SAFE_INTEGER) return null
  return n
}

export function isTelegramGroupChat(raw) {
  const n = telegramChatId(raw)
  return n != null && n < 0
}

export function newThreadId() {
  const id = `chat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return chatThreadId(id) || HOME_THREAD_ID
}

function ensureDir(root) {
  const d = join(root, 'data', 'conversations')
  mkdirSync(d, { recursive: true })
  return d
}

function threadRel(id) {
  const safe = chatThreadId(id)
  if (!safe) throw new Error('bad thread id')
  return `data/conversations/${safe}.json`
}

function readJson(p, fallback) {
  if (!existsSync(p)) return fallback
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'))
    return raw
  } catch {
    return fallback
  }
}

function takeTurn(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const role = ROLE_OK.has(raw.role) ? raw.role : null
  if (!role) return null
  const text = redactCloudText(stripActivityText(raw.text, MAX_TEXT))
  if (!text && role !== 'system-note') return null
  const at = Number.isFinite(Number(raw.at)) ? Number(raw.at) : Date.now()
  const rec = { role, text, at }
  const runId = jobRunId(raw.runId)
  if (runId) rec.runId = runId
  return rec
}

function summaryOf(thread) {
  const rec = {
    id: thread.id,
    title: stripActivityText(thread.title, 80) || thread.id,
    updatedAt: Number(thread.updatedAt) || 0,
    source: SOURCE_OK.has(thread.source) ? thread.source : 'desktop'
  }
  const tg = telegramChatId(thread.telegramChatId)
  if (tg != null) rec.telegramChatId = tg
  if (thread.archived === true) rec.archived = true
  return rec
}

function writeThread(root, thread) {
  const safe = chatThreadId(thread.id)
  if (!safe) throw new Error('bad thread id')
  ensureDir(root)
  const turns = []
  const arr = Array.isArray(thread.turns) ? thread.turns : []
  for (const row of arr) {
    const turn = takeTurn(row)
    if (turn) turns.push(turn)
    if (turns.length >= MAX_TURNS) break
  }
  const rec = {
    id: safe,
    title: stripActivityText(thread.title, 80) || safe,
    createdAt: Number(thread.createdAt) || Date.now(),
    updatedAt: Number(thread.updatedAt) || Date.now(),
    source: SOURCE_OK.has(thread.source) ? thread.source : 'desktop',
    turns
  }
  const tg = telegramChatId(thread.telegramChatId)
  if (tg != null) rec.telegramChatId = tg
  if (thread.archived === true) rec.archived = true
  const abs = assertInside(root, threadRel(safe))
  writeFileSync(abs, JSON.stringify(rec, null, 2), 'utf8')
  return rec
}

function rebuildIndex(root) {
  const dir = ensureDir(root)
  const out = []
  const seen = new Set()
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json') || name === 'index.json' || name === 'active.json') continue
    const id = chatThreadId(name.slice(0, -5))
    if (!id || seen.has(id)) continue
    seen.add(id)
    const t = getThread(root, id)
    if (t) out.push(summaryOf(t))
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt)
  writeFileSync(join(dir, 'index.json'), JSON.stringify(out, null, 2), 'utf8')
  return out
}

export function getThread(root, id) {
  const safe = chatThreadId(id)
  if (!safe) return null
  const abs = assertInside(root, threadRel(safe))
  const raw = readJson(abs, null)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const turns = []
  const arr = Array.isArray(raw.turns) ? raw.turns : []
  for (const row of arr) {
    const turn = takeTurn(row)
    if (turn) turns.push(turn)
    if (turns.length >= MAX_TURNS) break
  }
  const rec = {
    id: safe,
    title: stripActivityText(raw.title, 80) || safe,
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    source: SOURCE_OK.has(raw.source) ? raw.source : 'desktop',
    turns
  }
  const tg = telegramChatId(raw.telegramChatId)
  if (tg != null) rec.telegramChatId = tg
  if (raw.archived === true) rec.archived = true
  return rec
}

export function ensureHomeThread(root) {
  ensureDir(root)
  const existing = getThread(root, HOME_THREAD_ID)
  if (existing) return existing
  return writeThread(root, {
    id: HOME_THREAD_ID,
    title: 'Home',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: 'desktop',
    turns: []
  })
}

export function listThreads(root) {
  ensureHomeThread(root)
  return rebuildIndex(root).filter((row) => row.archived !== true)
}

export function archiveThread(root, id) {
  const safe = chatThreadId(id)
  if (!safe) throw new Error('bad thread id')
  const thread = getThread(root, safe)
  if (!thread) throw new Error('missing thread')
  thread.archived = true
  thread.updatedAt = Date.now()
  const next = writeThread(root, thread)
  rebuildIndex(root)
  return next
}

export function deleteThread(root, id) {
  const safe = chatThreadId(id)
  if (!safe || safe === HOME_THREAD_ID) throw new Error('refused')
  const abs = assertInside(root, threadRel(safe))
  if (existsSync(abs)) unlinkSync(abs)
  rebuildIndex(root)
  const active = loadActiveThreadId(root)
  if (active === safe) saveActiveThreadId(root, HOME_THREAD_ID)
  return { ok: true, id: safe }
}

export function createThread(root, title, source = 'desktop') {
  ensureHomeThread(root)
  const thread = writeThread(root, {
    id: newThreadId(),
    title: stripActivityText(title, 80) || 'New agent',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: SOURCE_OK.has(source) ? source : 'desktop',
    turns: []
  })
  rebuildIndex(root)
  return thread
}

export function renameThread(root, id, title) {
  const thread = getThread(root, id)
  if (!thread) throw new Error('missing thread')
  thread.title = stripActivityText(title, 80) || thread.title
  thread.updatedAt = Date.now()
  const next = writeThread(root, thread)
  rebuildIndex(root)
  return next
}

export function appendTurn(root, id, turn) {
  let thread = getThread(root, id)
  if (!thread && id === HOME_THREAD_ID) thread = ensureHomeThread(root)
  if (!thread) throw new Error('missing thread')
  const next = takeTurn({ ...turn, at: turn?.at ?? Date.now() })
  if (!next) throw new Error('bad turn')
  if (next.runId) {
    const dup = thread.turns.some((t) => t.runId === next.runId && t.role === next.role && t.text === next.text)
    if (dup) return thread
  }
  thread.turns.push(next)
  if (thread.turns.length > MAX_TURNS) thread.turns = thread.turns.slice(-MAX_TURNS)
  thread.updatedAt = next.at
  const saved = writeThread(root, thread)
  rebuildIndex(root)
  return saved
}

export function bindTelegram(root, id, chatId) {
  const tid = telegramChatId(chatId)
  if (tid == null) throw new Error('bad telegram chat')
  const thread = getThread(root, id) || (id === HOME_THREAD_ID ? ensureHomeThread(root) : null)
  if (!thread) throw new Error('missing thread')
  for (const row of listThreads(root)) {
    if (row.telegramChatId === tid && row.id !== thread.id) {
      const other = getThread(root, row.id)
      if (other) {
        delete other.telegramChatId
        if (other.source === 'telegram') other.source = 'desktop'
        if (other.source === 'both') other.source = 'desktop'
        writeThread(root, other)
      }
    }
  }
  thread.telegramChatId = tid
  thread.source = 'both'
  thread.updatedAt = Date.now()
  const saved = writeThread(root, thread)
  rebuildIndex(root)
  return saved
}

export function threadForTelegram(root, chatId, opts = {}) {
  const tid = telegramChatId(chatId)
  if (tid == null) throw new Error('bad telegram chat')
  for (const row of listThreads(root)) {
    if (row.telegramChatId === tid) return getThread(root, row.id)
  }
  const group = opts.group === true || (opts.group !== false && tid < 0)
  if (group) {
    const title = stripActivityText(opts.title, 80) || 'Telegram group'
    const extra = createThread(root, title, 'telegram')
    return bindTelegram(root, extra.id, tid)
  }
  const home = ensureHomeThread(root)
  if (!home.telegramChatId) return bindTelegram(root, home.id, tid)
  const extra = createThread(root, 'Telegram', 'telegram')
  return bindTelegram(root, extra.id, tid)
}

export function loadActiveThreadId(root) {
  ensureHomeThread(root)
  const p = join(ensureDir(root), 'active.json')
  const raw = readJson(p, null)
  const id = chatThreadId(raw?.id)
  if (id && getThread(root, id)) return id
  return HOME_THREAD_ID
}

export function saveActiveThreadId(root, id) {
  const safe = chatThreadId(id)
  if (!safe) throw new Error('bad thread id')
  if (!getThread(root, safe) && safe !== HOME_THREAD_ID) throw new Error('missing thread')
  writeFileSync(join(ensureDir(root), 'active.json'), JSON.stringify({ id: safe }), 'utf8')
  return safe
}

export function formatChatLog(thread, n = 16) {
  if (!thread || !Array.isArray(thread.turns)) return ''
  return thread.turns
    .filter((t) => t.role === 'user' || t.role === 'assistant')
    .slice(-Math.max(1, Number(n) || 16))
    .map((t) => `${t.role}: ${t.text.slice(0, 400)}`)
    .join('\n')
}

export function turnsToLogItems(thread) {
  if (!thread || !Array.isArray(thread.turns)) return []
  return thread.turns.map((t, i) => ({
    id: `${thread.id}_${i}`,
    kind: t.role === 'user' ? 'user' : t.role === 'assistant' ? 'assistant' : 'status',
    text: t.text
  }))
}

export function ragExcerpt(thread) {
  if (!thread) return ''
  const last = [...thread.turns].reverse().find((t) => t.role === 'assistant')
  const title = stripActivityText(thread.title, 80) || thread.id
  const body = last ? last.text.slice(0, 2000) : ''
  return `# ${title}\n\n${body}\n`
}

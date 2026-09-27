import { chatThreadId, telegramChatId } from './conversations.mjs'
import { inboxName } from './inbox.mjs'
import { knowledgeSlug } from './knowledge-write.mjs'
import { takeMind } from './mind.mjs'
import { isPeer, normalizePairCode, telegramUserId } from './telegram-auth.mjs'
import { stripActivityText } from './activity.mjs'
import { telegramFileId } from './telegram-api.mjs'
import { dockKind } from './telegram-chrome.mjs'
import { takeFleetCommand } from './fleet.mjs'

const MODES = new Set(['ask', 'think', 'agent', 'plan', 'debug', 'multitask'])
const GROUP_TYPES = new Set(['group', 'supergroup'])
const ROOM_TYPES = new Set(['private', 'group', 'supergroup'])
const BOT_NAME_RE = /^[A-Za-z0-9_]{5,32}$/

export function parseCallback(data) {
  const s = String(data || '')
  const m = s.match(/^([a-z]{1,16}):([\w.-]{1,80})(?::([\w.-]{1,80}))?$/)
  if (!m) return null
  return { kind: m[1], id: m[2], extra: m[3] }
}

export function botUsernameOf(ctx) {
  const u = String(ctx?.bot?.username || '').replace(/^@/, '')
  return BOT_NAME_RE.test(u) ? u : ''
}

export function takeBotIdentity(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const id = telegramUserId(raw.id)
  const username = botUsernameOf({ bot: raw })
  if (id == null || !username) return null
  return { id, username }
}

function messagePlain(msg) {
  return String(msg?.text || msg?.caption || '')
}

function messageEntities(msg) {
  if (Array.isArray(msg?.entities) && msg.entities.length) return msg.entities
  if (Array.isArray(msg?.caption_entities)) return msg.caption_entities
  return []
}

export function takeTelegramInbox(msg) {
  if (!msg || typeof msg !== 'object') return null
  const doc = msg.document
  const photos = msg.photo
  let fileId = null
  let name = ''
  let size = 0
  if (doc && typeof doc === 'object') {
    fileId = telegramFileId(doc.file_id)
    name = inboxName(doc.file_name) || ''
    size = Number(doc.file_size) || 0
  } else if (Array.isArray(photos) && photos.length) {
    const last = photos[photos.length - 1]
    if (!last || typeof last !== 'object') return null
    fileId = telegramFileId(last.file_id)
    name = 'photo.jpg'
    size = Number(last.file_size) || 0
  } else if (msg.voice && typeof msg.voice === 'object') {
    fileId = telegramFileId(msg.voice.file_id)
    name = 'voice.ogg'
    size = Number(msg.voice.file_size) || 0
  } else if (msg.audio && typeof msg.audio === 'object') {
    fileId = telegramFileId(msg.audio.file_id)
    name = inboxName(msg.audio.file_name) || 'audio.mp3'
    size = Number(msg.audio.file_size) || 0
  }
  if (!fileId || !name) return null
  if (size > 2_000_000) return null
  return { fileId, name, size }
}

function topicIdOf(msg, cb) {
  const raw = msg?.message_thread_id ?? cb?.message?.message_thread_id
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0 || n > 1_000_000_000_000) return undefined
  return n
}

function chatTitleOf(chat) {
  return stripActivityText(chat?.title, 80) || ''
}

function base(from, chatId, extra = {}) {
  const rec = { from, chatId }
  if (extra.topicId) rec.topicId = extra.topicId
  if (extra.surface) rec.surface = extra.surface
  if (extra.chatTitle) rec.chatTitle = extra.chatTitle
  return rec
}

function commandTargetsUs(text, ctx) {
  const m = String(text || '').match(/^\/[A-Za-z][\w]{0,31}(?:@([A-Za-z0-9_]{5,32}))?(?:\s|$)/)
  if (!m) return true
  const at = m[1]
  if (!at) return true
  const me = botUsernameOf(ctx)
  if (!me) return true
  return at.toLowerCase() === me.toLowerCase()
}

export function groupAddressed(update, ctx = {}) {
  const msg = update?.message
  const text = messagePlain(msg)
  if (/^\/[A-Za-z]/.test(text)) return commandTargetsUs(text, ctx)
  const me = botUsernameOf(ctx)
  const botId = telegramUserId(ctx.bot?.id)
  const replyFrom = telegramUserId(msg?.reply_to_message?.from?.id)
  if (botId && replyFrom === botId) return true
  if (me && new RegExp(`(^|[\\s])@${me}\\b`, 'i').test(text)) return true
  const ents = messageEntities(msg)
  for (const e of ents) {
    if (!e || typeof e !== 'object') continue
    const off = Number(e.offset)
    const len = Number(e.length)
    if (
      e.type === 'mention' &&
      me &&
      Number.isInteger(off) &&
      Number.isInteger(len) &&
      off >= 0 &&
      len > 0 &&
      off + len <= text.length
    ) {
      const slice = text.slice(off, off + len).replace(/^@/, '')
      if (slice.toLowerCase() === me.toLowerCase()) return true
    }
    if (e.type === 'text_mention' && botId && telegramUserId(e.user?.id) === botId) return true
    if (e.type === 'bot_command') return commandTargetsUs(text, ctx)
  }
  return false
}

function stripBotMention(text, ctx) {
  const me = botUsernameOf(ctx)
  let s = String(text || '')
  if (me) s = s.replace(new RegExp(`@${me}\\b`, 'gi'), '')
  return s.replace(/\s+/g, ' ').trim()
}

export function routeTelegram(update, ctx = {}) {
  const mm = update?.my_chat_member
  if (mm) {
    const chatId = telegramChatId(mm.chat?.id)
    const type = String(mm.chat?.type || '')
    const status = String(mm.new_chat_member?.status || '')
    if (chatId == null || !GROUP_TYPES.has(type)) return { kind: 'ignore' }
    if (status === 'member' || status === 'administrator') {
      return {
        kind: 'group-hello',
        chatId,
        surface: 'group',
        chatTitle: chatTitleOf(mm.chat)
      }
    }
    return { kind: 'ignore' }
  }

  const msg = update?.message
  const cb = update?.callback_query
  const from = telegramUserId(msg?.from?.id ?? cb?.from?.id)
  const chatId = telegramChatId(msg?.chat?.id ?? cb?.message?.chat?.id)
  const chatType = String(msg?.chat?.type ?? cb?.message?.chat?.type ?? '')
  if (from == null || chatId == null) return { kind: 'ignore' }
  if (chatType && !ROOM_TYPES.has(chatType)) return { kind: 'ignore' }
  const group = GROUP_TYPES.has(chatType)
  const extra = {
    topicId: topicIdOf(msg, cb),
    surface: group ? 'group' : 'private',
    chatTitle: chatTitleOf(msg?.chat ?? cb?.message?.chat)
  }

  if (cb) {
    if (!isPeer(ctx.state, from)) return { kind: 'deny', ack: 'no', callbackId: String(cb.id || '') }
    const parsed = parseCallback(cb.data)
    if (!parsed) return { kind: 'deny', ack: 'bad', callbackId: String(cb.id || ''), ...base(from, chatId, extra) }
    return {
      kind: 'callback',
      callbackId: String(cb.id || ''),
      ...base(from, chatId, extra),
      action: parsed.kind,
      id: parsed.id,
      extra: parsed.extra
    }
  }

  const text = messagePlain(msg).trim()
  const inbox = takeTelegramInbox(msg)
  if (!text && !inbox) return { kind: 'ignore' }

  if (group && !groupAddressed(update, ctx)) {
    const pendingBody = Boolean(ctx.pending && isPeer(ctx.state, from) && !text.startsWith('/'))
    if (!pendingBody) return { kind: 'ignore' }
  }

  if (/^\/start(?:@\w+)?$/i.test(text)) {
    if (isPeer(ctx.state, from)) return { kind: 'help', ...base(from, chatId, extra) }
    return { kind: 'need-pair', ...base(from, chatId, extra) }
  }

  const pair = text.match(/^\/pair(?:@\w+)?\s+(\S+)/i)
  if (pair) {
    if (group) return { kind: 'pair-dm', ...base(from, chatId, extra) }
    return { kind: 'pair', ...base(from, chatId, extra), code: normalizePairCode(pair[1]) }
  }

  if (!isPeer(ctx.state, from)) {
    if (group) return { kind: 'ignore' }
    return { kind: 'deny', ack: 'no', ...base(from, chatId, extra) }
  }

  const dock = dockKind(text)
  if (dock) return { kind: dock, ...base(from, chatId, extra) }

  if (/^\/menu(?:@\w+)?$/i.test(text)) return { kind: 'menu', ...base(from, chatId, extra) }

  if (ctx.pending?.kind === 'skill-new' && text && !text.startsWith('/')) {
    return { kind: 'skill-body', ...base(from, chatId, extra), name: ctx.pending.name, body: text.slice(0, 12_000) }
  }
  if (ctx.pending?.kind === 'rule-new' && text && !text.startsWith('/')) {
    return { kind: 'rule-body', ...base(from, chatId, extra), name: ctx.pending.name, body: text.slice(0, 8_000) }
  }

  if (/^\/help(?:@\w+)?$/i.test(text)) return { kind: 'help', ...base(from, chatId, extra) }
  if (/^\/status(?:@\w+)?$/i.test(text)) return { kind: 'status', ...base(from, chatId, extra) }
  if (/^\/stage(?:@\w+)?$/i.test(text)) return { kind: 'stage', ...base(from, chatId, extra) }
  if (/^\/stop(?:@\w+)?$/i.test(text)) return { kind: 'stop', ...base(from, chatId, extra) }
  if (/^\/tasks(?:@\w+)?$/i.test(text)) return { kind: 'tasks', ...base(from, chatId, extra) }
  if (/^\/skills(?:@\w+)?$/i.test(text)) return { kind: 'skills', ...base(from, chatId, extra) }
  if (/^\/rules(?:@\w+)?$/i.test(text)) return { kind: 'rules', ...base(from, chatId, extra) }
  if (/^\/chats(?:@\w+)?$/i.test(text)) return { kind: 'chats', ...base(from, chatId, extra) }
  if (/^\/settings(?:@\w+)?$/i.test(text)) return { kind: 'settings', ...base(from, chatId, extra) }
  if (/^\/tools(?:@\w+)?$/i.test(text)) return { kind: 'tools', ...base(from, chatId, extra) }
  if (/^\/mcp(?:@\w+)?(?:\s+reload)?$/i.test(text)) return { kind: 'mcp-reload', ...base(from, chatId, extra) }
  if (/^\/new(?:@\w+)?$/i.test(text)) return { kind: 'new-chat', ...base(from, chatId, extra) }
  if (/^\/app(?:@\w+)?$/i.test(text)) return { kind: 'app', ...base(from, chatId, extra) }
  if (/^\/manage(?:@\w+)?$/i.test(text)) return { kind: 'manage', ...base(from, chatId, extra) }
  if (/^\/cursor(?:@\w+)?$/i.test(text)) return { kind: 'cursor', ...base(from, chatId, extra) }
  if (/^\/llama(?:@\w+)?$/i.test(text)) return { kind: 'llama', ...base(from, chatId, extra) }
  if (/^\/mind(?:@\w+)?$/i.test(text)) return { kind: 'health', ...base(from, chatId, extra) }

  const fleetCmd = takeFleetCommand(text)
  if (fleetCmd) {
    if (fleetCmd.action === 'bad') return { kind: 'deny', ack: 'bad fleet', ...base(from, chatId, extra) }
    const rec = { kind: 'fleet', action: fleetCmd.action, ...base(from, chatId, extra) }
    if (fleetCmd.id) rec.id = fleetCmd.id
    if (fleetCmd.url) rec.text = fleetCmd.url
    if (fleetCmd.rel) rec.rel = fleetCmd.rel
    if (fleetCmd.kind) rec.extra = fleetCmd.kind
    if (fleetCmd.fromId) rec.fromId = fleetCmd.fromId
    return rec
  }

  const mindCmd = text.match(/^\/mind(?:@\w+)?\s+(\S+)/i)
  if (mindCmd) {
    const mind = takeMind(mindCmd[1])
    if (!mind) return { kind: 'deny', ack: 'bad mind', ...base(from, chatId, extra) }
    return { kind: 'mind', ...base(from, chatId, extra), mind }
  }

  const mindWord = takeMind(text)
  if (mindWord && !/\s/.test(text)) return { kind: 'mind', ...base(from, chatId, extra), mind: mindWord }

  const use = text.match(/^\/use(?:@\w+)?\s+(\S+)/i)
  if (use) {
    const threadId = chatThreadId(use[1])
    if (!threadId) return { kind: 'deny', ack: 'bad thread', ...base(from, chatId, extra) }
    return { kind: 'use-chat', ...base(from, chatId, extra), threadId }
  }

  const goal = text.match(/^\/goal(?:@\w+)?\s+([\s\S]*)/i)
  if (goal) return { kind: 'goal', ...base(from, chatId, extra), text: stripActivityText(goal[1], 200) }

  const mode = text.match(/^\/mode(?:@\w+)?\s+(\S+)/i)
  if (mode) {
    const m = mode[1].toLowerCase()
    if (!MODES.has(m)) return { kind: 'deny', ack: 'bad mode', ...base(from, chatId, extra) }
    return { kind: 'mode', ...base(from, chatId, extra), mode: m }
  }

  const doCmd = text.match(/^\/(?:do|agent)(?:@\w+)?\s+([\s\S]+)/i)
  if (doCmd) return { kind: 'run', ...base(from, chatId, extra), mode: 'agent', task: doCmd[1].slice(0, 8000) }

  const think = text.match(/^\/think(?:@\w+)?\s+([\s\S]+)/i)
  if (think) return { kind: 'run', ...base(from, chatId, extra), mode: 'think', task: think[1].slice(0, 8000) }

  const ask = text.match(/^\/ask(?:@\w+)?\s+([\s\S]+)/i)
  if (ask) return { kind: 'run', ...base(from, chatId, extra), mode: 'ask', task: ask[1].slice(0, 8000) }

  const extraMode = text.match(/^\/(plan|debug|multitask)(?:@\w+)?\s+([\s\S]+)/i)
  if (extraMode) {
    return { kind: 'run', ...base(from, chatId, extra), mode: extraMode[1].toLowerCase(), task: extraMode[2].slice(0, 8000) }
  }

  const taskAdd = text.match(/^\/task(?:@\w+)?\s+add\s+([\s\S]+)/i)
  if (taskAdd) return { kind: 'task-add', ...base(from, chatId, extra), title: stripActivityText(taskAdd[1], 120) }

  const skillNew = text.match(/^\/skill(?:@\w+)?\s+new\s+(.+)$/i)
  if (skillNew) return { kind: 'skill-new', ...base(from, chatId, extra), name: stripActivityText(skillNew[1], 48) }

  const skillDel = text.match(/^\/skill(?:@\w+)?\s+del\s+(\S+)/i)
  if (skillDel) return { kind: 'skill-del', ...base(from, chatId, extra), slug: knowledgeSlug(skillDel[1]) }

  const ruleNew = text.match(/^\/rule(?:@\w+)?\s+new\s+(.+)$/i)
  if (ruleNew) return { kind: 'rule-new', ...base(from, chatId, extra), name: stripActivityText(ruleNew[1], 48) }

  const ruleDel = text.match(/^\/rule(?:@\w+)?\s+del\s+(\S+)/i)
  if (ruleDel) return { kind: 'rule-del', ...base(from, chatId, extra), slug: knowledgeSlug(ruleDel[1]) }

  if (inbox && !text.startsWith('/')) {
    const caption = stripActivityText(text, 200)
    const rec = { kind: 'inbox-file', ...base(from, chatId, extra), fileId: inbox.fileId, name: inbox.name }
    if (caption) rec.caption = caption
    return rec
  }

  return { kind: 'chat', ...base(from, chatId, extra), task: (stripBotMention(text, ctx) || text).slice(0, 8000), mode: 'ask' }
}

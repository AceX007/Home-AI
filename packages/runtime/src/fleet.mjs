import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertInside } from './paths.mjs'
import { takeGitHttpsUrl } from './git-safe.mjs'

export const FLEET_KINDS = ['telegram-bot', 'website', 'generic']
export const FLEET_RECIPES = ['python-app-main', 'npm-start', 'npm-dev']
export const BOT_ROLES = ['hub', 'worker']
export const SUB_KINDS = ['telegram', 'email']
export const SMTP_PROVIDERS = {
  none: null,
  'proton-bridge': { host: '127.0.0.1', port: 1025 },
  'tuta-smtp': { host: 'smtp.tutanota.com', port: 587 }
}
export const LINK_INFO_REL = 'Repos/Link INFO BOT'
const REG_REL = 'data/fleet/registry.json'
const MAX_REPOS = 24
const MAX_BOTS = 40
const MAX_ACCOUNTS = 20
const MAX_SUBS = 200

export function takeFleetId(raw) {
  const s = String(raw || '').trim().toLowerCase()
  return /^[a-z][a-z0-9-]{1,32}$/.test(s) ? s : null
}

/** Hostname label only. Not a fetch URL, not a clone dest. */
export function takeSiteDomain(raw) {
  const t = String(raw || '').trim().toLowerCase()
  if (!t || t.length > 120) return null
  if (t.includes('..') || /[<>\s\\]/.test(t)) return null
  let host = t
  if (t.startsWith('https://') || t.startsWith('http://')) {
    try {
      const u = new URL(t)
      if (u.username || u.password) return null
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
      host = String(u.hostname || '').toLowerCase()
    } catch {
      return null
    }
  } else if (/[/\\@:?#]/.test(t)) return null
  if (host === 'localhost') return host
  if (host.length > 80) return null
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host)) return null
  return host
}

export function nextCloneId(fromId, ids) {
  const base = takeFleetId(fromId)
  if (!base) return null
  const have = new Set((Array.isArray(ids) ? ids : []).map((x) => takeFleetId(x)).filter(Boolean))
  const stem = base.slice(0, 28)
  for (let n = 2; n < 40; n++) {
    const id = takeFleetId(`${stem}-c${n}`)
    if (id && !have.has(id)) return id
  }
  return null
}

export function stackForest(repos) {
  const list = Array.isArray(repos) ? repos : []
  const nodes = new Map()
  for (const r of list) {
    const id = takeFleetId(r && r.id)
    if (!id) continue
    nodes.set(id, { ...r, id, clones: [] })
  }
  const roots = []
  for (const node of nodes.values()) {
    const parent = takeFleetId(node.cloneOf)
    if (parent && parent !== node.id && nodes.has(parent)) nodes.get(parent).clones.push(node)
    else roots.push(node)
  }
  return roots
}

export function takeFleetKind(raw) {
  const s = String(raw || '')
  return FLEET_KINDS.includes(s) ? s : null
}

export function takeFleetRecipe(raw) {
  const s = String(raw || '')
  return FLEET_RECIPES.includes(s) ? s : null
}

/** Infer kind from an add path. Websites default off telegram-bot recipes. */
export function kindFromAddRel(rel) {
  const s = takeRepoRel(rel)
  if (!s) return null
  return /bot/i.test(s) || s.startsWith('data/fleet/clones/') ? 'telegram-bot' : 'website'
}

export function defaultRecipeForKind(kind) {
  return takeFleetKind(kind) === 'website' ? 'npm-dev' : 'python-app-main'
}

/** Repos/… or data/fleet/clones/… only. Spaces allowed for Link INFO BOT. */
export function takeRepoRel(raw) {
  const s = String(raw || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  if (!s || s.length > 180) return null
  if (s.includes('..') || s.includes('\0') || /[\n\r]/.test(s)) return null
  if (/(^|\/)data\/secrets(\/|$)/i.test(s) || /(^|\/)\.env(\.|$)/i.test(s)) return null
  if (!/^(Repos|data\/fleet\/clones)\/[A-Za-z0-9._ +-]+(?:\/[A-Za-z0-9._ +-]+)*$/.test(s)) return null
  return s
}

export function takeBotRole(raw) {
  const s = String(raw || '')
  return BOT_ROLES.includes(s) ? s : null
}

export function takeBotUsername(raw) {
  const s = String(raw || '').trim().replace(/^@/, '')
  if (!/^[A-Za-z0-9_]{5,32}$/.test(s)) return null
  return s
}

export function takeBotToken(raw) {
  const s = String(raw || '').trim()
  if (s.length < 20 || s.length > 200 || /\s/.test(s) || s.includes('..')) return null
  if (!/^\d{6,12}:[A-Za-z0-9_-]{20,}$/.test(s)) return null
  return s
}

export function maskSecret(raw) {
  const s = String(raw || '')
  if (s.length < 4) return '····'
  return `····${s.slice(-4)}`
}

export function takePlainLine(raw, max = 80) {
  const s = String(raw ?? '')
    .replace(/[<>]/g, '')
    .replace(/[\n\r]/g, ' ')
    .trim()
    .slice(0, max)
  return s || null
}

export function takeBroadcastBody(raw) {
  const s = String(raw ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\0]/g, '')
    .trim()
    .slice(0, 4000)
  if (!s || s.includes('parse_mode')) return null
  return s
}

export function takeTelegramChatId(raw) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n === 0) return null
  const s = String(n)
  if (s.length > 16) return null
  return n
}

export function takeEmail(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (s.length > 120 || s.includes('..') || /[\s<>]/.test(s)) return null
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return null
  return s
}

export function maskEmail(raw) {
  const s = takeEmail(raw)
  if (!s) return '····'
  const [u, d] = s.split('@')
  return `${u.slice(0, 1)}***@${d}`
}

export function takeSmtpProvider(raw) {
  const s = String(raw || 'none')
  return Object.prototype.hasOwnProperty.call(SMTP_PROVIDERS, s) ? s : null
}

export function smtpEndpoint(provider) {
  const p = takeSmtpProvider(provider)
  return p && SMTP_PROVIDERS[p] ? { ...SMTP_PROVIDERS[p] } : null
}

/** Renderer cannot pick a host. Only Proton Bridge loopback or Tuta SMTP. */
export function takeSmtpHop(host, port) {
  const h = String(host || '')
  const p = Number(port)
  for (const key of Object.keys(SMTP_PROVIDERS)) {
    const ep = SMTP_PROVIDERS[key]
    if (ep && ep.host === h && ep.port === p) return { host: ep.host, port: ep.port }
  }
  return null
}

export function takeAccountLabel(raw) {
  return takePlainLine(raw, 40)
}

/** Fixed argv. Renderer never chooses the binary string. */
export function recipeSpawn(recipe) {
  const r = takeFleetRecipe(recipe)
  if (r === 'python-app-main') return { bin: 'python3', args: ['-m', 'app.main'] }
  if (r === 'npm-start') return { bin: 'npm', args: ['start'] }
  if (r === 'npm-dev') return { bin: 'npm', args: ['run', 'dev'] }
  return null
}

export function redactFleetLog(text) {
  return String(text || '')
    .replace(/\d{6,12}:[A-Za-z0-9_-]{20,}/g, '[redacted]')
    .replace(/HUB_BOT_TOKEN=\S+/g, 'HUB_BOT_TOKEN=[redacted]')
    .replace(/TEST_BOT_TOKENS=\S+/g, 'TEST_BOT_TOKENS=[redacted]')
    .slice(-12_000)
}

export function rotationNotice(username) {
  const u = takeBotUsername(username)
  if (!u) return null
  return `New bot: https://t.me/${u}\nSave this link. Older hubs may go down.`
}

export function emptyRegistry() {
  return {
    repos: [],
    bots: [],
    accounts: [],
    subscribers: [],
    smtp: { provider: 'none', user: '' }
  }
}

function takeRepoRow(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const id = takeFleetId(raw.id)
  const rel = takeRepoRel(raw.rel)
  const kind = takeFleetKind(raw.kind) || 'generic'
  const recipe = takeFleetRecipe(raw.recipe) || 'python-app-main'
  const title = takePlainLine(raw.title, 80) || id
  const cloneOf = takeFleetId(raw.cloneOf)
  const domain = takeSiteDomain(raw.domain)
  if (!id || !rel) return null
  const row = { id, title, kind, rel, recipe }
  if (cloneOf && cloneOf !== id) row.cloneOf = cloneOf
  if (domain) row.domain = domain
  return row
}

function takeBotRow(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const id = takeFleetId(raw.id)
  const role = takeBotRole(raw.role) || 'worker'
  const repoId = takeFleetId(raw.repoId)
  const username = takeBotUsername(raw.username)
  if (!id || !repoId) return null
  const row = { id, role, repoId, hasToken: Boolean(raw.hasToken) }
  if (username) row.username = username
  if (raw.last4 && typeof raw.last4 === 'string') row.last4 = String(raw.last4).replace(/[^\w]/g, '').slice(-4)
  return row
}

function takeAccountRow(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const id = takeFleetId(raw.id)
  const label = takeAccountLabel(raw.label) || id
  if (!id) return null
  const row = { id, label, hasSession: Boolean(raw.hasSession) }
  if (raw.last4 && typeof raw.last4 === 'string') row.last4 = String(raw.last4).replace(/[^\w]/g, '').slice(-4)
  return row
}

function takeSubRow(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const kind = SUB_KINDS.includes(String(raw.kind || '')) ? raw.kind : null
  const botId = takeFleetId(raw.botId)
  if (kind === 'telegram') {
    const chatId = takeTelegramChatId(raw.chatId)
    if (chatId == null) return null
    const row = { kind, chatId }
    if (botId) row.botId = botId
    return row
  }
  if (kind === 'email') {
    const email = takeEmail(raw.email)
    if (!email) return null
    return { kind, email }
  }
  return null
}

export function takeRegistry(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const repos = []
  const seen = new Set()
  for (const row of Array.isArray(src.repos) ? src.repos : []) {
    if (repos.length >= MAX_REPOS) break
    const r = takeRepoRow(row)
    if (!r || seen.has(r.id)) continue
    seen.add(r.id)
    repos.push(r)
  }
  const bots = []
  const seenB = new Set()
  for (const row of Array.isArray(src.bots) ? src.bots : []) {
    if (bots.length >= MAX_BOTS) break
    const b = takeBotRow(row)
    if (!b || seenB.has(b.id)) continue
    seenB.add(b.id)
    bots.push(b)
  }
  const accounts = []
  const seenA = new Set()
  for (const row of Array.isArray(src.accounts) ? src.accounts : []) {
    if (accounts.length >= MAX_ACCOUNTS) break
    const a = takeAccountRow(row)
    if (!a || seenA.has(a.id)) continue
    seenA.add(a.id)
    accounts.push(a)
  }
  const subscribers = []
  for (const row of Array.isArray(src.subscribers) ? src.subscribers : []) {
    if (subscribers.length >= MAX_SUBS) break
    const s = takeSubRow(row)
    if (s) subscribers.push(s)
  }
  const smtpRaw = src.smtp && typeof src.smtp === 'object' ? src.smtp : {}
  const smtp = {
    provider: takeSmtpProvider(smtpRaw.provider) || 'none',
    user: takeEmail(smtpRaw.user) || ''
  }
  return { repos, bots, accounts, subscribers, smtp }
}

export function seedLinkInfo(reg, existsRel) {
  const next = takeRegistry(reg)
  const hit = typeof existsRel === 'function' ? existsRel(LINK_INFO_REL + '/app/main.py') : false
  if (hit && !next.repos.some((r) => r.id === 'link-info')) {
    next.repos.unshift({
      id: 'link-info',
      title: 'Link INFO hub',
      kind: 'telegram-bot',
      rel: LINK_INFO_REL,
      recipe: 'python-app-main'
    })
  }
  return next
}

export function registryPath(root) {
  return assertInside(root, REG_REL)
}

export function loadRegistry(root) {
  mkdirSync(join(root, 'data', 'fleet'), { recursive: true })
  const p = registryPath(root)
  let raw = emptyRegistry()
  if (existsSync(p)) {
    try {
      raw = JSON.parse(readFileSync(p, 'utf8'))
    } catch {
      raw = emptyRegistry()
    }
  }
  const existsRel = (rel) => {
    try {
      return existsSync(assertInside(root, rel))
    } catch {
      return false
    }
  }
  const next = seedLinkInfo(takeRegistry(raw), existsRel)
  writeFileSync(p, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}

export function saveRegistry(root, raw) {
  const next = takeRegistry(raw)
  mkdirSync(join(root, 'data', 'fleet'), { recursive: true })
  writeFileSync(registryPath(root), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}

export function publicSnapshot(reg, live = {}) {
  const r = takeRegistry(reg)
  const running = live && typeof live === 'object' ? live : {}
  return {
    repos: r.repos.map((row) => ({
      ...row,
      running: Boolean(running[row.id]),
      pid: running[row.id] ? Number(running[row.id]) || true : false
    })),
    bots: r.bots.map((b) => ({
      id: b.id,
      role: b.role,
      repoId: b.repoId,
      username: b.username || '',
      hasToken: Boolean(b.hasToken),
      last4: b.last4 || (b.hasToken ? '····' : '')
    })),
    accounts: r.accounts.map((a) => ({
      id: a.id,
      label: a.label,
      hasSession: Boolean(a.hasSession),
      last4: a.last4 || ''
    })),
    subscribers: r.subscribers.map((s) =>
      s.kind === 'email'
        ? { kind: 'email', email: maskEmail(s.email) }
        : { kind: 'telegram', chatId: s.chatId, botId: s.botId || '' }
    ),
    smtp: {
      provider: r.smtp.provider,
      user: r.smtp.user ? maskEmail(r.smtp.user) : '',
      hasPass: Boolean(live.smtpPass)
    },
    recipes: FLEET_RECIPES.slice(),
    kinds: FLEET_KINDS.slice(),
    smtpProviders: Object.keys(SMTP_PROVIDERS)
  }
}

export function botSecretRel(id) {
  const i = takeFleetId(id)
  if (!i) return null
  return `data/secrets/fleet/bot-${i}.key`
}

export function accountSecretRel(id) {
  const i = takeFleetId(id)
  if (!i) return null
  return `data/secrets/fleet/acct-${i}.session`
}

export function smtpSecretRel() {
  return 'data/secrets/fleet/smtp.key'
}

export { takeGitHttpsUrl }

export function idFromCloneUrl(url) {
  const u = takeGitHttpsUrl(url)
  if (!u) return null
  const base = u.replace(/\/+$/, '').split('/').pop() || ''
  let slug = base
    .replace(/\.git$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  if (!slug) return null
  if (!/^[a-z]/.test(slug)) slug = `r${slug}`.slice(0, 32)
  return takeFleetId(slug)
}

/** Phone / Mini App fleet verbs. Never accepts a bot token. */
export function takeFleetCommand(text) {
  const raw = String(text || '').trim()
  if (!/^\/fleet(?:@[A-Za-z0-9_]{5,32})?(?:\s|$)/i.test(raw)) return null
  const rest = raw.replace(/^\/fleet(?:@[A-Za-z0-9_]{5,32})?\s*/i, '').trim()
  if (!rest) return { action: 'status' }
  const verb = rest.split(/\s+/, 1)[0].toLowerCase()
  const tail = rest.slice(verb.length).trim()
  if (verb === 'status' || verb === 'list') return { action: 'status' }
  if (verb === 'help') return { action: 'help' }
  if (verb === 'sub' || verb === 'subscribe') return { action: 'sub' }
  if (verb === 'token' || verb === 'bot' || verb === 'secret' || verb === 'key') return { action: 'denied-token' }
  if (verb === 'start' || verb === 'stop' || verb === 'restart') {
    const id = takeFleetId(tail.split(/\s+/)[0])
    if (!id) return { action: 'bad' }
    return { action: verb, id }
  }
  if (verb === 'fork' || verb === 'cloneof') {
    const bits = tail.split(/\s+/)
    const fromId = takeFleetId(bits[0])
    if (!fromId) return { action: 'bad' }
    const id = takeFleetId(bits[1])
    return id ? { action: 'clone-local', fromId, id } : { action: 'clone-local', fromId }
  }
  if (verb === 'clone') {
    const bits = tail.split(/\s+/)
    const url = takeGitHttpsUrl(bits[0])
    if (!url) return { action: 'bad' }
    const id = takeFleetId(bits[1]) || idFromCloneUrl(url)
    const kind = takeFleetKind(bits[2]) || 'website'
    const recipe = takeFleetRecipe(bits[3]) || (kind === 'telegram-bot' ? 'python-app-main' : 'npm-dev')
    if (!id) return { action: 'bad' }
    return { action: 'clone', url, id, kind, recipe }
  }
  if (verb === 'add' || verb === 'repo') {
    const bits = tail.split(/\s+/)
    const id = takeFleetId(bits[0])
    const rel = takeRepoRel(bits.slice(1).join(' '))
    if (!id || !rel) return { action: 'bad' }
    const kind = kindFromAddRel(rel) || 'website'
    const recipe = defaultRecipeForKind(kind)
    return { action: 'add', id, rel, kind, recipe }
  }
  return { action: 'help' }
}

export function filterSubscribers(subs, raw) {
  const kind = raw && raw.kind === 'email' ? 'email' : 'telegram'
  const chatId = takeTelegramChatId(raw && raw.chatId)
  const email = takeEmail(raw && raw.email)
  return (Array.isArray(subs) ? subs : []).filter((s) => {
    if (!s || s.kind !== kind) return true
    if (kind === 'telegram') return s.chatId !== chatId
    return s.email !== email
  })
}

/** Plain fleet card. No tokens, no other subscribers' chat ids. */
export function fleetCard(snap) {
  const s = snap && typeof snap === 'object' && !Array.isArray(snap) ? snap : {}
  const repos = Array.isArray(s.repos) ? s.repos : []
  const bots = Array.isArray(s.bots) ? s.bots : []
  const lines = ['Stacks on this machine. Bot tokens stay on the PC Fleet pane.']
  const walk = (nodes, depth) => {
    const list = Array.isArray(nodes) ? nodes : []
    for (const r of list.slice(0, depth ? 8 : 12)) {
      const id = takeFleetId(r.id)
      if (!id) continue
      const on = r.running ? 'run' : 'off'
      const kind = takeFleetKind(r.kind) || ''
      const domain = takeSiteDomain(r.domain)
      const pad = depth ? `${'  '.repeat(depth)}` : ''
      lines.push(`${pad}${on}  ${id}${kind ? `  ${kind}` : ''}${domain ? `  ${domain}` : ''}`)
      if (depth < 4 && Array.isArray(r.clones) && r.clones.length) walk(r.clones, depth + 1)
    }
  }
  walk(stackForest(repos), 0)
  if (!repos.length) lines.push('No repos yet. /fleet clone https://… id')
  for (const b of bots.slice(0, 12)) {
    const id = takeFleetId(b.id)
    if (!id) continue
    const user = takeBotUsername(b.username) || '—'
    const last4 = String(b.last4 || '').replace(/[^\w]/g, '').slice(-4)
    lines.push(`bot  ${id}  @${user}${last4 ? ` ····${last4}` : ''}`)
  }
  const nSub = Array.isArray(s.subscribers) ? s.subscribers.length : 0
  lines.push(`subs ${nSub} · this chat /fleet sub`)
  lines.push('·')
  lines.push('/fleet clone https://… id [website|telegram-bot]')
  lines.push('/fleet fork <id> [new-id]')
  lines.push('/fleet add <id> Repos/name')
  lines.push('/fleet start|stop|restart <id>')
  const text = redactFleetLog(lines.join('\n')).replace(/[<>]/g, '')
  if (/\d{6,12}:[A-Za-z0-9_-]{20,}/.test(text)) return 'FLEET  (redacted)'
  return text.slice(0, 2500)
}

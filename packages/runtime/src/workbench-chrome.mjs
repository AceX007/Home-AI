import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { stripActivityText } from './activity.mjs'
import { takeMind } from './mind.mjs'
import { assertInside } from './paths.mjs'
import { takeMode, plainLine } from './telegram-chrome.mjs'
import { redactCloudText } from './think.mjs'

export const ACTIVITIES = [
  'files',
  'search',
  'git',
  'notes',
  'board',
  'library',
  'qa',
  'browser',
  'maps',
  'mods',
  'settings',
  'telegram',
  'design',
  'fleet'
]
export const BOTTOM_TABS = ['problems', 'output', 'debug', 'runtime', 'terminal', 'ports', 'shells']
export const SPLITS = ['off', 'side', 'below']
export const LAYOUT_MODES = ['dock', 'stage', 'focus']
export const DENSITIES = ['compact', 'comfortable', 'spacious']
export const COMMAND_IDS = [
  'files',
  'search',
  'git',
  'notes',
  'board',
  'design',
  'library',
  'qa',
  'web',
  'maps',
  'mods',
  'telegram',
  'settings',
  'fleet',
  'goto',
  'goto-symbol',
  'inline',
  'llm',
  'unload',
  'folder',
  'term',
  'chat',
  'mode',
  'think',
  'save',
  'split',
  'halt',
  'mind-local',
  'mind-cloud',
  'mind-cursor',
  'review',
  'accept-all',
  'problems',
  'output',
  'ports',
  'kernel',
  'runtime',
  'layout-dock',
  'layout-stage',
  'layout-focus',
  'new-chat',
  'skills',
  'tools',
  'stage',
  'layout',
  'density',
  'trust'
]
export const PORT_NAMES = ['llama', 'coder', 'miniapp', 'mcp', 'inspect']

const ACTIVITY_OK = new Set(ACTIVITIES)
const BOTTOM_OK = new Set(BOTTOM_TABS)
const SPLIT_OK = new Set(SPLITS)
const COMMAND_OK = new Set(COMMAND_IDS)
const PORT_OK = new Set(PORT_NAMES)
const LAYOUT_OK = new Set(LAYOUT_MODES)
const DENSITY_OK = new Set(DENSITIES)
const LLAMA = new Set(['on', 'off', 'missing'])
const SECRET_RE = /(^|\/)data\/secrets(\/|$)/i
const KEY_RE = /\.key$/i
const ENV_RE = /(^|\/)\.env(\.|$)/

export function layoutFile() {
  return join('data', 'workbench.json')
}

export function takeActivity(raw) {
  return typeof raw === 'string' && ACTIVITY_OK.has(raw) ? raw : null
}

export function takeBottomTab(raw) {
  return typeof raw === 'string' && BOTTOM_OK.has(raw) ? raw : null
}

export function takeSplit(raw) {
  return typeof raw === 'string' && SPLIT_OK.has(raw) ? raw : null
}

export function takeLayoutMode(raw) {
  return typeof raw === 'string' && LAYOUT_OK.has(raw) ? raw : null
}

export function takeDensity(raw) {
  return typeof raw === 'string' && DENSITY_OK.has(raw) ? raw : null
}

export function takeCowork(raw) {
  if (raw === true) return true
  if (raw === false) return false
  return null
}

export function takeCrumbs(rel) {
  const safe = takeWorkspaceRel(rel)
  if (!safe) return []
  const out = []
  for (const part of safe.split('/')) {
    const name = stripActivityText(part, 48)
    if (!name || name.includes('..')) continue
    out.push(name)
    if (out.length >= 12) break
  }
  return out
}

export function takeCommandId(raw) {
  return typeof raw === 'string' && COMMAND_OK.has(raw) ? raw : null
}

export function takeWorkspaceRel(raw) {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s || s.includes('\\') || s.startsWith('/') || /^[a-zA-Z]:/.test(s)) return null
  if (s.includes('\0') || /[\n\r]/.test(s) || s.includes('..')) return null
  if (SECRET_RE.test(s) || KEY_RE.test(s) || ENV_RE.test(s)) return null
  if (s.includes('<') || s.includes('>')) return null
  return s.slice(0, 240)
}

export function takeFileName(raw) {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s || s.includes('/') || s.includes('\\') || s.includes('..') || s.includes('\0')) return null
  if (KEY_RE.test(s) || ENV_RE.test(s) || s === '.' || s === '..') return null
  if (!/^[\w][\w.\- ]{0,79}$/.test(s)) return null
  return s
}

export function takeChatId(raw) {
  const s = String(raw ?? '').trim()
  if (!s || s.includes('..') || s.includes('<') || s.includes('>') || s.includes('/') || s.includes('\\')) return null
  if (/^(chat[_-][\w.-]{1,64})$/.test(s)) return s.slice(0, 80)
  return null
}

export function takePinnedChats(raw) {
  const out = []
  const seen = new Set()
  const src = Array.isArray(raw) ? raw : []
  for (const row of src) {
    const id = takeChatId(row)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= 24) break
  }
  return out
}

function clampInt(n, lo, hi, fallback) {
  const x = Number(n)
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : fallback
}

export function takeLayout(raw) {
  const empty = {
    activity: 'files',
    chatOpen: true,
    termOpen: true,
    sidebarW: 248,
    chatW: 520,
    termH: 168,
    termPanel: 'terminal',
    split: 'off',
    layoutMode: 'dock',
    density: 'comfortable',
    tabs: [],
    active: null,
    splitPath: null,
    pinnedChats: [],
    cowork: true
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty
  const tabs = []
  const src = Array.isArray(raw.tabs) ? raw.tabs : []
  for (const row of src) {
    const rel = takeWorkspaceRel(typeof row === 'string' ? row : row && typeof row === 'object' ? row.path : '')
    if (!rel || tabs.includes(rel)) continue
    tabs.push(rel)
    if (tabs.length >= 12) break
  }
  const layoutMode = takeLayoutMode(raw.layoutMode) || 'dock'
  const chatHi = layoutMode === 'stage' ? 2400 : 720
  return {
    activity: takeActivity(raw.activity) || 'files',
    chatOpen: raw.chatOpen !== false,
    termOpen: raw.termOpen !== false,
    sidebarW: clampInt(raw.sidebarW, 160, 480, 248),
    chatW: clampInt(raw.chatW, 280, chatHi, 520),
    termH: clampInt(raw.termH, 72, 420, 168),
    termPanel: takeBottomTab(raw.termPanel) || 'terminal',
    split: takeSplit(raw.split) || 'off',
    layoutMode,
    density: takeDensity(raw.density) || 'comfortable',
    tabs,
    active: takeWorkspaceRel(raw.active) || tabs[0] || null,
    splitPath: takeWorkspaceRel(raw.splitPath),
    pinnedChats: takePinnedChats(raw.pinnedChats),
    cowork: takeCowork(raw.cowork) ?? true
  }
}

export function takeChromePulse(raw) {
  const empty = {
    llama: 'off',
    keys: 'none',
    cursor: 'off',
    mode: 'ask',
    mind: 'local',
    telegram: false,
    glass: false,
    mcp: 0,
    pending: 0,
    live: 0,
    busy: false,
    gpu: '',
    vramMb: 0,
    ngl: 0,
    ctx: 0,
    llamaErr: ''
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty
  const keysRaw = typeof raw.keys === 'string' ? raw.keys : ''
  const cursorRaw = typeof raw.cursor === 'string' ? raw.cursor : ''
  const keys = keysRaw.includes('sk-') || keysRaw.includes('<') ? 'none' : plainLine(keysRaw, 48) || 'none'
  const cursor = cursorRaw.includes('sk-') || cursorRaw.includes('<') ? 'off' : plainLine(cursorRaw, 80) || 'off'
  const mcp = Number(raw.mcp)
  const pending = Number(raw.pending)
  const live = Number(raw.live)
  return {
    llama: LLAMA.has(raw.llama) ? raw.llama : 'off',
    keys,
    cursor,
    mode: takeMode(raw.mode) || 'ask',
    mind: takeMind(typeof raw.mind === 'string' ? raw.mind : '') || 'local',
    telegram: raw.telegram === true,
    glass: raw.glass === true,
    mcp: Number.isInteger(mcp) ? Math.min(64, Math.max(0, mcp)) : 0,
    pending: Number.isInteger(pending) ? Math.min(99, Math.max(0, pending)) : 0,
    live: Number.isInteger(live) ? Math.min(32, Math.max(0, live)) : 0,
    busy: raw.busy === true,
    gpu: stripActivityText(raw.gpu, 48),
    vramMb: clampInt(raw.vramMb, 0, 65535, 0),
    ngl: clampInt(raw.ngl, 0, 256, 0),
    ctx: clampInt(raw.ctx, 0, 131072, 0),
    llamaErr: takeOutputLine(raw.llamaErr || raw.error)
  }
}

export function takePortRow(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const name = typeof raw.name === 'string' && PORT_OK.has(raw.name) ? raw.name : null
  const port = Number(raw.port)
  if (!name || !Number.isInteger(port) || port < 1 || port > 65535) return null
  return { name, port }
}

export function takePortList(raw) {
  const out = []
  const src = Array.isArray(raw) ? raw : []
  for (const row of src) {
    const p = takePortRow(row)
    if (!p) continue
    out.push(p)
    if (out.length >= 8) break
  }
  return out
}

export function takeOutputLine(raw) {
  const text = typeof raw === 'string' ? raw : raw && typeof raw === 'object' ? raw.text : ''
  const s = redactCloudText(stripActivityText(text, 200))
  if (!s || s.includes('sk-') || /Bearer\s/i.test(s)) return ''
  return s.replace(/\/(?:home|Users|root)\/\S+/g, '[path]')
}

export function takeOutputLines(raw) {
  const out = []
  const src = Array.isArray(raw) ? raw : []
  for (const row of src) {
    const line = takeOutputLine(row)
    if (!line) continue
    out.push(line)
    if (out.length >= 80) break
  }
  return out
}

export function takeCursorPos(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { line: 1, col: 1, lang: 'text' }
  const line = Number(raw.line)
  const col = Number(raw.col)
  const lang = String(raw.lang || 'text')
    .toLowerCase()
    .replace(/[^a-z0-9+-]/g, '')
    .slice(0, 16) || 'text'
  return {
    line: Number.isInteger(line) ? Math.min(999999, Math.max(1, line)) : 1,
    col: Number.isInteger(col) ? Math.min(9999, Math.max(1, col)) : 1,
    lang
  }
}

export function loadLayout(root) {
  const abs = assertInside(root, layoutFile())
  if (!existsSync(abs)) return takeLayout(null)
  try {
    return takeLayout(JSON.parse(readFileSync(abs, 'utf8')))
  } catch {
    return takeLayout(null)
  }
}

export function saveLayout(root, raw) {
  const next = takeLayout(raw)
  const abs = assertInside(root, layoutFile())
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, JSON.stringify(next, null, 2), 'utf8')
  return next
}

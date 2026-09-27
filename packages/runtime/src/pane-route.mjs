/** Browser-safe activity routing. Do not import workbench-chrome.mjs from the renderer (node:fs). */

const LABELS = Object.freeze({
  files: 'Explorer',
  search: 'Search',
  git: 'Source control',
  qa: 'Debug',
  browser: 'Browser',
  mods: 'Skills',
  notes: 'Notes',
  maps: 'Maps',
  design: 'Code / Design',
  board: 'Board',
  library: 'Repo library',
  telegram: 'Telegram',
  fleet: 'Fleet',
  settings: 'Settings'
})

const SIDE = Object.freeze({
  files: 'files',
  search: 'search',
  git: 'git',
  notes: 'notes',
  qa: 'debug',
  browser: 'files',
  mods: 'skills',
  maps: 'maps',
  board: 'none',
  library: 'none',
  telegram: 'none',
  fleet: 'none',
  settings: 'none',
  design: 'none'
})

export function activityLabel(activity) {
  const s = String(activity || '')
  return LABELS[s] || 'Explorer'
}

export function sidebarKind(activity) {
  const s = String(activity || '')
  return SIDE[s] || 'files'
}

export function centerViewForActivity(activity) {
  return activity === 'browser' ? 'browser' : 'editor'
}

export function isStudioActivity(activity) {
  return activity === 'design'
}

export function isPageActivity(activity) {
  return sidebarKind(activity) === 'none'
}

export function isListActivity(activity) {
  const k = sidebarKind(activity)
  return k === 'notes' || k === 'debug' || k === 'skills' || k === 'maps'
}

export function isEditorActivity(activity) {
  return activity === 'files' || activity === 'search' || activity === 'git'
}

/** Chat and Cowork owns the window. Leftover editor tabs must not keep a dead column. */
export function takeEditorColumn(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const activity = String(o.activity || 'files')
  if (o.chatOpen === false) return 'on'
  if (isStudioActivity(activity) || isPageActivity(activity) || isListActivity(activity)) return 'on'
  if (activity === 'browser') return 'on'
  if (o.cowork === true && activity === 'files') return 'off'
  return 'on'
}

/** One owner per workbench slot. List/page keep chat but yield the Agents session rail. */
export function takeSlots(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const activity = String(o.activity || 'files')
  const chatOpen = o.chatOpen !== false
  const layoutMode = String(o.layoutMode || 'dock')
  const studio = isStudioActivity(activity)
  const page = isPageActivity(activity) && !studio
  const list = isListActivity(activity)
  const editor = takeEditorColumn(o)
  if (studio) {
    return { sidebar: 'off', center: 'on', chat: 'off', sessionsRail: 'off', editor: 'on' }
  }
  const sidebar = page || editor === 'off' ? 'off' : 'on'
  const center = editor === 'off' ? 'off' : 'on'
  const chat = !chatOpen ? 'off' : layoutMode === 'focus' ? 'ticker' : 'on'
  const sessionsRail = chat === 'on' && !list && !page ? 'on' : 'off'
  return { sidebar, center, chat, sessionsRail, editor }
}

/** List/page must not inherit Stage's 640px chat floor or a persisted 720px dock. */
export function takeChatPx(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const activity = String(o.activity || 'files')
  const layoutMode = String(o.layoutMode || 'dock')
  const n = Number(o.chatW)
  const w = Number.isFinite(n) ? n : 420
  if (layoutMode === 'focus' || isStudioActivity(activity)) return 0
  if (isPageActivity(activity) || isListActivity(activity)) {
    return Math.min(Math.max(Math.round(w), 320), 480)
  }
  if (layoutMode === 'stage') return Math.min(Math.max(Math.round(w), 640), 2400)
  return Math.min(Math.max(Math.round(w), 280), 720)
}

export function redactDebugText(s, max = 4000) {
  const cap = Number.isFinite(max) ? Math.min(8000, Math.max(80, Math.round(max))) : 4000
  return String(s ?? '')
    .replace(/[<>]/g, '')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, cap)
}

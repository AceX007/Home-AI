import {
  FORGE_STEPS,
  forgePhaseIndex,
  laneBuckets,
  lastForgeError,
  lastForgeStep,
  publicToolCall,
  reduceWorkflowChunks,
  stripActivityText,
  takeWorkflow,
  thinkPick,
  workflowPhaseLine
} from './activity.mjs'
import { takeMiniAppUrl } from './telegram-initdata.mjs'
import { redactCloudText } from './think.mjs'

export const RULE = '────────────────'
const DOCK = {
  new: 'new-chat',
  pulse: 'status',
  stack: 'tools',
  board: 'tasks',
  console: 'manage',
  menu: 'menu',
  manage: 'manage',
  you: 'settings',
  settings: 'settings',
  glass: 'app',
  home: 'app',
  app: 'app',
  stage: 'stage',
  trust: 'manage',
  skills: 'skills',
  fleet: 'fleet'
}
const MODE_OK = new Set(['ask', 'think', 'agent', 'plan', 'debug', 'multitask'])
const NAV_OK = new Set([
  'status',
  'tools',
  'tasks',
  'help',
  'menu',
  'manage',
  'settings',
  'llama',
  'cursor',
  'stop',
  'health',
  'stage',
  'skills',
  'fleet'
])
const THINK_OK = new Set(['ready', 'implementing', 'done', 'think'])

export function plainLine(raw, max = 80) {
  return stripActivityText(raw, max)
}

export function plainBlock(raw, max = 1400) {
  return redactCloudText(String(raw ?? ''))
    .replace(/[<>]/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

export function formatConsole(lines, meta = {}) {
  const state = plainLine(meta.state || 'IDLE', 16).toUpperCase() || 'IDLE'
  const kicker = plainLine(meta.kicker, 40)
  const head = kicker ? `HOME · ${state} · ${kicker}` : `HOME · ${state}`
  const body = []
  const list = Array.isArray(lines) ? lines : [lines]
  for (const row of list) {
    if (row == null) continue
    const s = String(row)
    if (s.includes('\n')) {
      const block = plainBlock(s, 1400)
      if (block) body.push(block)
    } else {
      const line = plainLine(s, 280)
      if (line) body.push(line)
    }
  }
  return [head, RULE, ...body].join('\n').slice(0, 3500)
}

export function phaseTrack(step) {
  const i = forgePhaseIndex(step)
  let dots = ''
  for (let k = 0; k < FORGE_STEPS.length; k++) {
    dots += k < i ? '●' : k === i ? '◉' : '○'
    if (k < FORGE_STEPS.length - 1) dots += ' '
  }
  return `${dots}  ${FORGE_STEPS[i] || 'perceive'}`
}

export function welcomeCard(profile = {}) {
  const name = plainLine(profile.displayName, 40)
  const who = name ? `Hello ${name}.` : 'Paired.'
  return formatConsole(
    [
      'The kernel stays on your desk.',
      'This chat is the glass.',
      '·',
      `${who} Same thread as the workbench.`,
      'Type to think. Ship on PC to change the tree.',
      'HOME on the dock is the Mini App. Same kernel.'
    ],
    { state: 'LIVE', kicker: 'GLASS' }
  )
}

export function helpCard(info = {}) {
  const trust = plainLine(trustLine(info.approvalMode), 80)
  return formatConsole(
    [
      'Private chat or a group. Only the paired account can command.',
      'Pair in a private chat — never paste a code in a group.',
      '·',
      'SHIP    /do  /agent     same kernel, packs not every MCP',
      'THINK   /think /ask     local perceive, no writes',
      'MODES   /plan /debug /multitask',
      'PULSE   /status         live job + board',
      'STAGE   /stage          forge · think · hold',
      'STACK   /tools  /mcp    builtin + servers',
      'FLEET   /fleet          stacks · clone · add repo (tokens on PC)',
      'BOARD   /tasks          shared with the PC',
      'GLASS   /app            Mini App · Stage Think Drop',
      'MANAGE  /manage         mind · llama · jobs · you',
      `TRUST   Manage / Trust  ${trust}`,
      'MIND    /mind local|cloud|cursor   offline 2B or Cursor Cloud Agents',
      'WARM    /llama  /cursor            load 2B · list Cloud Agents jobs',
      'KNOW    /skills /rules             standing knowledge',
      'NEW     /new              start a thread',
      'CHATS   /chats            switch threads',
      '·',
      'In a group: command, @me, or reply. Room chatter is ignored.'
    ],
    { state: 'IDLE', kicker: 'CONSOLE' }
  )
}

export function needPairCard(group) {
  return formatConsole(
    [
      group
        ? 'This room can watch. It cannot drive.'
        : 'The glass is locked until you pair.',
      group
        ? 'Open a private chat with me. Settings on the PC has the code.'
        : 'Hex AI Settings → Pair phone → send /pair CODE here.'
    ],
    { state: 'PAIR', kicker: group ? 'GROUP' : 'GLASS' }
  )
}

export function pairOkCard() {
  return welcomeCard()
}

export function pairFailCard() {
  return formatConsole(['That code is dead. Start Pair phone again on the PC.'], { state: 'FAULT', kicker: 'PAIR' })
}

export function pairDmCard() {
  return formatConsole(['A pair code in a group is a leak.', 'Open a private chat with me.'], {
    state: 'FAULT',
    kicker: 'PAIR'
  })
}

export function groupHelloCard() {
  return formatConsole(
    [
      'HOME is in the room.',
      'Only the paired account can command the kernel.',
      'Pair in a private chat first. Then /do, @me, or reply.'
    ],
    { state: 'LIVE', kicker: 'GROUP' }
  )
}

export function menuCard(info = {}) {
  const trust = plainLine(trustLine(info.approvalMode), 80)
  return formatConsole(
    [
      'Ask · Think · Agent set the default.',
      `Stage is forge · think · hold. Trust is ${trust}.`,
      'Manage is the control room. Pulse is the live job. Stack is every tool.',
      'Board is the same kanban as the PC. Fleet is stacks and clones. Same kernel as the IDE session pane.'
    ],
    { state: 'IDLE', kicker: 'DOCK' }
  )
}

export function manageCard(info = {}) {
  const peers = Number(info.peers)
  return formatConsole(
    [
      info.online ? 'Poller live. This chat drives the desk.' : 'Poller idle. Open Telegram session in the IDE.',
      '',
      `mode    ${plainLine(info.mode, 16) || 'ask'}`,
      `mind    ${plainLine(info.mind, 16) || 'local'}`,
      `llama   ${plainLine(info.llama, 16) || 'off'}`,
      `keys    ${plainLine(info.keys, 48) || 'none'}`,
      info.cursor ? `cursor  ${plainLine(info.cursor, 80)}` : '',
      `peers   ${Number.isInteger(peers) && peers > 0 ? String(peers) : 'none'}`,
      `live    ${plainLine(info.live, 80) || '—'}`,
      info.glass ? 'glass   on' : 'glass   off',
      '',
      'Buttons set the kernel. The IDE Telegram pane is the same session.'
    ],
    { state: info.online ? 'LIVE' : 'IDLE', kicker: 'MANAGE' }
  )
}

export function statusDashboard(info = {}) {
  const doing = Array.isArray(info.doing) ? info.doing.map((t) => plainLine(t, 48)).filter(Boolean) : []
  const lines = [
    info.live || 'No live job.',
    '',
    `thread  ${plainLine(info.threadTitle, 48) || 'Home'}`,
    `mode    ${plainLine(info.mode, 16) || 'ask'}`,
    `mind    ${plainLine(info.provider, 16) || 'local'}`,
    info.llama ? `llama   ${plainLine(info.llama, 16)}` : '',
    info.keys ? `keys    ${plainLine(info.keys, 48)}` : '',
    info.cursor ? `cursor  ${plainLine(info.cursor, 80)}` : '',
    `board   ${doing.join(' · ') || 'clear'}`,
    info.git ? `git     ${plainLine(info.git, 200)}` : '',
    info.surface ? plainLine(info.surface, 200) : ''
  ]
  return formatConsole(lines, { state: info.busy ? 'LIVE' : 'IDLE', kicker: 'PULSE' })
}

function takeThinkStatus(raw, hadError) {
  let s = String(raw || '')
    .toLowerCase()
    .replace(/[<>]/g, '')
    .trim()
  if (s === 'built' || s === 'complete' || s === 'success') s = hadError ? 'implementing' : ''
  if (!THINK_OK.has(s)) s = ''
  if (hadError && s === 'done') s = 'implementing'
  return s
}

function stagePhase(info) {
  const named = String(info.phase || info.step || '')
  if (FORGE_STEPS.includes(named)) return named
  const items = Array.isArray(info.items) ? info.items : Array.isArray(info.chunks) ? info.chunks : []
  let step = lastForgeStep(items)
  if (!step) {
    for (const it of items) {
      const s = it && (it.step || it.phase)
      if (s && FORGE_STEPS.includes(String(s))) step = String(s)
    }
  }
  return step
}

function stageLanes(info) {
  const src = info.lanes
  if (src && typeof src === 'object' && !Array.isArray(src) && (src.running || src.done || src.error)) {
    return {
      running: Array.isArray(src.running) ? src.running : [],
      done: Array.isArray(src.done) ? src.done : [],
      error: Array.isArray(src.error) ? src.error : []
    }
  }
  const rows = Array.isArray(src) ? src.slice() : Array.isArray(info.tools) ? info.tools.slice() : []
  const items = Array.isArray(info.chunks) ? info.chunks : Array.isArray(info.items) ? info.items : []
  if (!rows.length) {
    for (const c of items) {
      if (!c || typeof c !== 'object') continue
      if (c.type === 'tool_call' && c.toolCall) {
        const pub = publicToolCall(c.toolCall)
        if (pub) rows.push({ name: pub.name, status: 'running' })
      }
    }
  }
  return laneBuckets(rows)
}

export function trustLine(mode) {
  return mode === 'auto-review' ? 'Local 2B · Auto-review · no Landlock' : 'Local 2B · Ask · no Landlock'
}

export function stageCard(info = {}) {
  const items = Array.isArray(info.items) ? info.items : Array.isArray(info.chunks) ? info.chunks : []
  const err = redactCloudText(lastForgeError(items) || plainLine(info.error, 160))
  const phase = stagePhase(info)
  const pick = thinkPick(info.docs)
  const think = takeThinkStatus(info.think || info.thinkStatus || pick?.status || info.docs?.[0]?.status, Boolean(err))
  const thinkTitle = plainLine(info.thinkTitle || pick?.title || info.docs?.[0]?.title, 48)
  const waiting = info.waiting === true || info.hold === true || Boolean(info.approval)
  const approval = plainLine(info.approval, 40)
  const buckets = stageLanes(info)
  const laneNames = [...buckets.running, ...buckets.error, ...buckets.done]
    .map((r) => plainLine(r?.name, 40))
    .filter(Boolean)
    .slice(0, 8)
  const wf = takeWorkflow(
    info.workflow && typeof info.workflow === 'object' ? info.workflow : reduceWorkflowChunks(items, { runId: info.runId, task: info.thinkTitle || info.title, now: Date.now() }),
    null,
    { runId: info.runId, task: info.thinkTitle || info.title, now: Date.now() }
  )
  const phases = wf.agents.length || wf.criticSkipped ? workflowPhaseLine(wf) : ''
  const lines = [
    phase ? phaseTrack(phase) : '',
    think ? `think   ${think}${thinkTitle ? ` · ${thinkTitle}` : ''}` : 'think   —',
    waiting ? `hold    ${approval || 'approval'}` : '',
    `trust   ${plainLine(trustLine(info.approvalMode), 80)}`,
    String(info.autoReviewLine || '').startsWith('auto-review ·') ? plainLine(info.autoReviewLine, 80) : '',
    info.llama ? `llama   ${plainLine(info.llama, 16)}` : '',
    info.keys ? `keys    ${plainLine(info.keys, 48)}` : '',
    phases ? `phases  ${plainLine(phases, 80)}` : '',
    buckets.running.length || buckets.done.length || buckets.error.length
      ? `lanes   ${buckets.running.length} running · ${buckets.done.length} done · ${buckets.error.length} error`
      : '',
    laneNames.length ? plainLine(laneNames.join(' · '), 200) : '',
    err ? `error   ${err}` : ''
  ]
  const state = err ? 'FAULT' : waiting ? 'HOLD' : info.busy ? 'LIVE' : 'IDLE'
  return formatConsole(lines, { state, kicker: 'STAGE' })
}

export function catalogCard(title, body, state = 'IDLE') {
  return formatConsole([plainBlock(body, 2800) || 'Empty.'], { state, kicker: plainLine(title, 16) || 'CARD' })
}

export function noticeCard(text, state = 'IDLE', kicker = 'NOTE') {
  return formatConsole([text], { state, kicker })
}

export function dockKind(text) {
  const raw = String(text || '').trim()
  if (raw.startsWith('/')) return null
  const k = raw.replace(/[^\w]/g, '').toLowerCase()
  return DOCK[k] || null
}

export function dockKeyboard() {
  return {
    keyboard: [
      [{ text: 'New' }, { text: 'Skills' }],
      [{ text: 'Manage' }, { text: 'Pulse' }],
      [{ text: 'Stage' }, { text: 'Trust' }],
      [{ text: 'Stack' }, { text: 'Board' }, { text: 'Fleet' }]
    ],
    resize_keyboard: true,
    is_persistent: true
  }
}

export function glassAppKeyboard(url) {
  const safe = takeMiniAppUrl(url)
  const rows = [
    [{ text: 'New' }, { text: 'Skills' }],
    [{ text: 'Manage' }, { text: 'Pulse' }],
    [{ text: 'Stage' }, { text: 'Trust' }],
    [{ text: 'Stack' }, { text: 'Board' }, { text: 'Fleet' }]
  ]
  if (safe) rows.unshift([{ text: 'HOME', web_app: { url: safe } }])
  return { keyboard: rows, resize_keyboard: true, is_persistent: true }
}

export function menuInlineKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'Ask', callback_data: 'mod:set:ask' },
        { text: 'Think', callback_data: 'mod:set:think' },
        { text: 'Agent', callback_data: 'mod:set:agent' }
      ],
      [
        { text: 'Pulse', callback_data: 'nav:go:status' },
        { text: 'Stack', callback_data: 'nav:go:tools' },
        { text: 'Board', callback_data: 'nav:go:tasks' },
        { text: 'Fleet', callback_data: 'nav:go:fleet' }
      ],
      [
        { text: 'Stage', callback_data: 'nav:go:stage' },
        { text: 'Trust', callback_data: 'nav:go:manage' }
      ],
      [
        { text: 'Local', callback_data: 'mod:mind:local' },
        { text: 'Cloud', callback_data: 'mod:mind:openrouter' },
        { text: 'Cursor', callback_data: 'mod:mind:cursor' }
      ],
      [
        { text: 'New session', callback_data: 'new:dock' },
        { text: 'Skills', callback_data: 'nav:go:skills' },
        { text: 'Help', callback_data: 'nav:go:help' }
      ],
      [
        { text: 'Manage', callback_data: 'nav:go:manage' },
        { text: 'Llama', callback_data: 'nav:go:llama' },
        { text: 'Halt', callback_data: 'nav:go:stop' }
      ]
    ]
  }
}

export function manageInlineKeyboard() {
  return menuInlineKeyboard()
}

export function liveKeyboard(runId) {
  const id = safeCallbackId(runId)
  if (!id) return { inline_keyboard: [] }
  return { inline_keyboard: [[{ text: 'Halt', callback_data: `stp:${id}` }]] }
}

export function doneKeyboard(runId) {
  const id = safeCallbackId(runId)
  if (!id) return { inline_keyboard: [] }
  return {
    inline_keyboard: [
      [
        { text: 'Ship on PC', callback_data: `run:${id}` },
        { text: 'Deep pass', callback_data: `thk:${id}` }
      ],
      [
        { text: 'Pin', callback_data: `tsk:${id}` },
        { text: 'New session', callback_data: 'new:dock' }
      ]
    ]
  }
}

export function takeMode(raw) {
  const m = String(raw || '').toLowerCase()
  return MODE_OK.has(m) ? m : null
}

export function takeNav(raw) {
  const n = String(raw || '').toLowerCase()
  return NAV_OK.has(n) ? n : null
}

export function safeCallbackId(raw) {
  const id = String(raw || '')
    .replace(/[^\w.-]/g, '')
    .slice(0, 80)
  if (!id || id.includes('..') || !/^[\w.-]{1,80}$/.test(id)) return ''
  return id
}

export function stripParseMode(extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return {}
  const out = { ...extra }
  delete out.parse_mode
  return out
}

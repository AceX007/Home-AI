import { relative, resolve } from 'node:path'
import { stripActivityText } from './activity.mjs'
import { detectToolPacks, filterToolsByPack, shrinkToolDef, keepFullSchema } from './tool-packs.mjs'
import { redactCloudText } from './think.mjs'
import { filterLifeTools, probeLifeBins } from './life-bins.mjs'

export const WRITE_TOOLS = new Set([
  'fs_write',
  'str_replace',
  'rag_write',
  'terminal_run',
  'test_run',
  'tasks_update',
  'debug_log',
  'debug_start',
  'debug_continue',
  'debug_stop',
  'debug_breakpoint',
  'debug_evaluate',
  'git_worktree',
  'design_patch',
  'design_ingest_tokens',
  'plan_write',
  'compute_run',
  'notes_write',
  'calendar_upsert'
])

export const ASK_BLOCK = new Set([
  ...WRITE_TOOLS,
  'http_fetch',
  'web_search',
  'web_extract',
  'browser_navigate',
  'browser_click',
  'browser_type',
  'browser_extract',
  'browser_screenshot',
  'browser_console',
  'speak',
  'inbox_stt',
  'inbox_ocr',
  'task'
])

export const THINK_TOOLS = new Set([
  'explore',
  'fs_read',
  'fs_list',
  'grep',
  'glob',
  'rag_search',
  'code_outline',
  'debug_stack',
  'design_get',
  'ask_user',
  'git_status',
  'git_diff',
  'git_log',
  'library_pack',
  'git_pack',
  'plan_write',
  'task',
  'notes_list',
  'calendar_list'
])

export const PLAN_BLOCK = new Set([
  'fs_write',
  'str_replace',
  'test_run',
  'terminal_run',
  'design_patch',
  'design_ingest_tokens',
  'compute_run',
  'debug_start',
  'debug_continue',
  'debug_stop',
  'debug_evaluate',
  'notes_write',
  'calendar_upsert'
])

export const VERIFY_TOOLS = new Set(['str_replace', 'debug_log', 'ask_user'])

const FULL_MODES = new Set(['agent', 'debug', 'multitask'])

export const DESIGN_LOOP = new Set(['design_get', 'design_patch', 'design_ingest_tokens'])

export function toolsForDesign(builtins) {
  const list = Array.isArray(builtins) ? builtins : []
  return list.filter((t) => t && DESIGN_LOOP.has(t.name))
}

/** Force native/Qwen tool calls on the Design loop so 2B cannot answer with a story. */
export function designToolChoice(tools) {
  const list = Array.isArray(tools) ? tools : []
  if (!list.length) return 'auto'
  for (const t of list) {
    if (!t || !DESIGN_LOOP.has(t.name)) return 'auto'
  }
  return 'required'
}

export function toolsForMode(mode, builtins, mcpTools, opts) {
  const list = Array.isArray(builtins) ? builtins : []
  const mcp = Array.isArray(mcpTools) ? mcpTools : []
  const packs =
    opts && Array.isArray(opts.packs) && opts.packs.length
      ? opts.packs
      : detectToolPacks(opts && opts.task ? opts.task : '', opts && opts.skills ? opts.skills : [])
  const builtin = list.filter((t) => {
    const name = t && typeof t.name === 'string' ? t.name : ''
    if (!name) return false
    if (mode === 'ask') return !ASK_BLOCK.has(name)
    if (mode === 'think') return THINK_TOOLS.has(name)
    if (mode === 'plan') return !PLAN_BLOCK.has(name)
    return true
  })
  const lifeBins = opts && opts.lifeBins ? opts.lifeBins : probeLifeBins()
  if (mode === 'think') {
    return filterLifeTools(builtin, lifeBins).map((t) => shrinkToolDef(t, keepFullSchema(t, packs, 'think')))
  }
  const packed = filterLifeTools(filterToolsByPack(builtin, packs), lifeBins).map((t) =>
    shrinkToolDef(t, keepFullSchema(t, packs, mode))
  )
  const mcpPacked = packs.includes('mcp-domain')
    ? mcp.slice(0, 24).map((t) => shrinkToolDef({ ...t, pack: 'mcp-domain' }, false))
    : []
  return [...packed, ...mcpPacked]
}

export function mcpPublicRows(listed) {
  const rows = Array.isArray(listed) ? listed : []
  const out = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const id = stripActivityText(row.id, 48)
    if (!id) continue
    const tools = []
    const names = Array.isArray(row.tools) ? row.tools : []
    for (const n of names) {
      const name = stripActivityText(n, 48)
      if (name) tools.push(name)
      if (tools.length >= 32) break
    }
    out.push({
      id,
      ok: row.ok === true,
      tools,
      transport: row.transport === 'http' || row.transport === 'stdio' ? row.transport : undefined
    })
    if (out.length >= 24) break
  }
  return out
}

export function formatToolSurface(mode, builtins, mcpTools, listed, opts) {
  const tools = toolsForMode(mode, builtins, mcpTools, opts)
  const packs = (opts && opts.packs) || detectToolPacks(opts && opts.task ? opts.task : '', opts && opts.skills)
  const rows = mcpPublicRows(listed)
  const ok = rows.filter((s) => s.ok)
  const mcpToolN = ok.reduce((n, s) => n + s.tools.length, 0)
  const lines = [
    `mode ${stripActivityText(mode, 16) || 'agent'} · tools ${tools.length} · packs ${packs.join(',')} · mcp ${ok.length}/${rows.length} · mcp-tools ${mcpToolN}`,
    ...ok.map((s) => `${s.id}${s.transport ? ` ${s.transport}` : ''} · ${s.tools.slice(0, 8).join(', ') || 'no tools'}`)
  ]
  const down = rows.filter((s) => !s.ok).slice(0, 6)
  for (const s of down) lines.push(`${s.id} down`)
  if (packs.length === 1 && packs[0] === 'core') {
    lines.push('/pack research|browser|design|life|mcp-domain')
  }
  return lines.join('\n').slice(0, 3500)
}

export function isFullToolMode(mode) {
  return FULL_MODES.has(mode)
}

export function verifyToolDefs(tools) {
  const list = Array.isArray(tools) ? tools : []
  return list.filter((t) => t && VERIFY_TOOLS.has(t.name))
}

/** Workspace-relative before/after for VERIFY. Extra-root and data/secrets never leak. */
export function takeVerifyPatch(extra, workspaceRoot) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return ''
  const abs = Object.hasOwn(extra, 'path') && typeof extra.path === 'string' ? extra.path : ''
  if (!abs || abs.includes('\0') || /[\n\r]/.test(abs)) return ''
  const root = typeof workspaceRoot === 'string' ? workspaceRoot.trim() : ''
  if (!root || root.includes('\0') || /[\n\r]/.test(root)) return ''
  let rel = ''
  try {
    rel = relative(resolve(root), resolve(root, abs)).replace(/\\/g, '/')
  } catch {
    return ''
  }
  if (!rel || rel.startsWith('..') || rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) {
    return 'extra-root write (content omitted)'
  }
  if (/(^|\/)data\/secrets(\/|$)/.test(rel)) return ''
  const label = rel.slice(0, 180).replace(/[<>]/g, '')
  const beforeRaw = Object.hasOwn(extra, 'before') ? extra.before : ''
  const afterRaw = Object.hasOwn(extra, 'after') ? extra.after : ''
  const before = redactCloudText(String(beforeRaw ?? '').replace(/[<>]/g, '')).slice(-800)
  const after = redactCloudText(String(afterRaw ?? '').replace(/[<>]/g, '')).slice(0, 800)
  if (!before && !after) return `path ${label}`
  return `path ${label}\n--- before ---\n${before}\n--- after ---\n${after}`
}

export function verifyUserPrompt(toolTrace, patches, diff, extras) {
  const lines = Array.isArray(toolTrace) ? toolTrace.slice(-12) : []
  const body = lines
    .map((x) => String(x || '').replace(/[<>]/g, ''))
    .join('\n')
    .slice(0, 1200)
  const patchBits = Array.isArray(patches)
    ? patches.map((p) => String(p || '').replace(/[<>]/g, '')).filter(Boolean).slice(-3)
    : []
  const patch = patchBits.join('\n\n').slice(0, 1800)
  const diffBit = typeof diff === 'string' ? redactCloudText(String(diff).replace(/[<>]/g, '')).slice(0, 1800) : ''
  const extra = extras && typeof extras === 'object' && !Array.isArray(extras) ? extras : {}
  const note =
    extra && Object.prototype.hasOwnProperty.call(extra, 'note') && typeof extra.note === 'string'
      ? redactCloudText(String(extra.note).replace(/[<>]/g, '')).slice(0, 800)
      : ''
  const head =
    'VERIFY PASS. Files were written. You may only call str_replace, debug_log, or ask_user. Do not call test_run or terminal_run. If the patch looks wrong, fix it. If it looks fine, reply with one line OK.'
  return `${head}${patch ? `\n\n${patch}` : ''}${diffBit ? `\n\n${diffBit}` : ''}${body ? `\n\n${body}` : ''}${note ? `\n\n${note}` : ''}`
}
export function takeVerifyCalls(calls) {
  const list = Array.isArray(calls) ? calls : []
  return list.filter((c) => c && typeof c.name === 'string' && VERIFY_TOOLS.has(c.name))
}

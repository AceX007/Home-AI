import { homedir } from 'node:os'
import { isAbsolute, resolve, sep } from 'node:path'

const TERM_DENY = /[\n\r;|`$<>]/

export function clampApprovalMode(raw) {
  return raw === 'unrestricted' || raw === 'manual' || raw === 'auto-review' ? raw : 'allowlist'
}

/** Consumer save: unrestricted needs an extra confirm. Load path still uses clampApprovalMode. */
export function takeApprovalSave(mode, confirm) {
  const m = clampApprovalMode(mode)
  if (m === 'unrestricted' && confirm !== true) return 'allowlist'
  return m
}

export function parseHttpUrl(raw) {
  const t = String(raw ?? '').trim()
  if (!/^https?:\/\//i.test(t)) return null
  try {
    const u = new URL(t)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (u.username || u.password) return null
    if (!u.hostname) return null
    return u
  } catch {
    return null
  }
}

export function sanitizeTerminalPrefix(s) {
  const t = s.trim()
  if (!t || t === '*' || t.length > 80) return null
  if (TERM_DENY.test(t)) return null
  return t
}

export function sanitizeNetPrefix(s) {
  const u = parseHttpUrl(s)
  if (!u) return null
  const path = u.pathname === '/' ? '' : u.pathname
  const out = `${u.origin}${path}`
  if (out.length > 200) return null
  return out
}

export function urlAllowed(url, allow) {
  const u = parseHttpUrl(url)
  if (!u) return false
  const list = Array.isArray(allow) ? allow : []
  return list.some((p) => originPathAllows(u, parseHttpUrl(p)))
}

function defaultPort(u) {
  return u.port || (u.protocol === 'https:' ? '443' : '80')
}

function originPathAllows(got, allow) {
  if (!allow) return false
  if (got.protocol !== allow.protocol) return false
  if (got.hostname.toLowerCase() !== allow.hostname.toLowerCase()) return false
  if (allow.port && defaultPort(got) !== defaultPort(allow)) return false
  const allowPath = allow.pathname === '/' ? '' : allow.pathname
  if (!allowPath) return true
  const path = got.pathname || '/'
  if (path === allowPath) return true
  const prefix = allowPath.endsWith('/') ? allowPath : `${allowPath}/`
  return path.startsWith(prefix)
}

export function sanitizeMcpRule(s) {
  const t = s.trim()
  if (!/^(\*|[\w.-]+):(\*|[\w.-]+)$/.test(t)) return null
  return t
}

/** Opt-in extra FS roots. Absolute, not `/`, not `$HOME` itself, not secrets. */
export function sanitizeExtraRoot(s) {
  const t = String(s ?? '').trim()
  if (!t || t.length > 400 || t.includes('\0') || /[\n\r]/.test(t)) return null
  if (t.includes('..')) return null
  if (!isAbsolute(t)) return null
  const resolved = resolve(t)
  if (resolved === '/' || resolved === sep) return null
  const posix = resolved.replace(/\\/g, '/')
  if (posix === '/home' || posix === '/Users' || posix === '/root') return null
  const home = homedir()
  if (resolved === home || resolved === home + sep) return null
  if (posix.includes('/data/secrets')) return null
  return resolved
}

/** Extra-root writes always Ask — unrestricted still cannot skip this. */
export function extraRootWriteDecision() {
  return 'ask'
}

export function extraRootWriteAsks(permission, extraRoot) {
  return extraRoot === true && permission === 'write'
}

/** MCP is not Judge-modeled. Auto-review never auto-allows an MCP tool. */
export function mcpApprovalDecision(mode, allowed) {
  if (mode === 'unrestricted') return 'allow'
  if (mode === 'auto-review') return 'ask'
  return allowed ? 'allow' : 'ask'
}

/** Last overlay wins. Explicit null clears autoRun/autoReview so ~/.homeai cannot resurrect them. */
export function applyLoadedPatch(merged, taken) {
  if (!merged || typeof merged !== 'object' || Array.isArray(merged)) return merged
  if (!taken || typeof taken !== 'object' || Array.isArray(taken)) return merged
  if (taken.approvalMode) merged.approvalMode = taken.approvalMode
  if (taken.terminalAllowlist) merged.terminalAllowlist = taken.terminalAllowlist
  if (taken.mcpAllowlist) merged.mcpAllowlist = taken.mcpAllowlist
  if (taken.netAllowlist) merged.netAllowlist = taken.netAllowlist
  if (taken.fsExtraRoots) merged.fsExtraRoots = taken.fsExtraRoots
  if (taken.autoRun) merged.autoRun = taken.autoRun
  else if (taken.autoRun === null) delete merged.autoRun
  if (taken.autoReview) merged.autoReview = taken.autoReview
  else if (taken.autoReview === null) delete merged.autoReview
  return merged
}

/** Workspace `data/permissions.json` wins for instruction pairs after later overlays. */
export function pinWorkspaceInstructions(merged, taken) {
  if (!merged || typeof merged !== 'object' || Array.isArray(merged)) return merged
  if (!taken || typeof taken !== 'object' || Array.isArray(taken)) return merged
  if (Object.prototype.hasOwnProperty.call(taken, 'autoRun')) {
    if (taken.autoRun) merged.autoRun = taken.autoRun
    else delete merged.autoRun
  }
  if (Object.prototype.hasOwnProperty.call(taken, 'autoReview')) {
    if (taken.autoReview) merged.autoReview = taken.autoReview
    else delete merged.autoReview
  }
  return merged
}

/** Own-key allowlists only. Used on load and save so disk `/` or `*` cannot skip sanitizers. */
export function takePermissionsPatch(file) {
  const src = file && typeof file === 'object' && !Array.isArray(file) ? file : {}
  const own = (k) => Object.prototype.hasOwnProperty.call(src, k)
  const out = Object.create(null)
  if (own('approvalMode')) out.approvalMode = clampApprovalMode(src.approvalMode)
  if (own('terminalAllowlist')) out.terminalAllowlist = mapAllowlist(src.terminalAllowlist, sanitizeTerminalPrefix)
  if (own('mcpAllowlist')) out.mcpAllowlist = mapAllowlist(src.mcpAllowlist, sanitizeMcpRule)
  if (own('netAllowlist')) out.netAllowlist = mapAllowlist(src.netAllowlist, sanitizeNetPrefix)
  if (own('fsExtraRoots')) out.fsExtraRoots = mapAllowlist(src.fsExtraRoots, sanitizeExtraRoot)
  if (own('autoRun')) out.autoRun = takeInstructionPair(src.autoRun) || null
  if (own('autoReview')) out.autoReview = takeInstructionPair(src.autoReview) || null
  return out
}

function stringList(xs, max = 200) {
  if (!Array.isArray(xs)) return []
  const out = []
  for (const x of xs) {
    if (typeof x !== 'string') continue
    const t = x.trim()
    if (!t || t.length > max) continue
    out.push(t)
  }
  return [...new Set(out)]
}

export function mapAllowlist(xs, fn) {
  return [...new Set(stringList(xs, 400).map(fn).filter(Boolean))]
}

export function instructionList(xs) {
  if (!Array.isArray(xs)) return undefined
  const out = []
  for (const x of xs) {
    if (typeof x !== 'string') continue
    if (/[<>]/.test(x) || /[\n\r]/.test(x)) continue
    const t = x.trim().slice(0, 200)
    if (!t) continue
    out.push(t)
    if (out.length >= 32) break
  }
  return out.length ? [...new Set(out)] : undefined
}

export function takeInstructionPair(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const own = (k) => Object.prototype.hasOwnProperty.call(raw, k)
  const allow = own('allow_instructions') ? instructionList(raw.allow_instructions) : undefined
  const block = own('block_instructions') ? instructionList(raw.block_instructions) : undefined
  if (!allow && !block) return undefined
  const out = Object.create(null)
  if (allow) out.allow_instructions = allow
  if (block) out.block_instructions = block
  return out
}

export const WEB_SEARCH_ENDPOINT = 'https://html.duckduckgo.com/html/'

/** Approval `detail` for decideTool — real URL/command, never a tool name or raw search query. */
export function toolApprovalDetail(call, pageUrl) {
  const name = call && typeof call.name === 'string' ? call.name : ''
  const args = call && call.arguments && typeof call.arguments === 'object' && !Array.isArray(call.arguments) ? call.arguments : {}
  switch (name) {
    case 'terminal_run':
    case 'test_run':
      return String(args.command ?? args.kind ?? name)
    case 'http_fetch':
    case 'browser_navigate':
      return String(args.url ?? '')
    case 'web_search': {
      const q = encodeURIComponent(String(args.query ?? '').trim())
      return `${WEB_SEARCH_ENDPOINT}?q=${q}`
    }
    case 'browser_click':
    case 'browser_type':
      return String(pageUrl || 'about:blank')
    case 'web_extract':
      return String(args.url ?? '')
    case 'compute_run':
      return `compute_run ${String(args.runtime ?? 'python')}`
    case 'inbox_stt':
      return 'inbox_stt'
    case 'speak':
      return 'speak'
    case 'task':
      return `task ${String(args.subagent_type ?? args.kind ?? 'explore')}`
    case 'git_worktree': {
      const action = String(args.action ?? 'list')
      if (action === 'add') return `git worktree add ${String(args.name ?? 'wt')}`.trim()
      return 'git worktree list'
    }
    case 'debug_start':
      return String(args.path ?? 'debug_start')
    default:
      return name
  }
}

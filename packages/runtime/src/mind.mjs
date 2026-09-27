import { cursorJobList } from './cursor-jobs.mjs'
import { redactCloudText } from './think.mjs'
import { outcomeRoute } from './outcome-route.mjs'

export const MINDS = ['local', 'openai', 'openrouter', 'cursor']

const LLAMA = new Set(['on', 'off', 'missing'])

export function takeMind(raw) {
  if (typeof raw !== 'string') return null
  const k = raw
    .toLowerCase()
    .replace(/[^\w]/g, '')
  if (k === 'local' || k === 'offline' || k === '2b' || k === 'llama') return 'local'
  if (k === 'openai') return 'openai'
  if (k === 'openrouter' || k === 'cloud') return 'openrouter'
  if (k === 'cursor') return 'cursor'
  return null
}

export function pickForgeProvider(opts = {}) {
  const keys = opts.keys && typeof opts.keys === 'object' && !Array.isArray(opts.keys) ? opts.keys : {}
  const mode = String(opts.mode || '')
  const thinkPath = opts.thinkPath === true
  const mind = takeMind(opts.mind) || 'local'
  if (mode === 'think') return 'local'
  const own = (k) => Object.prototype.hasOwnProperty.call(opts, k)
  if (own('verifyOk') || own('localOk')) {
    const routed = outcomeRoute({
      localOk: opts.localOk !== false,
      verifyOk: opts.verifyOk !== false,
      hasCloud: keys.openrouter === true || keys.openai === true,
      hasSidecar: opts.hasSidecar === true
    })
    if (routed === 'cloud') {
      if (keys.openrouter === true) return 'openrouter'
      if (keys.openai === true) return 'openai'
    }
  }
  if (thinkPath) {
    if (keys.openai === true) return 'openai'
    if (keys.openrouter === true) return 'openrouter'
    return 'local'
  }
  if (mind === 'openai') return keys.openai === true ? 'openai' : keys.openrouter === true ? 'openrouter' : 'local'
  if (mind === 'openrouter') return keys.openrouter === true ? 'openrouter' : keys.openai === true ? 'openai' : 'local'
  if (mind === 'cursor') {
    if (keys.cursor === true) return 'cursor'
    if (keys.openai === true) return 'openai'
    if (keys.openrouter === true) return 'openrouter'
    return 'local'
  }
  return 'local'
}

/** Design generate is Chat Completions + tools. Cursor is never a Design mind. */
export function designMind(raw) {
  const m = takeMind(raw)
  if (m === 'openai' || m === 'openrouter') return m
  return 'local'
}

export function taskNeedsDesignTools(task, flag) {
  if (flag === true) return true
  return /\bdesign_(?:get|patch|ingest_tokens)\b/.test(String(task || ''))
}

/** Cursor Cloud Agents never call design_get/design_patch. Remint to a tool loop. */
export function forgeForDesign(picked, keys) {
  const k = keys && typeof keys === 'object' && !Array.isArray(keys) ? keys : {}
  const p = String(picked || '')
  if (p === 'openai' || p === 'openrouter' || p === 'local') return p
  if (k.openai === true) return 'openai'
  if (k.openrouter === true) return 'openrouter'
  return 'local'
}

export function forgeFallbackNote(mind, keys) {
  const m = takeMind(mind) || 'local'
  const k = keys && typeof keys === 'object' && !Array.isArray(keys) ? keys : {}
  if (m === 'local' || m === 'cursor') return ''
  const picked = pickForgeProvider({ mind: m, keys: k })
  if (picked === m) return ''
  const want = m === 'openai' ? 'OpenAI' : 'OpenRouter'
  if (picked === 'local') return `${want} key missing — using local. Set ${want} key in Settings.`
  if (picked === 'openrouter') return `${want} key missing — using OpenRouter.`
  if (picked === 'openai') return `${want} key missing — using OpenAI.`
  return ''
}

export function forgeTurnCap(needsTools) {
  return needsTools === true ? 20 : 12
}

/** First-turn instruction. DesignIR must not start with explore. */
export function forgeActHint(mode, task, needsTools) {
  if (taskNeedsDesignTools(task, needsTools === true)) {
    return 'Call design_get then design_patch on that slug. design_ingest_tokens is allowed for local DTCG. Ops are add/remove/replace with a path. Do not explore. Never fs_write the IR. No HTML. No url() in styles.'
  }
  const m = String(mode || 'agent')
  if (m === 'ask') return 'Answer directly. Tools only to read. Prefer explore over grep.'
  if (m === 'think') {
    return 'The perceive pack is already attached. Fill gaps with explore/code_outline. Then plan_write a .think.md with status ready. No product edits.'
  }
  if (m === 'plan') return 'Research with explore/read. Write the plan to RAG/plans/. ask_user if blocked.'
  return 'Start by gathering (explore) unless this is a pure question you can answer from memory hits.'
}

export function takeKernelHealth(raw) {
  const empty = { llama: 'off', openai: false, openrouter: false, cursor: false, cursorJobs: [] }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty
  return {
    llama: LLAMA.has(raw.llama) ? raw.llama : 'off',
    openai: raw.openai === true,
    openrouter: raw.openrouter === true,
    cursor: raw.cursor === true,
    cursorJobs: cursorJobList(raw.cursorJobs)
  }
}

export function healthPulse(raw) {
  const h = takeKernelHealth(raw)
  const keys = [h.openai && 'openai', h.openrouter && 'openrouter', h.cursor && 'cursor'].filter(Boolean)
  const job = h.cursorJobs[0]
  return {
    llama: h.llama,
    keys: keys.join(' · ') || 'none',
    cursor: job ? `${job.status} · ${job.name}` : h.cursor ? 'ready' : 'off'
  }
}

export function publicMindError(err) {
  const s = redactCloudText(err instanceof Error ? err.message : String(err || 'failed'))
  if (/Model missing|ENOENT|llama-server/i.test(s)) {
    return 'Offline mind is not loaded. Drop a GGUF or pick Cloud / Cursor.'
  }
  if (/Cursor agents|did not start/i.test(s)) return 'Cursor Cloud Agents did not start.'
  return s
    .replace(/Bearer\s+\S+/gi, '[redacted]')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/\/(?:home|Users|root)\/\S+/g, '[path]')
    .slice(0, 160) || 'failed'
}

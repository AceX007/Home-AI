#!/usr/bin/env node
/**
 * Headless Design generate prove: same designTask string as Design Home ↑.
 * Talks to llama on 127.0.0.1:8765 and optional OpenAI/OpenRouter via env keys.
 * Never prints key material. Writes designs/prove-pitch.design.json under the workspace.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyDesignPatch } from './designir.mjs'
import { designGetContent, designRel, designTask, irGrew, seedDesignIR } from './design-path.mjs'
import { parseQwenToolCalls, parseToolArguments } from './qwen-tools.mjs'
import { forgeActHint, forgeForDesign, pickForgeProvider } from './mind.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const SLUG = 'prove-pitch'
const BRIEF = 'Make a pitch deck for a new product'
const PORT = Number(process.env.HOMEAI_LLAMA_PORT || 8765)
const TURNS = Math.min(8, Math.max(2, Number(process.env.HOMEAI_PROVE_TURNS || 6)))

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'design_get',
      description: 'Read DesignIR by slug id. Never a filesystem path.',
      parameters: { type: 'object', properties: { id: { type: 'string' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'design_patch',
      description: 'RFC 6902 envelope. Pass id, baseRevision, patch. Example: [{"op":"add","path":"/pages/-","value":{"id":"p3","name":"Ask"}}]. No HTML.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          baseRevision: { type: 'string' },
          patch: { type: 'array' }
        },
        required: ['patch']
      }
    }
  }
]

function takeAppKey(name) {
  const envName = name === 'openai' ? 'OPENAI_API_KEY' : 'OPENROUTER_API_KEY'
  const env = process.env[envName]
  if (typeof env === 'string' && env.trim()) return env.trim()
  try {
    const p = join(ROOT, 'data', 'secrets', `${name}.key`)
    if (!existsSync(p)) return null
    const v = readFileSync(p, 'utf8').trim()
    return v || null
  } catch {
    return null
  }
}

async function chatOnce(opts) {
  const headers = { 'Content-Type': 'application/json' }
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`
  const body = {
    model: opts.model,
    messages: opts.messages,
    tools: TOOLS,
    tool_choice: opts.patched ? 'auto' : 'required',
    stream: false,
    temperature: 0.15
  }
  const res = await fetch(opts.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000)
  })
  const raw = await res.text()
  if (!res.ok) throw new Error(`${opts.mind} ${res.status}: ${raw.slice(0, 240)}`)
  let json
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error(`${opts.mind} bad json`)
  }
  const msg = json.choices?.[0]?.message || {}
  const native = Array.isArray(msg.tool_calls) ? msg.tool_calls : []
  const calls = native.length
    ? native.map((c, i) => ({
        id: c.id || `call_${i}`,
        name: String(c.function?.name || ''),
        arguments: parseToolArguments(c.function?.arguments || '')
      }))
    : parseQwenToolCalls(String(msg.content || ''))
  return { content: String(msg.content || ''), calls, rawFinish: String(json.choices?.[0]?.finish_reason || '') }
}

function runTools(doc, calls) {
  const out = []
  let next = doc
  let lastErr = ''
  let lastPatch = []
  let lastRaw = ''
  for (const call of calls) {
    if (call.name === 'design_get') {
      out.push({
        role: 'tool',
        name: 'design_get',
        tool_call_id: call.id,
        content: designGetContent(next)
      })
      continue
    }
    if (call.name === 'design_patch') {
      try {
        const rawArgs = call.arguments && typeof call.arguments === 'object' ? call.arguments : {}
        if (typeof rawArgs._raw === 'string' && rawArgs._raw) lastRaw = rawArgs._raw.slice(0, 500)
        lastPatch = [
          {
            op: 'keys',
            path: Object.getOwnPropertyNames(rawArgs).join(',').slice(0, 80)
          }
        ]
        const patch = Array.isArray(rawArgs.patch) ? rawArgs.patch : []
        lastPatch = lastPatch.concat(
          patch.slice(0, 8).map((op) => ({
            op: String(op?.op || ''),
            path: String(op?.path || '').slice(0, 80)
          }))
        )
        const env = {
          id: call.arguments?.id,
          baseRevision: call.arguments?.baseRevision || next.revision,
          patch: call.arguments?.patch,
          _raw: typeof call.arguments?._raw === 'string' ? call.arguments._raw : undefined
        }
        const applied = applyDesignPatch(next, env)
        next = applied.doc
        lastErr = ''
        out.push({
          role: 'tool',
          name: 'design_patch',
          tool_call_id: call.id,
          content: `revision ${next.revision}`
        })
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err)
        out.push({
          role: 'tool',
          name: 'design_patch',
          tool_call_id: call.id,
          content: `err ${lastErr}`.slice(0, 400)
        })
      }
      continue
    }
    out.push({
      role: 'tool',
      name: call.name || 'unknown',
      tool_call_id: call.id,
      content: 'unknown tool'
    })
  }
  return { doc: next, toolMsgs: out, lastErr, lastPatch, lastRaw }
}

async function proveMind(mind, url, apiKey, model) {
  const seed = seedDesignIR({ slug: SLUG, brief: BRIEF, template: 'slides', name: 'Pitch' })
  const task = designTask(SLUG, BRIEF, 'slides')
  const sys =
    'You are Hex AI Kernel. This task is DesignIR. Only design_get and design_patch. No explore. No fs_write of the IR file. No HTML. No url() in styles.'
  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: `Task:\n${task}\n\n${forgeActHint('agent', task, true)}` }
  ]
  let doc = seed
  let patched = false
  const names = []
  let lastErr = ''
  let lastPatch = []
  let lastRaw = ''
  for (let turn = 0; turn < TURNS; turn++) {
    const step = await chatOnce({ mind, url, apiKey, model, messages, patched })
    if (!step.calls.length) break
    names.push(...step.calls.map((c) => c.name))
    messages.push({
      role: 'assistant',
      content: step.content,
      tool_calls: step.calls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: JSON.stringify(c.arguments || {}) }
      }))
    })
    const beforeRev = doc.revision
    const ran = runTools(doc, step.calls)
    doc = ran.doc
    if (ran.lastErr) lastErr = ran.lastErr
    if (ran.lastPatch?.length) lastPatch = ran.lastPatch
    if (ran.lastRaw) lastRaw = ran.lastRaw
    if (doc.revision !== beforeRev) patched = true
    messages.push(...ran.toolMsgs)
    if (irGrew(seed, doc)) break
  }
  return {
    mind,
    irGrew: irGrew(seed, doc),
    pages: Array.isArray(doc.pages) ? doc.pages.length : 0,
    nodes: doc.nodes && typeof doc.nodes === 'object' ? Object.getOwnPropertyNames(doc.nodes).length : 0,
    tools: names.slice(0, 12),
    revision: doc.revision,
    lastErr: lastErr.slice(0, 160),
    lastPatch,
    lastRaw: lastRaw.slice(0, 500),
    doc
  }
}

async function llamaUp() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/v1/models`, { signal: AbortSignal.timeout(800) })
    return res.ok
  } catch {
    return false
  }
}

const rows = []
const keys = { openai: Boolean(takeAppKey('openai')), openrouter: Boolean(takeAppKey('openrouter')), cursor: false }
if (await llamaUp()) {
  try {
    rows.push(await proveMind('local', `http://127.0.0.1:${PORT}/v1/chat/completions`, null, 'local'))
  } catch (err) {
    rows.push({ mind: 'local', irGrew: false, error: err instanceof Error ? err.message.slice(0, 200) : String(err) })
  }
} else {
  rows.push({ mind: 'local', irGrew: false, error: `llama off :${PORT}` })
}

for (const mind of ['openai', 'openrouter']) {
  const picked = pickForgeProvider({ mind, keys })
  const remint = forgeForDesign(picked, keys)
  const key = takeAppKey(mind)
  if (!key) {
    rows.push({ mind, irGrew: false, error: `${mind} key missing`, remint })
    continue
  }
  const url = mind === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions'
  const model = mind === 'openai' ? 'gpt-4.1-mini' : 'openrouter/auto'
  try {
    rows.push(await proveMind(mind, url, key, model))
  } catch (err) {
    rows.push({ mind, irGrew: false, error: err instanceof Error ? err.message.slice(0, 200) : String(err), remint })
  }
}

const grown = rows.find((r) => r.irGrew && r.doc)
if (grown?.doc) {
  const dest = join(ROOT, designRel(SLUG))
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, JSON.stringify(grown.doc, null, 2) + '\n', 'utf8')
}

const publicRows = rows.map((r) => {
  const { doc, ...rest } = r
  return rest
})
const out = join(ROOT, 'RAG', 'library', 'discoveries', 'design-generate-live.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), slug: SLUG, rows: publicRows }, null, 2) + '\n', 'utf8')
console.log(JSON.stringify(publicRows, null, 2))
if (!publicRows.some((r) => r.irGrew)) process.exitCode = 2

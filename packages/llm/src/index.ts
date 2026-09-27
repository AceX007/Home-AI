import { spawn, type ChildProcess } from 'node:child_process'
import { chmod, mkdir } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { parseToolArguments } from '../../runtime/src/qwen-tools.mjs'
import { takeSseUsage } from '../../runtime/src/activity.mjs'
import { DEFAULT_IDLE_UNLOAD_MS, DEFAULT_LLAMA_PORT, type LlamaLoadArgs, type LlmStatus } from '@homeai/core'
import { shouldAttachExistingListener, ownedLlamaPort, pickInfillPort } from './sidecar-own.mjs'

const execFileAsync = promisify(execFile)

export interface SecretStore {
  get(name: string): Promise<string | null>
}

export interface LlamaServerHandle {
  process: ChildProcess | null
  status: LlmStatus
  stop(): Promise<void>
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function portOpen(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(800) })
    return res.ok
  } catch {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/v1/models`, { signal: AbortSignal.timeout(800) })
      return res.ok
    } catch {
      return false
    }
  }
}

export async function detectLmStudio(): Promise<number | null> {
  for (const port of [1234, 41343]) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/v1/models`, { signal: AbortSignal.timeout(600) })
      if (res.ok) return port
    } catch {
      /* empty */
    }
  }
  return null
}

export function findLlamaBinary(vendorDir: string): string | null {
  const names = ['llama-server', 'llama-server.exe']
  const dirs = [join(vendorDir, 'bin'), vendorDir]
  for (const d of dirs) {
    for (const n of names) {
      const c = join(d, n)
      if (existsSync(c)) return c
    }
  }
  return null
}

export async function whichLlamaServer(): Promise<string | null> {
  const cmd = process.platform === 'win32' ? 'where' : 'which'
  const bin = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'
  try {
    const { stdout } = await execFileAsync(cmd, [bin])
    const p = stdout.trim().split(/\r?\n/)[0]
    return p || null
  } catch {
    return null
  }
}

export async function ensureLlamaServer(vendorDir: string): Promise<string> {
  const local = findLlamaBinary(vendorDir)
  if (local) return local
  const onPath = await whichLlamaServer()
  if (onPath) return onPath
  throw new Error(
    'llama-server not found. Run: bash vendor/fetch-llama-server.sh  (or install llama.cpp Vulkan)'
  )
}

export class LlamaServerManager {
  private child: ChildProcess | null = null
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private idleMs: number
  status: LlmStatus = { running: false, backend: 'none' }

  constructor(
    private vendorDir: string,
    idleMs = DEFAULT_IDLE_UNLOAD_MS
  ) {
    this.idleMs = idleMs
  }

  touch(): void {
    this.status.lastUsedAt = Date.now()
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => {
      void this.stop()
    }, this.idleMs)
  }

  async start(args: LlamaLoadArgs, binary?: string, mode?: 'sidecar'): Promise<LlmStatus> {
    if (this.child && this.status.running) {
      this.touch()
      return this.status
    }

    const sidecar = mode === 'sidecar'

    if (!sidecar) {
      const lm = await detectLmStudio()
      if (lm && !binary) {
        this.status = {
          running: true,
          backend: 'lmstudio',
          port: lm,
          loadedAt: Date.now(),
          lastUsedAt: Date.now(),
          modelPath: args.modelPath
        }
        this.touch()
        return this.status
      }
    }

    const open = await portOpen(args.port)
    if (shouldAttachExistingListener({ sidecar, portOpen: open })) {
      this.status = {
        running: true,
        backend: 'llama-server',
        port: args.port,
        loadedAt: Date.now(),
        lastUsedAt: Date.now(),
        modelPath: args.modelPath
      }
      this.touch()
      return this.status
    }
    if (sidecar && open) {
      throw new Error(`coder sidecar port ${args.port} already in use`)
    }

    const bin = binary ?? (await ensureLlamaServer(this.vendorDir))
    const argv = [
      '-m',
      args.modelPath,
      '--host',
      args.host,
      '--port',
      String(args.port),
      '-c',
      String(args.contextSize),
      '-b',
      String(args.batchSize),
      '-ngl',
      String(args.nGpuLayers),
      '-t',
      String(args.threads),
      '--jinja',
      '--no-mmap'
    ]
    if (args.nGpuLayers === 0) {
      argv.push('--mmap')
      const idx = argv.indexOf('--no-mmap')
      if (idx >= 0) argv.splice(idx, 1)
    }

    const libDir = dirname(bin)
    const ld = process.env.LD_LIBRARY_PATH
    this.child = spawn(bin, argv, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        LD_LIBRARY_PATH: ld ? `${libDir}:${ld}` : libDir
      }
    })
    let stderr = ''
    this.child.stderr?.on('data', (d) => {
      stderr += String(d)
      if (stderr.length > 32_000) stderr = stderr.slice(-16_000)
    })
    this.child.on('exit', (code) => {
      if (this.status.running) {
        this.status = {
          running: false,
          backend: 'none',
          error: code === 0 ? undefined : `llama-server exited ${code}: ${stderr.slice(-500)}`
        }
      }
      this.child = null
    })

    const deadline = Date.now() + 90_000
    while (Date.now() < deadline) {
      if (this.child && this.child.exitCode != null) {
        throw new Error(`llama-server failed: ${stderr.slice(-800)}`)
      }
      if (await portOpen(args.port)) {
        this.status = {
          running: true,
          backend: 'llama-server',
          port: args.port,
          modelPath: args.modelPath,
          loadedAt: Date.now(),
          lastUsedAt: Date.now()
        }
        this.touch()
        return this.status
      }
      await sleep(400)
    }
    await this.stop()
    throw new Error(`llama-server did not become ready. ${stderr.slice(-800)}`)
  }

  /** Second child only. Never attach to a foreign /health; LM Studio is not the coder. */
  async startSidecar(args: LlamaLoadArgs): Promise<LlmStatus> {
    const bin = await ensureLlamaServer(this.vendorDir)
    return this.start(args, bin, 'sidecar')
  }

  async stop(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
    const child = this.child
    this.child = null
    if (child && child.exitCode == null) {
      child.kill('SIGTERM')
      await sleep(800)
      if (child.exitCode == null) child.kill('SIGKILL')
    }
    this.status = { running: false, backend: 'none' }
  }
}

interface OpenAiToolCallDelta {
  index?: number
  id?: string
  function?: { name?: string; arguments?: string }
}

function openaiBase(provider: Exclude<ProviderId, 'cursor'>, localPort: number): {
  url: string
  headers: Record<string, string>
} {
  if (provider === 'local') {
    return { url: `http://127.0.0.1:${localPort}/v1/chat/completions`, headers: {} }
  }
  if (provider === 'openai') {
    return { url: 'https://api.openai.com/v1/chat/completions', headers: {} }
  }
  return { url: 'https://openrouter.ai/api/v1/chat/completions', headers: { 'HTTP-Referer': 'https://home-ai.local', 'X-Title': 'Hex AI Workbench' } }
}

function defaultModel(provider: Exclude<ProviderId, 'cursor'>): string {
  if (provider === 'local') return 'local'
  if (provider === 'openai') return 'gpt-4.1-mini'
  return 'openrouter/auto'
}

export async function* chatCompletions(opts: {
  provider: Exclude<ProviderId, 'cursor'>
  apiKey?: string | null
  localPort: number
  messages: ChatMessage[]
  tools?: ToolDef[]
  model?: string
  temperature?: number
  signal?: AbortSignal
  toolChoice?: 'auto' | 'required' | 'none'
}): AsyncGenerator<StreamChunk> {
  const base = openaiBase(opts.provider, opts.localPort)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...base.headers
  }
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`

  const tools = opts.tools?.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }))

  const body: Record<string, unknown> = {
    model: opts.model ?? defaultModel(opts.provider),
    messages: opts.messages.map((m) => {
      const row: Record<string, unknown> = { role: m.role, content: m.content }
      if (m.toolCallId) row.tool_call_id = m.toolCallId
      if (m.name) row.name = m.name
      if (m.toolCalls?.length) {
        row.tool_calls = m.toolCalls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.arguments) }
        }))
      }
      return row
    }),
    stream: true,
    temperature: opts.temperature ?? 0.3
  }
  if (opts.provider !== 'local') {
    body.stream_options = { include_usage: true }
  }
  if (tools?.length) {
    body.tools = tools
    if (opts.toolChoice === 'required' || opts.toolChoice === 'none' || opts.toolChoice === 'auto') {
      body.tool_choice = opts.toolChoice
    }
  }

  const res = await fetch(base.url, { method: 'POST', headers, body: JSON.stringify(body), signal: opts.signal })
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => res.statusText)
    yield { type: 'error', error: `${opts.provider} ${res.status}: ${err.slice(0, 800)}` }
    return
  }

  const pending = new Map<number, { id: string; name: string; args: string }>()
  const decoder = new TextDecoder()
  let buf = ''
  const reader = res.body.getReader()
  let usageTotal = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') {
        for (const p of pending.values()) {
          yield { type: 'tool_call', toolCall: { id: p.id, name: p.name, arguments: parseToolArguments(p.args) } }
        }
        if (usageTotal) yield { type: 'usage', usage: { total: usageTotal } }
        yield { type: 'done' }
        return
      }
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{
            delta?: {
              content?: string
              tool_calls?: OpenAiToolCallDelta[]
            }
            finish_reason?: string
          }>
          usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number }
          timings?: { prompt_n?: number; predicted_n?: number }
        }
        const n = takeSseUsage(json)
        if (n) usageTotal = n
        const delta = json.choices?.[0]?.delta
        if (delta?.content) yield { type: 'text', text: delta.content }
        for (const tc of delta?.tool_calls ?? []) {
          const idx = tc.index ?? 0
          const cur = pending.get(idx) ?? { id: tc.id ?? `call_${idx}`, name: '', args: '' }
          if (tc.id) cur.id = tc.id
          if (tc.function?.name) cur.name += tc.function.name
          if (tc.function?.arguments) cur.args += tc.function.arguments
          pending.set(idx, cur)
        }
      } catch {
        /* ignore malformed sse */
      }
    }
  }
  if (usageTotal) yield { type: 'usage', usage: { total: usageTotal } }
  yield { type: 'done' }
}

export { parseQwenToolCalls, parseToolArguments } from '../../runtime/src/qwen-tools.mjs'

export async function cursorLaunchAgent(opts: {
  apiKey: string
  prompt: string
  repositoryUrl?: string
  model?: string
}): Promise<{ id?: string; raw: unknown }> {
  const payload: Record<string, unknown> = {
    prompt: { text: opts.prompt },
    model: { id: opts.model ?? 'composer-2' }
  }
  if (opts.repositoryUrl) {
    payload.repos = [{ url: opts.repositoryUrl, startingRef: 'main' }]
  }
  const res = await fetch('https://api.cursor.com/v1/agents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  const raw = await res.json().catch(async () => ({ error: await res.text() }))
  if (!res.ok) throw new Error(`Cursor agents ${res.status}: ${JSON.stringify(raw).slice(0, 600)}`)
  return { id: (raw as { id?: string }).id, raw }
}

export async function cursorGetAgent(apiKey: string, id: string): Promise<unknown> {
  const res = await fetch(`https://api.cursor.com/v1/agents/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  })
  return res.json()
}

export async function cursorListAgents(apiKey: string): Promise<unknown> {
  const res = await fetch('https://api.cursor.com/v1/agents', {
    headers: { Authorization: `Bearer ${apiKey}` }
  })
  return res.json()
}

/** unused helper kept for future binary cache */
export async function downloadToFile(url: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true })
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`download failed ${res.status}`)
  const file = createWriteStream(dest)
  await pipeline(Readable.fromWeb(res.body as never), file)
  await chmod(dest, 0o755)
}

export async function completeOnce(opts: Parameters<typeof chatCompletions>[0]): Promise<string> {
  let out = ''
  for await (const chunk of chatCompletions({ ...opts, tools: undefined })) {
    if (chunk.type === 'text' && chunk.text) out += chunk.text
    if (chunk.type === 'error') throw new Error(chunk.error)
  }
  return out.replace(/^```[\w+-]*\n?/, '').replace(/\n?```\s*$/, '').trim()
}

/** Ghost-text Tab. Tries llama-server /infill, then a cheap prefix completion. */
export async function infillOnce(opts: {
  localPort: number
  prefix: string
  suffix: string
  nPredict?: number
  signal?: AbortSignal
}): Promise<string> {
  const n = opts.nPredict ?? 48
  const prefix = opts.prefix.slice(-4000)
  const suffix = opts.suffix.slice(0, 1500)
  try {
    const res = await fetch(`http://127.0.0.1:${opts.localPort}/infill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
        signal: opts.signal ?? AbortSignal.timeout(2_500),
      body: JSON.stringify({
        input_prefix: prefix,
        input_suffix: suffix,
        n_predict: n,
        temperature: 0.1,
        stop: ['\n\n', '<|endoftext|>', '<|fim_suffix|>']
      })
    })
    if (res.ok) {
      const json = (await res.json()) as { content?: string; completion?: string }
      const text = (json.content ?? json.completion ?? '').replace(/\r/g, '')
      if (text.trim()) return text.split('\n').slice(0, 8).join('\n')
    }
  } catch {
    /* fall through */
  }
  const prompt = `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`
  try {
    const res = await fetch(`http://127.0.0.1:${opts.localPort}/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
        signal: opts.signal ?? AbortSignal.timeout(2_500),
      body: JSON.stringify({ prompt, n_predict: n, temperature: 0.1, stop: ['<|fim_prefix|>', '<|endoftext|>', '\n\n'] })
    })
    if (res.ok) {
      const json = (await res.json()) as { content?: string }
      return (json.content ?? '').split('\n').slice(0, 8).join('\n')
    }
  } catch {
    /* ignore */
  }
  return ''
}

/** Separate llama-server child. Do not reuse the 2B manager. */
export function createCoderManager(vendorDir: string): LlamaServerManager {
  return new LlamaServerManager(vendorDir)
}

export { pickInfillPort, ownedLlamaPort, shouldAttachExistingListener }
export { DEFAULT_LLAMA_PORT }

import { EventEmitter } from 'node:events'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync, realpathSync } from 'node:fs'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'])
const MAX_ARGS = 8
const MAX_EVAL = 80
const MAX_FRAMES = 24
const MAX_LOCALS = 40
const MAX_CONSOLE = 40

function own(raw, key) {
  return Boolean(raw && typeof raw === 'object' && !Array.isArray(raw) && Object.prototype.hasOwnProperty.call(raw, key))
}

function inside(root, candidate) {
  const rel = relative(root, candidate)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function redact(value) {
  return String(value ?? '')
    .replace(/[<>]/g, '')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

function cleanEnv() {
  const env = Object.create(null)
  env.PATH = process.env.PATH || '/usr/bin:/bin'
  env.HOME = process.env.HOME || '/tmp'
  env.LANG = process.env.LANG || 'C'
  env.TZ = process.env.TZ || 'UTC'
  env.TERM = 'dumb'
  return env
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = addr && typeof addr === 'object' ? addr.port : 0
      server.close(() => resolvePort(port))
    })
  })
}

function scriptUrl(abs) {
  try {
    return pathToFileURL(abs).href
  } catch {
    return ''
  }
}

function fromScriptUrl(url) {
  const s = String(url || '')
  if (s.startsWith('file:')) {
    try {
      return fileURLToPath(s)
    } catch {
      return null
    }
  }
  if (s.startsWith('/') && !s.includes('\0') && !s.includes('..')) return s
  return null
}

export function takeInspectWs(raw) {
  const text = String(raw || '')
  if (/\b0\.0\.0\.0\b/.test(text)) return null
  const m = text.match(/ws:\/\/127\.0\.0\.1:(\d+)(\/[0-9A-Fa-f-]+)/)
  if (!m) return null
  const port = Number(m[1])
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  return `ws://127.0.0.1:${port}${m[2]}`
}

export function takeDebugLaunch(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  if (!own(raw, 'path') || typeof raw.path !== 'string' || raw.path.includes('\0')) return null
  const path = raw.path.slice(0, 4096)
  if (!path || path.includes('..')) return null
  const args = []
  if (own(raw, 'args')) {
    if (!Array.isArray(raw.args)) return null
    for (const item of raw.args.slice(0, MAX_ARGS)) {
      if (typeof item !== 'string' || !item || item.startsWith('-') || /[;|&$`\\]/.test(item) || item.includes('..')) {
        return null
      }
      args.push(item.slice(0, 200))
    }
  }
  const out = Object.create(null)
  out.path = path
  out.args = args
  return out
}

export function takeDebugBreakpoint(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  if (!own(raw, 'path') || typeof raw.path !== 'string' || raw.path.includes('\0') || raw.path.includes('..')) return null
  const line = own(raw, 'line') ? Number(raw.line) : 0
  if (!Number.isFinite(line) || line < 1 || line > 1_000_000) return null
  const out = Object.create(null)
  out.path = raw.path.slice(0, 4096)
  out.line = Math.floor(line)
  out.enabled = own(raw, 'enabled') ? Boolean(raw.enabled) : true
  return out
}

export function takeDebugEval(raw) {
  const expr = typeof raw === 'string'
    ? raw
    : raw && typeof raw === 'object' && !Array.isArray(raw) && own(raw, 'expression') && typeof raw.expression === 'string'
      ? raw.expression
      : ''
  const text = String(expr).trim()
  if (!text || text.length > MAX_EVAL) return null
  if (/[\n;`\\]|process|require|import|Function|eval|child_process|constructor|globalThis|\bthis\b/.test(text)) {
    return null
  }
  if (
    !/^(?:[A-Za-z_][A-Za-z0-9_]*|'[^'\\]{0,40}'|"[^"\\]{0,40}"|\d+(?:\.\d+)?|true|false|null)(?:\s*[+\-*/]\s*(?:[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?))*$/.test(
      text
    )
  ) {
    return null
  }
  return text
}

export function takeDebugContinue(raw) {
  const kind =
    typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object' && !Array.isArray(raw) && own(raw, 'kind')
        ? String(raw.kind)
        : 'continue'
  if (kind === 'continue' || kind === 'stepOver' || kind === 'stepInto' || kind === 'stepOut') return kind
  return null
}

function testFailurePath(raw) {
  let path = String(raw || '')
  if (path.startsWith('file://')) {
    try {
      path = decodeURIComponent(new URL(path).pathname)
    } catch {
      return null
    }
  }
  if (!path || path.includes('..') || path.includes('\0') || /:\/\//.test(path)) return null
  return path.slice(0, 4096)
}

export function takeTestFailure(content) {
  const text = String(content || '')
  const loc =
    text.match(/location:\s*['"]((?:file:\/\/)?[^'"]+\.(?:mjs|js|cjs|ts|mts|cts)):(\d+)/) ||
    text.match(/\bat\s+\S+\s+\(((?:file:\/\/)?[^)\s]+\.(?:mjs|js|cjs|ts|mts|cts)):(\d+)(?::\d+)?\)/) ||
    text.match(/\bat\s+((?:file:\/\/)?[A-Za-z0-9_./-]+\.(?:mjs|js|cjs|ts|mts|cts)):(\d+)(?::\d+)?/)
  if (!loc) return null
  const path = testFailurePath(loc[1])
  const line = Number(loc[2])
  if (!path || !Number.isFinite(line) || line < 1) return null
  const out = Object.create(null)
  out.path = path
  out.line = Math.floor(line)
  return out
}

export function publicDebugError(err) {
  return String(err instanceof Error ? err.message : 'Debug session failed')
    .replace(/[<>]/g, '')
    .slice(0, 240)
}

function attachCdp(ws, onEvent) {
  const pending = new Map()
  let seq = 0
  ws.addEventListener('message', (ev) => {
    let msg
    try {
      msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data))
    } catch {
      return
    }
    if (msg && msg.id && pending.has(msg.id)) {
      const row = pending.get(msg.id)
      pending.delete(msg.id)
      clearTimeout(row.t)
      if (msg.error) row.reject(new Error(redact(msg.error.message || 'inspector error')))
      else row.resolve(msg.result || {})
      return
    }
    if (msg && typeof msg.method === 'string') onEvent(msg.method, msg.params || {})
  })
  return {
    send(method, params) {
      const id = ++seq
      return new Promise((resolveSend, reject) => {
        const t = setTimeout(() => {
          pending.delete(id)
          reject(new Error('inspector timeout'))
        }, 8000)
        pending.set(id, { resolve: resolveSend, reject, t })
        ws.send(JSON.stringify({ id, method, params: params || {} }))
      })
    },
    close() {
      for (const row of pending.values()) {
        clearTimeout(row.t)
        row.reject(new Error('inspector closed'))
      }
      pending.clear()
      try {
        ws.close()
      } catch {
        /* closed */
      }
    }
  }
}

export class NodeDebugHost extends EventEmitter {
  constructor(workspace) {
    super()
    this.root = realpathSync(resolve(String(workspace)))
    this.status = 'idle'
    this.path = null
    this.port = null
    this.frames = []
    this.locals = []
    this.watches = []
    this.console = []
    this.testFailure = null
    this.breakpoints = []
    this.child = null
    this.rpc = null
    this.callFrameId = ''
    this.skipEntry = true
    this.generation = 0
  }

  jail(raw, mustExist = true) {
    if (typeof raw !== 'string' || raw.includes('\0')) return null
    const candidate = resolve(this.root, raw)
    if (!inside(this.root, candidate)) return null
    if (!mustExist) return candidate
    try {
      const real = existsSync(candidate) ? realpathSync(candidate) : null
      return real && inside(this.root, real) ? real : null
    } catch {
      return null
    }
  }

  relOf(abs) {
    const rel = relative(this.root, abs).replace(/\\/g, '/')
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null
    return rel
  }

  snapshot() {
    const out = Object.create(null)
    out.status = this.status
    out.path = this.path
    out.port = this.port
    out.frames = this.frames.slice(0, MAX_FRAMES)
    out.locals = this.locals.slice(0, MAX_LOCALS)
    out.watches = this.watches.slice(0, 16)
    out.console = this.console.slice(-MAX_CONSOLE)
    out.testFailure = this.testFailure
    return out
  }

  perceiveLine() {
    const top = this.frames[0]
    if (!top) return this.status === 'idle' ? '' : redact(this.status)
    const locals = this.locals
      .slice(0, 4)
      .map((row) => `${row.name}=${row.value}`)
      .join(' ')
    return redact(`${this.status} ${top.path}:${top.line} ${locals}`)
  }

  noteTestFailure(raw) {
    const hit = takeTestFailure(raw)
    if (!hit) return null
    const file = this.jail(hit.path, false)
    const rel = file ? this.relOf(file) : hit.path.includes('/') && !hit.path.startsWith('/') ? hit.path : null
    if (!rel) return null
    this.testFailure = { path: rel, line: hit.line }
    return this.testFailure
  }

  async start(raw) {
    const req = takeDebugLaunch(raw)
    if (!req) throw new Error('Debug target is outside the workspace jail')
    const file = this.jail(req.path, true)
    if (!file || !SCRIPT_EXTS.has(extname(file).toLowerCase())) throw new Error('Debug target is outside the workspace jail')
    await this.stop()
    try {
    const port = await freePort()
    if (!port) throw new Error('Debug port unavailable')
    const nodeArgs = []
    if (extname(file).toLowerCase().includes('ts')) nodeArgs.push('--experimental-strip-types')
    nodeArgs.push(`--inspect-brk=127.0.0.1:${port}`, file, ...req.args)
    const gen = ++this.generation
    this.status = 'running'
    this.path = this.relOf(file)
    this.port = port
    this.skipEntry = true
    this.frames = []
    this.locals = []
    this.watches = []
    this.console = []
    this.child = spawn(process.execPath, nodeArgs, {
      cwd: this.root,
      env: cleanEnv(),
      stdio: ['ignore', 'pipe', 'pipe']
    })
    this.child.stderr?.setEncoding('utf8')
    this.child.stdout?.setEncoding('utf8')
    this.child.on('exit', () => {
      if (this.generation !== gen) return
      this.status = 'exited'
      this.port = null
      this.emit('exit', this.snapshot())
    })
    let buf = ''
    const wsUrl = await new Promise((resolveUrl, reject) => {
      const t = setTimeout(() => reject(new Error('inspector url timeout')), 8000)
      const onData = (chunk) => {
        buf += String(chunk)
        if (/\b0\.0\.0\.0\b/.test(buf)) {
          clearTimeout(t)
          reject(new Error('inspector bound publicly'))
          return
        }
        const url = takeInspectWs(buf)
        if (url) {
          clearTimeout(t)
          resolveUrl(url)
        }
      }
      this.child.stderr?.on('data', onData)
      this.child.stdout?.on('data', onData)
      this.child.on('error', (err) => {
        clearTimeout(t)
        reject(err)
      })
    })
    if (this.generation !== gen) return this.snapshot()
    const ws = new WebSocket(wsUrl)
    await new Promise((resolveOpen, reject) => {
      const t = setTimeout(() => reject(new Error('inspector connect timeout')), 8000)
      ws.addEventListener('open', () => {
        clearTimeout(t)
        resolveOpen()
      })
      ws.addEventListener('error', () => {
        clearTimeout(t)
        reject(new Error('inspector socket failed'))
      })
    })
    this.rpc = attachCdp(ws, (method, params) => {
      void this.onCdp(method, params, gen)
    })
    await this.rpc.send('Debugger.enable')
    await this.rpc.send('Runtime.enable')
    for (const bp of this.breakpoints) {
      if (bp.enabled) await this.armBreakpoint(bp)
    }
    const paused = this.waitPaused(12_000)
    await this.rpc.send('Runtime.runIfWaitingForDebugger')
    await paused
    return this.snapshot()
  } catch (err) {
    await this.stop()
    throw err
  }
  }

  async onCdp(method, params, gen) {
    if (this.generation !== gen) return
    if (method === 'Runtime.consoleAPICalled') {
      const bits = Array.isArray(params.args)
        ? params.args.map((arg) => redact(arg?.value ?? arg?.description ?? '')).filter(Boolean)
        : []
      const line = bits.join(' ')
      if (line) this.console.push(line.slice(0, 200))
      if (this.console.length > MAX_CONSOLE) this.console = this.console.slice(-MAX_CONSOLE)
      return
    }
    if (method !== 'Debugger.paused') return
    if (this.skipEntry) {
      this.skipEntry = false
      const line = Number(params.callFrames?.[0]?.location?.lineNumber) + 1
      const hit = this.breakpoints.some((bp) => bp.enabled && bp.line === line)
      if (!hit) {
        try {
          await this.rpc?.send('Debugger.resume')
        } catch {
          /* process may already be at the user breakpoint */
        }
        return
      }
    }
    await this.collectPaused(params)
    this.status = 'paused'
    this.emit('paused', this.snapshot())
  }

  waitPaused(ms) {
    if (this.status === 'paused' && !this.skipEntry) return Promise.resolve(this.snapshot())
    return new Promise((resolvePaused, reject) => {
      const t = setTimeout(() => reject(new Error('debug timeout')), ms)
      const onPaused = () => {
        clearTimeout(t)
        this.off('paused', onPaused)
        this.off('exit', onExit)
        resolvePaused(this.snapshot())
      }
      const onExit = () => {
        clearTimeout(t)
        this.off('paused', onPaused)
        this.off('exit', onExit)
        reject(new Error('debug exited'))
      }
      this.on('paused', onPaused)
      this.on('exit', onExit)
    })
  }

  async collectPaused(params) {
    const frames = []
    const locals = []
    const list = Array.isArray(params.callFrames) ? params.callFrames.slice(0, MAX_FRAMES) : []
    this.callFrameId = list[0] && typeof list[0].callFrameId === 'string' ? list[0].callFrameId : ''
    for (const frame of list) {
      const abs = fromScriptUrl(frame.url)
      let rel = abs ? this.relOf(abs) : null
      if (!rel && this.path && frames.length === 0) rel = this.path
      if (!rel) continue
      const line = Number(frame.location?.lineNumber) + 1
      frames.push({
        path: rel,
        line: Number.isFinite(line) && line > 0 ? Math.floor(line) : 1,
        name: redact(frame.functionName || '(anonymous)') || '(anonymous)'
      })
    }
    const top = list[0]
    const scopes = Array.isArray(top?.scopeChain) ? top.scopeChain : []
    for (const scope of scopes) {
      if (!scope || scope.type === 'global' || !scope.object?.objectId || !this.rpc) continue
      try {
        const props = await this.rpc.send('Runtime.getProperties', {
          objectId: scope.object.objectId,
          ownProperties: true,
          generatePreview: false
        })
        for (const row of Array.isArray(props.result) ? props.result : []) {
          if (locals.length >= MAX_LOCALS) break
          const value = row && row.value
          if (!value || (value.type === 'object' && value.subtype !== 'null')) continue
          locals.push({
            name: redact(row.name || ''),
            type: redact(value.type || 'string'),
            value: redact(value.value ?? value.description ?? '')
          })
        }
      } catch {
        /* primitive locals only */
      }
    }
    this.frames = frames
    this.locals = locals.filter((row) => row.name)
  }

  async armBreakpoint(bp) {
    if (!this.rpc) return
    const file = this.jail(bp.path, true) || this.jail(bp.path, false)
    if (!file) return
    const url = scriptUrl(file)
    const lineNumber = Math.max(0, bp.line - 1)
    const name = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (url) {
      try {
        await this.rpc.send('Debugger.setBreakpointByUrl', { lineNumber, url })
      } catch {
        /* url form */
      }
    }
    try {
      await this.rpc.send('Debugger.setBreakpointByUrl', { lineNumber, urlRegex: `${name}$` })
    } catch {
      /* regex form */
    }
  }

  async breakpoint(raw) {
    const req = takeDebugBreakpoint(raw)
    if (!req) throw new Error('Debug breakpoint is outside the workspace jail')
    const file = this.jail(req.path, false)
    const rel = file ? this.relOf(file) : null
    if (!rel) throw new Error('Debug breakpoint is outside the workspace jail')
    this.breakpoints = this.breakpoints.filter((row) => !(row.path === rel && row.line === req.line))
    if (req.enabled) this.breakpoints.push({ path: rel, line: req.line, enabled: true })
    if (this.rpc && req.enabled) await this.armBreakpoint({ path: rel, line: req.line, enabled: true })
    return this.snapshot()
  }

  async stack() {
    return this.snapshot()
  }

  async evaluate(raw) {
    const expr = takeDebugEval(raw)
    if (!expr) throw new Error('Debug evaluate rejected')
    if (!this.rpc || this.status !== 'paused' || !this.callFrameId) throw new Error('Debug session is not paused')
    let result
    try {
      result = await this.rpc.send('Debugger.evaluateOnCallFrame', {
        callFrameId: this.callFrameId,
        expression: expr,
        returnByValue: true,
        generatePreview: false,
        throwOnSideEffect: true
      })
    } catch {
      throw new Error('Debug evaluate rejected')
    }
    const value = result.result
    if (!value || (value.type === 'object' && value.subtype !== 'null')) return '[omitted]'
    return redact(value.value ?? value.description ?? '')
  }

  async continue(raw) {
    const kind = takeDebugContinue(raw)
    if (!kind) throw new Error('Debug continue rejected')
    if (!this.rpc) throw new Error('Debug session is not running')
    const method =
      kind === 'stepOver'
        ? 'Debugger.stepOver'
        : kind === 'stepInto'
          ? 'Debugger.stepInto'
          : kind === 'stepOut'
            ? 'Debugger.stepOut'
            : 'Debugger.resume'
    this.status = 'running'
    this.emit('resumed', this.snapshot())
    await this.rpc.send(method)
    return this.snapshot()
  }

  async stop() {
    const child = this.child
    this.child = null
    try {
      this.rpc?.close()
    } catch {
      /* closed */
    }
    this.rpc = null
    this.callFrameId = ''
    this.frames = []
    this.locals = []
    if (child && child.exitCode == null && child.signalCode == null) {
      child.kill('SIGTERM')
      await new Promise((done) => setTimeout(done, 400))
      if (child.exitCode == null && child.signalCode == null) child.kill('SIGKILL')
    }
    this.port = null
    if (this.status !== 'idle') this.status = 'exited'
    this.emit('exit', this.snapshot())
    return this.snapshot()
  }
}

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ToolDef, ToolResult } from '@homeai/core'
import { loadPermissions, urlAllowed } from './approvals'
import { parseSseJsonRpc, sanitizeMcpEnv, sanitizeMcpHeaders, takeMcpServerCfg } from './mcp-http.mjs'

export interface McpServerCfg {
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

export interface McpConfig {
  mcpServers: Record<string, McpServerCfg>
}

export function loadMcpConfig(workspace: string): McpConfig {
  const files = [
    join(workspace, '.cursor', 'mcp.json'),
    join(workspace, '.homeai', 'mcp.json'),
    join(homedir(), '.cursor', 'mcp.json'),
    join(homedir(), '.homeai', 'mcp.json')
  ]
  const mcpServers: Record<string, McpServerCfg> = Object.create(null)
  for (const f of files) {
    if (!existsSync(f)) continue
    try {
      const json = JSON.parse(readFileSync(f, 'utf8')) as { mcpServers?: unknown }
      const servers = json?.mcpServers
      if (!servers || typeof servers !== 'object' || Array.isArray(servers)) continue
      for (const [id, spec] of Object.entries(servers as Record<string, unknown>)) {
        if (!id || id === '__proto__' || id === 'constructor' || id === 'prototype') continue
        if (!/^[\w.-]{1,64}$/.test(id)) continue
        const cfg = takeMcpServerCfg(spec) as McpServerCfg | null
        if (cfg) mcpServers[id] = cfg
      }
    } catch {
      /* skip */
    }
  }
  return { mcpServers }
}

interface JsonRpc {
  jsonrpc: '2.0'
  id?: number
  method?: string
  params?: unknown
  result?: unknown
  error?: { message?: string }
}

class StdioMcp {
  private child
  private buf = ''
  private nextId = 1
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  ready: Promise<void>
  tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> = []

  constructor(
    readonly id: string,
    cmd: string,
    args: string[],
    env?: Record<string, string>
  ) {
    this.child = spawn(cmd, args, {
      env: { ...process.env, ...sanitizeMcpEnv(env) },
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.child.stdout?.on('data', (d) => this.onData(String(d)))
    this.child.stderr?.on('data', () => undefined)
    this.ready = this.handshake()
  }

  private onData(chunk: string): void {
    this.buf += chunk
    while (true) {
      const headerEnd = this.buf.indexOf('\r\n\r\n')
      if (headerEnd < 0) return
      const header = this.buf.slice(0, headerEnd)
      const m = header.match(/Content-Length:\s*(\d+)/i)
      if (!m) {
        this.buf = this.buf.slice(headerEnd + 4)
        continue
      }
      const len = Number(m[1])
      const start = headerEnd + 4
      if (this.buf.length < start + len) return
      const body = this.buf.slice(start, start + len)
      this.buf = this.buf.slice(start + len)
      try {
        const msg = JSON.parse(body) as JsonRpc
        if (typeof msg.id === 'number' && this.pending.has(msg.id)) {
          const p = this.pending.get(msg.id)!
          this.pending.delete(msg.id)
          if (msg.error) p.reject(new Error(msg.error.message ?? 'mcp error'))
          else p.resolve(msg.result)
        }
      } catch {
        /* ignore */
      }
    }
  }

  private send(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params })
    const wire = `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`mcp timeout ${method}`))
        }
      }, 15_000)
      this.child.stdin?.write(wire)
    })
  }

  private async handshake(): Promise<void> {
    await this.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'home-ai', version: '0.1.0' }
    })
    this.child.stdin?.write(
      `Content-Length: ${Buffer.byteLength(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }))}\r\n\r\n${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}`
    )
    const listed = (await this.send('tools/list', {})) as {
      tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>
    }
    this.tools = listed?.tools ?? []
  }

  async call(name: string, args: Record<string, unknown>): Promise<string> {
    await this.ready
    const result = (await this.send('tools/call', { name, arguments: args })) as {
      content?: Array<{ type?: string; text?: string }>
      isError?: boolean
    }
    const text = (result?.content ?? []).map((c) => c.text ?? '').join('\n')
    if (result?.isError) throw new Error(text || 'mcp tool error')
    return text || JSON.stringify(result).slice(0, 8000)
  }

  dispose(): void {
    this.child.kill()
  }
}

type McpTool = { name: string; description?: string; inputSchema?: Record<string, unknown> }

interface McpClient {
  ready: Promise<void>
  tools: McpTool[]
  call(name: string, args: Record<string, unknown>): Promise<string>
  dispose(): void
}

class HttpMcp implements McpClient {
  private nextId = 1
  private sessionId?: string
  ready: Promise<void>
  tools: McpTool[] = []

  constructor(
    readonly id: string,
    readonly url: string,
    readonly extraHeaders: Record<string, string> = {}
  ) {
    this.ready = this.handshake()
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...sanitizeMcpHeaders(this.extraHeaders)
    }
    if (this.sessionId) h['Mcp-Session-Id'] = this.sessionId
    return h
  }

  private async rpc(method: string, params?: unknown, notify = false): Promise<unknown> {
    const id = notify ? undefined : this.nextId++
    const payload = notify
      ? { jsonrpc: '2.0', method, params }
      : { jsonrpc: '2.0', id, method, params }
    const res = await fetch(this.url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000)
    })
    const sid = res.headers.get('mcp-session-id')
    if (sid && /^[\w.-]{1,128}$/.test(sid)) this.sessionId = sid
    if (notify) {
      if (!res.ok && res.status >= 500) throw new Error(`mcp http ${res.status}`)
      return undefined
    }
    if (!res.ok) throw new Error(`mcp http ${res.status}`)
    const text = await res.text()
    const ct = res.headers.get('content-type') ?? ''
    const msg = ct.includes('text/event-stream') || text.includes('\ndata:')
      ? parseSseJsonRpc(text, id as number)
      : (JSON.parse(text) as JsonRpc)
    if (msg.error) throw new Error(msg.error.message ?? 'mcp error')
    if (typeof msg.id === 'number' && msg.id !== id) throw new Error('mcp id mismatch')
    return msg.result
  }

  private async handshake(): Promise<void> {
    const info = { capabilities: {}, clientInfo: { name: 'home-ai', version: '0.1.0' } }
    try {
      await this.rpc('initialize', { protocolVersion: '2025-03-26', ...info })
    } catch {
      this.sessionId = undefined
      await this.rpc('initialize', { protocolVersion: '2024-11-05', ...info })
    }
    await this.rpc('notifications/initialized', {}, true)
    const listed = (await this.rpc('tools/list', {})) as { tools?: McpTool[] }
    this.tools = listed?.tools ?? []
  }

  async call(name: string, args: Record<string, unknown>): Promise<string> {
    await this.ready
    const result = (await this.rpc('tools/call', { name, arguments: args })) as {
      content?: Array<{ type?: string; text?: string }>
      isError?: boolean
    }
    const text = (result?.content ?? []).map((c) => c.text ?? '').join('\n')
    if (result?.isError) throw new Error(text || 'mcp tool error')
    return text || JSON.stringify(result).slice(0, 8000)
  }

  dispose(): void {
    this.sessionId = undefined
  }
}

export interface McpServerInfo {
  id: string
  ok: boolean
  tools: string[]
  error?: string
  transport?: 'stdio' | 'http'
  url?: string
}

function publicMcpUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined
    return `${u.origin}${u.pathname === '/' ? '' : u.pathname}`
  } catch {
    return undefined
  }
}

function listedInfo(
  id: string,
  spec: McpServerCfg,
  extra: { ok: boolean; tools?: string[]; error?: string }
): McpServerInfo {
  return {
    id,
    ok: extra.ok,
    tools: extra.tools ?? [],
    error: extra.error,
    transport: spec.command ? 'stdio' : spec.url ? 'http' : undefined,
    url: publicMcpUrl(spec.url)
  }
}

export class McpHub {
  private servers = new Map<string, McpClient>()
  private listed: McpServerInfo[] = []

  list(): McpServerInfo[] {
    return this.listed
  }

  parseTool(toolName: string): { id: string; tool: string } | null {
    const rest = toolName.replace(/^mcp_/, '')
    const id = [...this.servers.keys()].find((k) => rest.startsWith(`${k.replace(/[^A-Za-z0-9_]/g, '_')}_`))
    if (!id) return null
    const prefix = `${id.replace(/[^A-Za-z0-9_]/g, '_')}_`
    return { id, tool: rest.slice(prefix.length) }
  }

  async load(workspace: string): Promise<ToolDef[]> {
    const cfg = loadMcpConfig(workspace)
    const perms = loadPermissions(workspace)
    const defs: ToolDef[] = []
    this.dispose()
    this.listed = []
    for (const [id, spec] of Object.entries(cfg.mcpServers)) {
      try {
        let s: McpClient
        if (spec.command) {
          s = new StdioMcp(id, spec.command, spec.args ?? [], spec.env)
        } else if (spec.url) {
          if (perms.approvalMode !== 'unrestricted' && !urlAllowed(spec.url, perms.netAllowlist)) {
            this.listed.push(listedInfo(id, spec, { ok: false, error: 'url not on net allowlist' }))
            continue
          }
          s = new HttpMcp(id, spec.url, spec.headers ?? {})
        } else {
          this.listed.push(listedInfo(id, spec, { ok: false, error: 'no command or url' }))
          continue
        }
        await s.ready
        this.servers.set(id, s)
        this.listed.push(listedInfo(id, spec, { ok: true, tools: s.tools.map((t) => t.name) }))
        for (const t of s.tools) {
          defs.push({
            name: `mcp_${id}_${t.name}`.replace(/[^A-Za-z0-9_]/g, '_'),
            description: `[MCP ${id}] ${t.description ?? t.name}`,
            permissions: ['net'],
            pack: 'mcp-domain',
            parameters: t.inputSchema ?? { type: 'object', properties: {} }
          })
        }
      } catch (err) {
        this.listed.push(
          listedInfo(id, spec, {
            ok: false,
            error: err instanceof Error ? err.message : 'connect failed'
          })
        )
      }
    }
    return defs
  }

  async call(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    const parsed = this.parseTool(toolName)
    if (!parsed) return { ok: false, name: toolName, content: 'unknown mcp server' }
    const s = this.servers.get(parsed.id)
    if (!s) return { ok: false, name: toolName, content: 'mcp not connected' }
    try {
      const content = await s.call(parsed.tool, args)
      return { ok: true, name: toolName, content: content.slice(0, 12_000) }
    } catch (err) {
      return { ok: false, name: toolName, content: err instanceof Error ? err.message : String(err) }
    }
  }

  dispose(): void {
    for (const s of this.servers.values()) s.dispose()
    this.servers.clear()
    this.listed = []
  }
}

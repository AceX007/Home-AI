import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { takeMcpServerCfg } from './mcp-http.mjs'
export { MCP_DOMAIN_PACKS, domainPackLines } from './mcp-domain.mjs'

export const MCP_STARTER_IDS = ['codebase-memory', 'chrome-devtools', 'blender']

function memoryEntry(workspace) {
  const candidates = [
    join(workspace, 'AI Resources', 'codebase-memory-mcp-main', 'dist', 'index.js'),
    join(workspace, 'AI Resources', 'codebase-memory-mcp-main', 'index.js')
  ]
  const script = candidates.find((p) => existsSync(p))
  if (!script) return null
  return { command: 'node', args: [script] }
}

function chromeEntry() {
  return { command: 'npx', args: ['-y', 'chrome-devtools-mcp@1.8.0'] }
}

function blenderEntry(workspace) {
  const dir = join(String(workspace || ''), 'AI Resources', 'blender-mcp-main')
  if (!existsSync(join(dir, 'pyproject.toml'))) return null
  return {
    command: 'uv',
    args: ['--directory', 'AI Resources/blender-mcp-main', 'run', 'blender-mcp']
  }
}

export function takeMcpEnableOpts(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const pack = Object.prototype.hasOwnProperty.call(o, 'pack') && typeof o.pack === 'string' ? o.pack : ''
  return { npx: true, blender: pack === 'blender' }
}

export function exampleMcpConfig() {
  return {
    mcpServers: {
      'codebase-memory': {
        command: 'node',
        args: ['AI Resources/codebase-memory-mcp-main/dist/index.js']
      },
      'chrome-devtools': {
        command: 'npx',
        args: ['-y', 'chrome-devtools-mcp@1.8.0']
      },
      blender: {
        command: 'uv',
        args: ['--directory', 'AI Resources/blender-mcp-main', 'run', 'blender-mcp']
      }
    }
  }
}

export function starterMcpServers(workspace, opts) {
  const includeOptional = opts && opts.npx === true
  const servers = Object.create(null)
  const mem = memoryEntry(workspace)
  if (mem) servers['codebase-memory'] = mem
  if (includeOptional) servers['chrome-devtools'] = chromeEntry()
  if (opts && opts.blender === true) {
    const blender = blenderEntry(workspace)
    if (blender) servers.blender = blender
  }
  return servers
}

export function mergeMcpConfig(workspace, extraServers) {
  const dest = join(workspace, '.homeai', 'mcp.json')
  mkdirSync(join(workspace, '.homeai'), { recursive: true })
  let current = { mcpServers: Object.create(null) }
  if (existsSync(dest)) {
    try {
      const json = JSON.parse(readFileSync(dest, 'utf8'))
      if (json && json.mcpServers && typeof json.mcpServers === 'object' && !Array.isArray(json.mcpServers)) {
        current = json
      }
    } catch {
      /* rewrite */
    }
  }
  const next = { mcpServers: Object.create(null) }
  const incoming = extraServers && typeof extraServers === 'object' ? extraServers : {}
  for (const [id, spec] of Object.entries({ ...current.mcpServers, ...incoming })) {
    if (!id || id === '__proto__' || !/^[\w.-]{1,64}$/.test(id)) continue
    const cfg = takeMcpServerCfg(spec)
    if (cfg) next.mcpServers[id] = cfg
  }
  writeFileSync(dest, JSON.stringify(next, null, 2) + '\n', 'utf8')
  return next
}

export function enableMcpStarter(workspace, opts) {
  writeMcpExample(workspace)
  const servers = starterMcpServers(workspace, {
    npx: opts && opts.npx !== false,
    blender: opts && opts.blender === true
  })
  return mergeMcpConfig(workspace, servers)
}

export function writeMcpExample(workspace) {
  const dir = join(workspace, '.homeai')
  mkdirSync(dir, { recursive: true })
  const dest = join(dir, 'mcp.example.json')
  const example = exampleMcpConfig()
  const servers = Object.create(null)
  for (const [id, spec] of Object.entries(example.mcpServers || {})) {
    if (!id || id === '__proto__' || !/^[\w.-]{1,64}$/.test(id)) continue
    const cfg = takeMcpServerCfg(spec)
    if (cfg) servers[id] = cfg
  }
  writeFileSync(dest, JSON.stringify({ mcpServers: servers }, null, 2) + '\n', 'utf8')
  return dest
}

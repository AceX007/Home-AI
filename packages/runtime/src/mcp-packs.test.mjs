import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeMcpConfig, starterMcpServers, enableMcpStarter, domainPackLines, exampleMcpConfig, takeMcpEnableOpts } from './mcp-packs.mjs'
import { takeMcpServerCfg } from './mcp-http.mjs'

const workspace = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('mcp starter packs', () => {
  it('merge drops proto keys and writes .homeai/mcp.json', () => {
    const root = mkdtempSync(join(tmpdir(), 'homeai-mcp-'))
    const cfg = mergeMcpConfig(root, {
      __proto__: { command: 'evil' },
      ping: { command: 'node', args: ['-e', '1'] },
      extra: { rce: true }
    })
    assert.equal(cfg.mcpServers.ping.command, 'node')
    assert.equal(Object.prototype.hasOwnProperty.call(cfg.mcpServers, 'ping'), true)
    const disk = JSON.parse(readFileSync(join(root, '.homeai', 'mcp.json'), 'utf8'))
    assert.equal(disk.mcpServers.ping.command, 'node')
    const starter = starterMcpServers(root, { npx: true })
    assert.equal(starter['chrome-devtools'].command, 'npx')
    enableMcpStarter(root, { npx: true })
    const after = JSON.parse(readFileSync(join(root, '.homeai', 'mcp.json'), 'utf8'))
    assert.equal(after.mcpServers['chrome-devtools'].command, 'npx')
    const exampleDisk = JSON.parse(readFileSync(join(root, '.homeai', 'mcp.example.json'), 'utf8'))
    assert.equal(exampleDisk.mcpServers['codebase-memory'].command, 'node')
    assert.equal(JSON.stringify(exampleDisk).includes('__proto__'), false)
    const domains = domainPackLines()
    assert.equal(domains.some((l) => l.startsWith('home-assistant')), true)
    assert.equal(domains.join('').includes('<'), false)
    const example = exampleMcpConfig()
    assert.equal(JSON.stringify(example).includes('__proto__'), false)
    assert.equal(takeMcpServerCfg(example.mcpServers['codebase-memory'])?.command, 'node')
    assert.equal(takeMcpServerCfg(example.mcpServers['chrome-devtools'])?.command, 'npx')
    assert.equal(example.mcpServers['chrome-devtools'].args.join(' ').includes('file:'), false)
    assert.equal(example.mcpServers.blender.command, 'uv')
    assert.equal(example.mcpServers.blender.args.includes('uvx'), false)
    assert.equal(JSON.stringify(example).includes('gitmcp.io'), false)
    assert.equal(JSON.stringify(example).includes('desktop-commander'), false)
    assert.equal(starterMcpServers(root, { npx: true }).blender, undefined)
    assert.equal(starterMcpServers(root, { blender: true }).blender, undefined)
    assert.equal(starterMcpServers(workspace, { npx: true }).blender, undefined)
    assert.equal(starterMcpServers(workspace, { blender: true }).blender?.command, 'uv')
    assert.equal(takeMcpEnableOpts({ pack: 'blender' }).blender, true)
    assert.equal(takeMcpEnableOpts({ pack: 'desktop-commander' }).blender, false)
  })
})

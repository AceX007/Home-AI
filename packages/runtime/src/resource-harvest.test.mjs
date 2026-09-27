import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { harvestDirKey, harvestKindForDir, harvestRow, starterForbidden, RESOURCE_HARVEST } from './resource-harvest.mjs'
import { starterMcpServers, exampleMcpConfig, takeMcpEnableOpts } from './mcp-packs.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('resource harvest catalog — T-115', () => {
  it('covers every AI Resources folder and never auto-starts unjailed MCP', () => {
    const base = join(root, 'AI Resources')
    const names = readdirSync(base)
    for (const name of names) {
      const abs = join(base, name)
      if (!statSync(abs).isDirectory()) continue
      const kind = harvestKindForDir(name)
      assert.ok(kind, `missing harvest row for ${name}`)
      assert.ok(['analog', 'port', 'skip-ui', 'skip-unjail', 'next'].includes(kind), name)
    }
    assert.equal(harvestRow('blender-mcp')?.kind, 'port')
    assert.equal(harvestRow('desktop-commander')?.kind, 'skip-unjail')
    assert.equal(harvestRow('code-ide')?.kind, 'skip-ui')
    assert.equal(harvestKindForDir('mcp-main (2)'), 'skip-ui')
    assert.equal(harvestDirKey('AstrBot-master (2)'), 'AstrBot-master')
    const blob = JSON.stringify(exampleMcpConfig()) + JSON.stringify(starterMcpServers(root, { npx: true }))
    for (const bad of starterForbidden()) {
      assert.equal(blob.toLowerCase().includes(String(bad).toLowerCase()), false, bad)
    }
    assert.equal(starterMcpServers(root, { npx: true }).blender, undefined)
    assert.equal(takeMcpEnableOpts({ pack: 'blender' }).blender, true)
    assert.equal(takeMcpEnableOpts({ pack: '../x' }).blender, false)
    const kinds = new Set(RESOURCE_HARVEST.map((r) => r.kind))
    assert.equal(kinds.has('port'), true)
    const packs = readFileSync(join(root, 'packages/runtime/src/mcp-packs.mjs'), 'utf8')
    assert.match(packs, /blender-mcp-main/)
    assert.equal(packs.includes('uvx'), false)
    const settings = readFileSync(join(root, 'apps/renderer/src/panes/SettingsPane.tsx'), 'utf8')
    assert.match(settings, /Enable Blender MCP/)
    assert.equal(settings.includes('dangerouslySetInnerHTML'), false)
    const main = readFileSync(join(root, 'apps/desktop/src/main/index.ts'), 'utf8')
    assert.match(main, /takeMcpEnableOpts/)
  })
})

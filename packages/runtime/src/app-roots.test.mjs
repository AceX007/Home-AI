import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_GGUF_NAME,
  isPackedAppPath,
  takeAppRoots,
  takeGgufDest,
  takeHexHome,
  takeLibraryStub,
  takeModelCandidates,
  takeModelPath,
  takeOnboardNeeded,
  takeOpenFolder,
  takeRootsState,
  takeSecretName,
  takeWorkspaceJail,
  secretFileNames
} from './app-roots.mjs'

describe('app vs profile vs workspace roots — T-106', () => {
  it('jails asar, dots, and secrets as a workspace', () => {
    assert.equal(takeWorkspaceJail('/tmp/app.asar'), '')
    assert.equal(takeWorkspaceJail('/tmp/foo/../etc'), '')
    assert.equal(takeWorkspaceJail('/tmp/data/secrets'), '')
    assert.equal(takeWorkspaceJail('/tmp/ok'), '/tmp/ok')
    assert.equal(isPackedAppPath('/opt/Hex/resources/app.asar'), true)
    assert.equal(takeOpenFolder('/tmp/app.asar'), '')
    assert.equal(takeOpenFolder('/tmp/my-project'), '/tmp/my-project')
    assert.equal(takeHexHome('/home/x'), join('/home/x', 'Hex'))
  })

  it('operator keeps git clone as workspace; profile is data/', () => {
    const r = takeAppRoots({
      packaged: false,
      cwd: '/home/x/Home AI',
      appPath: '/home/x/Home AI',
      home: '/home/x'
    })
    assert.equal(r.operator, true)
    assert.equal(r.workspace, '/home/x/Home AI')
    assert.equal(r.profile, join('/home/x/Home AI', 'data'))
    assert.equal(r.secretsDir, join('/home/x/Home AI', 'data', 'secrets'))
    assert.equal(r.vendorDir, join('/home/x/Home AI', 'vendor'))
  })

  it('packaged uses userData profile and ~/Hex workspace, never asar', () => {
    const r = takeAppRoots({
      packaged: true,
      home: '/home/sam',
      userData: '/home/sam/.config/Hex AI Workbench',
      appPath: '/opt/Hex/resources/app.asar',
      resourcesPath: '/opt/Hex/resources',
      cwd: '/opt/Hex'
    })
    assert.equal(r.packaged, true)
    assert.equal(r.appResources, '/opt/Hex/resources')
    assert.equal(r.profile, '/home/sam/.config/Hex AI Workbench')
    assert.equal(r.workspace, join('/home/sam', 'Hex'))
    assert.equal(r.secretsDir.includes('secrets'), true)
    assert.equal(r.workspace.includes('.asar'), false)
    assert.equal(takeOnboardNeeded(r, false), true)
    assert.equal(takeOnboardNeeded(r, true), false)
    assert.equal(takeOnboardNeeded({ packaged: false }, false), false)
  })

  it('HOME_AI_ROOT wins; last workspace cannot be asar', () => {
    const r = takeAppRoots({
      packaged: true,
      envRoot: '/tmp/operator-ws',
      lastWorkspace: '/opt/Hex/resources/app.asar',
      home: '/tmp',
      userData: '/tmp/ud'
    })
    assert.equal(r.workspace, '/tmp/operator-ws')
  })

  it('model dest stays under profile models; library stub needs a day', () => {
    const dest = takeGgufDest('/tmp/ud/models', DEFAULT_GGUF_NAME)
    assert.equal(dest, join('/tmp/ud/models', DEFAULT_GGUF_NAME))
    assert.equal(takeGgufDest('/tmp/ud/models', '../etc.gguf'), '')
    const stub = takeLibraryStub('2026-09-04')
    assert.ok(stub['RAG/library/ROADMAP.md'].includes('Scaffold library'))
    assert.equal(takeLibraryStub('nope'), null)
    assert.equal(takeSecretName('telegram'), 'telegram')
    assert.equal(takeSecretName('../x'), '')
    assert.deepEqual(secretFileNames('openai'), { plain: 'openai.key', enc: 'openai.enc' })
    const st = takeRootsState({ workspace: '/tmp/x', onboardDone: true, crashOptIn: 'local', __proto__: { x: 1 } })
    assert.equal(st.onboardDone, true)
    assert.equal(st.crashOptIn, 'local')
  })

  it('model candidates prefer workspace then profile, not asar', () => {
    const roots = takeAppRoots({
      packaged: true,
      home: '/home/sam',
      userData: '/home/sam/.config/hex',
      resourcesPath: '/opt/Hex/resources'
    })
    const c = takeModelCandidates(roots)
    assert.equal(c.some((p) => p.endsWith(DEFAULT_GGUF_NAME)), true)
    assert.equal(
      takeModelPath(roots, (p) => p === join(roots.modelsDir, DEFAULT_GGUF_NAME)),
      join(roots.modelsDir, DEFAULT_GGUF_NAME)
    )
    assert.equal(homedir().includes('..'), false)
  })
})

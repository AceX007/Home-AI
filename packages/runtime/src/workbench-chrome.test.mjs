import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  layoutFile,
  loadLayout,
  saveLayout,
  takeActivity,
  takeBottomTab,
  takeChromePulse,
  takeCommandId,
  takeCursorPos,
  takeFileName,
  takeChatId,
  takePinnedChats,
  takeLayout,
  takeOutputLine,
  takePortList,
  takePortRow,
  takeWorkspaceRel,
  takeCowork,
  takeCrumbs
} from './workbench-chrome.mjs'

describe('workbench chrome jail', () => {
  it('layout drops proto, secrets, escapes, and unknown activity', () => {
    const L = takeLayout({
      activity: 'root',
      chatOpen: false,
      sidebarW: 9999,
      termPanel: 'eval',
      split: 'grid',
      tabs: ['../etc/passwd', 'data/secrets/telegram.key', '.env', 'apps/x.ts', { path: 'ok.md' }, { path: 'ok.md' }],
      active: '../../x',
      splitPath: 'data/secrets/x',
      apiKey: 'sk-live',
      __proto__: { admin: true }
    })
    assert.equal(L.activity, 'files')
    assert.equal(L.chatOpen, false)
    assert.equal(L.sidebarW, 480)
    assert.equal(L.termPanel, 'terminal')
    assert.equal(L.split, 'off')
    assert.equal(L.layoutMode, 'dock')
    assert.equal(L.density, 'comfortable')
    assert.deepEqual(L.tabs, ['apps/x.ts', 'ok.md'])
    assert.equal(L.active, 'apps/x.ts')
    assert.equal(L.splitPath, null)
    assert.equal(L.apiKey, undefined)
    assert.equal(L.admin, undefined)
    assert.equal(takeActivity({ toString: () => 'settings' }), null)
  })

  it('workspace rel and file name refuse traversal and secret files', () => {
    assert.equal(takeWorkspaceRel('../x'), null)
    assert.equal(takeWorkspaceRel('/etc/passwd'), null)
    assert.equal(takeWorkspaceRel('data/secrets/telegram.key'), null)
    assert.equal(takeWorkspaceRel('.env.local'), null)
    assert.equal(takeWorkspaceRel({ toString: () => 'apps/x.ts' }), null)
    assert.equal(takeWorkspaceRel('apps/x.ts'), 'apps/x.ts')
    assert.equal(takeFileName('../x'), null)
    assert.equal(takeFileName('telegram.key'), null)
    assert.equal(takeFileName('ok.ts'), 'ok.ts')
    assert.equal(takeCommandId('eval'), null)
    assert.equal(takeCommandId('goto'), 'goto')
    assert.equal(takeCommandId('goto-symbol'), 'goto-symbol')
    assert.equal(takeCommandId('stage'), 'stage')
    assert.equal(takeCommandId('layout-dock'), 'layout-dock')
    assert.equal(takeCommandId('layout-focus'), 'layout-focus')
    assert.equal(takeCommandId('new-chat'), 'new-chat')
    assert.equal(takeCommandId('skills'), 'skills')
    assert.equal(takeCommandId('fleet'), 'fleet')
    assert.equal(takeActivity('fleet'), 'fleet')
    assert.equal(takeCommandId('tools'), 'tools')
    assert.equal(takeBottomTab('shells'), 'shells')
    assert.equal(takeBottomTab('runtime'), 'runtime')
    assert.equal(takeBottomTab('eval'), null)
  })

  it('layoutMode and density are allowlisted; stage raises chatW cap', () => {
    const evil = takeLayout({
      layoutMode: 'cowork<script>',
      density: 'huge',
      chatW: 1800
    })
    assert.equal(evil.layoutMode, 'dock')
    assert.equal(evil.density, 'comfortable')
    assert.equal(evil.chatW, 720)
    const stage = takeLayout({ layoutMode: 'stage', density: 'compact', chatW: 1800 })
    assert.equal(stage.layoutMode, 'stage')
    assert.equal(stage.density, 'compact')
    assert.equal(stage.chatW, 1800)
    assert.equal(takeLayout({ layoutMode: 'focus' }).layoutMode, 'focus')
    const pins = takeLayout({
      pinnedChats: ['chat-1', 'chat_ok', '../x', 'chat-<img>', 'javascript:alert(1)', 'chat_ok']
    })
    assert.deepEqual(pins.pinnedChats, ['chat-1', 'chat_ok'])
    assert.equal(takeChatId('chat-<b>'), null)
    assert.equal(takeChatId('../chat-1'), null)
    assert.deepEqual(takePinnedChats('chat-1'), [])
    assert.deepEqual(takePinnedChats(['chat-1', 'chat-1', 'nope']), ['chat-1'])
    assert.equal(takeCowork(true), true)
    assert.equal(takeCowork(false), false)
    assert.equal(takeCowork('dock'), null)
    assert.equal(takeCowork({ toString: () => 'true' }), null)
    assert.equal(takeLayout({ cowork: false }).cowork, false)
    assert.equal(takeLayout({ cowork: 'yes' }).cowork, true)
    assert.deepEqual(takeCrumbs('apps/renderer/EditorPane.tsx'), ['apps', 'renderer', 'EditorPane.tsx'])
    assert.deepEqual(takeCrumbs('../secret'), [])
    assert.deepEqual(takeCrumbs('apps/<b>x.tsx'), [])
    assert.deepEqual(takeCrumbs({ toString: () => 'apps/x.ts' }), [])
  })

  it('pulse and ports drop keys, urls, and unknown names', () => {
    const p = takeChromePulse({
      llama: 'on',
      keys: 'sk-live',
      cursor: 'ready <b>x',
      mode: 'rm',
      mind: { toString: () => 'cursor' },
      telegram: true,
      mcp: -4,
      pending: 3,
      url: 'http://evil',
      apiKey: 'secret'
    })
    assert.equal(p.llama, 'on')
    assert.equal(p.keys, 'none')
    assert.equal(p.cursor, 'off')
    assert.equal(p.mode, 'ask')
    assert.equal(p.mind, 'local')
    assert.equal(p.telegram, true)
    assert.equal(p.mcp, 0)
    assert.equal(p.pending, 3)
    assert.equal(p.url, undefined)
    assert.equal(p.apiKey, undefined)
    assert.equal(p.gpu, '')
    assert.equal(p.llamaErr, '')
    const health = takeChromePulse({
      llama: 'missing',
      gpu: 'AMD <b>RX</b>',
      vramMb: 4096,
      ngl: 18,
      ctx: 4096,
      llamaErr: 'Model missing: /home/x/secret.gguf sk-live',
      url: 'http://evil'
    })
    assert.equal(health.gpu.includes('<'), false)
    assert.equal(health.vramMb, 4096)
    assert.equal(health.ngl, 18)
    assert.equal(health.ctx, 4096)
    assert.equal(health.llamaErr.includes('/home'), false)
    assert.equal(health.llamaErr.includes('sk-'), false)
    assert.equal(health.url, undefined)
    const row = takePortRow({ name: 'llama', port: 8765, url: 'http://127.0.0.1:8765/secret' })
    assert.deepEqual(row, { name: 'llama', port: 8765 })
    assert.equal(row.url, undefined)
    assert.deepEqual(takePortRow({ name: 'coder', port: 8766 }), { name: 'coder', port: 8766 })
    assert.deepEqual(takePortRow({ name: 'inspect', port: 41234 }), { name: 'inspect', port: 41234 })
    assert.equal(takePortRow({ name: 'vite', port: 5173 }), null)
    assert.equal(takePortRow({ name: 'llama', port: 0 }), null)
    assert.equal(takePortList([{ name: 'miniapp', port: 18766 }, { name: 'evil', port: 80 }]).length, 1)
    assert.equal(takeOutputLine('Model missing: /home/x/secret.gguf sk-live').includes('/home'), false)
    assert.equal(takeOutputLine('Bearer abc <script>').includes('<'), false)
    assert.equal(takeCursorPos({ line: 0, col: 99, lang: 'ts<script>' }).lang.includes('<'), false)
  })

  it('layout file is always data/workbench.json', () => {
    const root = mkdtempSync(join(tmpdir(), 'wb-'))
    try {
      mkdirSync(join(root, 'data'), { recursive: true })
      writeFileSync(join(root, 'data', 'workbench.json'), JSON.stringify({ tabs: ['../x', 'src/a.ts'], activity: 'notes' }), 'utf8')
      const loaded = loadLayout(root)
      assert.deepEqual(loaded.tabs, ['src/a.ts'])
      assert.equal(loaded.activity, 'notes')
      const saved = saveLayout(root, { tabs: ['ok.ts'], path: '../outside.json' })
      assert.equal(layoutFile(), join('data', 'workbench.json'))
      assert.deepEqual(saved.tabs, ['ok.ts'])
      assert.equal(saved.path, undefined)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

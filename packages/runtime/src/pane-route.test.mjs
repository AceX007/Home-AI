import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { takeActivity, takeLayout } from './workbench-chrome.mjs'
import {
  activityLabel,
  centerViewForActivity,
  isEditorActivity,
  isListActivity,
  isPageActivity,
  isStudioActivity,
  redactDebugText,
  sidebarKind,
  takeChatPx,
  takeEditorColumn,
  takeSlots
} from './pane-route.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('pane activity routing', () => {
  it('allowlists every workbench surface and does not drop notes/maps/fleet', () => {
    for (const id of ['notes', 'maps', 'qa', 'mods', 'design', 'board', 'library', 'telegram', 'fleet', 'settings']) {
      assert.equal(takeActivity(id), id, id)
      assert.equal(takeLayout({ activity: id }).activity, id, id)
    }
    assert.equal(takeActivity('skills'), null)
    assert.equal(takeActivity('debug'), null)
    assert.equal(takeLayout({ activity: 'root' }).activity, 'files')
  })

  it('routes sidebar and center so pane clicks are not no-ops', () => {
    assert.equal(sidebarKind('notes'), 'notes')
    assert.equal(sidebarKind('qa'), 'debug')
    assert.equal(sidebarKind('mods'), 'skills')
    assert.equal(sidebarKind('maps'), 'maps')
    assert.equal(sidebarKind('search'), 'search')
    assert.equal(sidebarKind('git'), 'git')
    assert.equal(sidebarKind('files'), 'files')
    assert.equal(sidebarKind('fleet'), 'none')
    assert.equal(sidebarKind('library'), 'none')
    assert.equal(sidebarKind('telegram'), 'none')
    assert.equal(sidebarKind('board'), 'none')
    assert.equal(sidebarKind('settings'), 'none')
    assert.equal(sidebarKind('design'), 'none')
    assert.equal(sidebarKind('../x'), 'files')
    assert.equal(centerViewForActivity('browser'), 'browser')
    assert.equal(centerViewForActivity('notes'), 'editor')
    assert.equal(centerViewForActivity('design'), 'editor')
    assert.equal(centerViewForActivity('fleet'), 'editor')
    assert.equal(isStudioActivity('design'), true)
    assert.equal(isStudioActivity('files'), false)
    assert.equal(isPageActivity('fleet'), true)
    assert.equal(isPageActivity('notes'), false)
    assert.equal(isListActivity('notes'), true)
    assert.equal(isListActivity('qa'), true)
    assert.equal(isListActivity('mods'), true)
    assert.equal(isListActivity('maps'), true)
    assert.equal(isListActivity('files'), false)
    assert.equal(isListActivity('fleet'), false)
    assert.equal(isEditorActivity('files'), true)
    assert.equal(isEditorActivity('qa'), false)
    assert.equal(activityLabel('qa'), 'Debug')
    assert.equal(activityLabel('mods'), 'Skills')
    assert.equal(activityLabel('<img>'), 'Explorer')
  })

  it('debug snapshot strips markup and secret-shaped tokens', () => {
    assert.equal(redactDebugText('<img src=x> token').includes('<'), false)
    assert.equal(redactDebugText('bearer sk-live_abc1234567890').includes('sk-live'), false)
    assert.match(redactDebugText('bearer sk-live_abc1234567890'), /\[redacted\]/)
  })

  it('studio CSS beats chat-off so Design is not a squeezed black column', () => {
    const css = readFileSync(join(root, 'apps/renderer/src/styles/global.css'), 'utf8')
    assert.match(css, /\[data-studio='on'\]\.workbench \.body,\s*\[data-studio='on'\] \.body/)
    assert.match(css, /grid-template-columns:\s*var\(--activity\) minmax\(0, 1fr\) !important/)
    const shell = readFileSync(join(root, 'apps/renderer/src/layout/WorkbenchShell.tsx'), 'utf8')
    assert.match(shell, /sidebarKind/)
    assert.match(shell, /NotesPane listOnly/)
    assert.equal(shell.includes("if (w.centerView === 'browser' || w.activity === 'browser')"), false)
    assert.equal(css.includes('minmax(0, 0.28fr)'), false)
    const notes = readFileSync(join(root, 'apps/renderer/src/panes/NotesPane.tsx'), 'utf8')
    assert.match(notes, /w\.setActivity\('notes'\)/)
    assert.equal(notes.includes("activity: 'notes'"), false)
  })

  it('chat thread keeps minmax 1fr; cowork empty hides the editor — T-113', () => {
    assert.equal(
      takeEditorColumn({ cowork: true, activity: 'files', tabCount: 0, activePath: '', chatOpen: true }),
      'off'
    )
    assert.equal(
      takeEditorColumn({ cowork: true, activity: 'files', tabCount: 1, activePath: 'RAG/a.md', chatOpen: true }),
      'off'
    )
    assert.equal(takeEditorColumn({ cowork: false, activity: 'files', tabCount: 0, chatOpen: true }), 'on')
    assert.equal(takeEditorColumn({ cowork: true, activity: 'git', tabCount: 0, chatOpen: true }), 'on')
    const css = readFileSync(join(root, 'apps/renderer/src/styles/global.css'), 'utf8')
    const shell = readFileSync(join(root, 'apps/renderer/src/layout/WorkbenchShell.tsx'), 'utf8')
    const chat = readFileSync(join(root, 'apps/renderer/src/panes/ChatPane.tsx'), 'utf8')
    assert.match(css, /grid-template-areas:\s*"thread"/)
    assert.match(css, /\[data-editor='off'\]\[data-chat='on'\]/)
    assert.equal(css.includes('grid-template-columns: 220px minmax(0, 1fr) 240px'), false)
    assert.equal(css.includes("grid-template-columns: 200px minmax(0, 1fr) 280px"), false)
    assert.equal(/\.chat-log \.hx-empty \{[^}]*min-height:\s*280px/.test(css), false)
    assert.equal(/@container \(min-width: 900px\)[\s\S]{0,180}agents-bg \{ display: block/.test(css), false)
    assert.match(shell, /takeEditorColumn/)
    assert.match(shell, /data-editor=\{editorCol\}/)
    assert.match(chat, /className="bubble assistant"/)
    assert.match(chat, /<p className="hx-kicker">You<\/p>/)
    assert.match(css, /chat-log::before/)
    const store = readFileSync(join(root, 'apps/renderer/src/store/useWorkbench.ts'), 'utf8')
    assert.match(store, /cowork: false, chatOpen: true/)
    assert.equal(css.includes('0.28fr'), false)
    assert.equal(shell.includes('homeai:fs:stat'), false)
    assert.equal(chat.includes('dangerouslySetInnerHTML'), false)
  })

  it('list/page yield the Agents rail; Maps center is canvas-only — T-114', () => {
    const mapsChat = takeSlots({
      activity: 'maps',
      chatOpen: true,
      cowork: true,
      layoutMode: 'dock',
      chatW: 720
    })
    assert.equal(mapsChat.sessionsRail, 'off')
    assert.equal(mapsChat.editor, 'on')
    assert.equal(mapsChat.center, 'on')
    assert.equal(mapsChat.chat, 'on')
    assert.equal(takeSlots({ activity: 'library', chatOpen: true, layoutMode: 'dock' }).sessionsRail, 'off')
    assert.equal(
      takeSlots({ activity: 'files', cowork: true, chatOpen: true, layoutMode: 'dock' }).sessionsRail,
      'on'
    )
    assert.equal(takeSlots({ activity: 'files', cowork: false, chatOpen: true }).sessionsRail, 'on')
    assert.equal(takeSlots({ activity: 'design', chatOpen: true }).chat, 'off')
    assert.equal(takeChatPx({ activity: 'maps', layoutMode: 'dock', chatW: 720 }), 480)
    assert.equal(takeChatPx({ activity: 'maps', layoutMode: 'stage', chatW: 1800 }), 480)
    assert.equal(takeChatPx({ activity: 'files', layoutMode: 'stage', chatW: 400 }), 640)
    const css = readFileSync(join(root, 'apps/renderer/src/styles/global.css'), 'utf8')
    const shell = readFileSync(join(root, 'apps/renderer/src/layout/WorkbenchShell.tsx'), 'utf8')
    const maps = readFileSync(join(root, 'apps/renderer/src/panes/MapsPane.tsx'), 'utf8')
    assert.match(css, /\[data-sessions='off'\]/)
    assert.match(shell, /data-sessions=\{slots\.sessionsRail\}/)
    assert.match(shell, /takeChatPx/)
    assert.match(maps, /<HxSideHead/)
    assert.equal(maps.includes('<HxPage'), false)
    assert.match(maps, /className="maps-wrap"/)
    assert.equal(maps.includes('dangerouslySetInnerHTML'), false)
    assert.equal(shell.includes('homeai:fs:stat'), false)
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { projectTag } from './activity.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('Hex AI chat home chrome', () => {
  it('HxPage titles stay React text nodes', () => {
    const src = readFileSync(join(root, 'apps/renderer/src/layout/HxPage.tsx'), 'utf8')
    assert.equal(src.includes('dangerouslySetInnerHTML'), false)
    assert.match(src, /<h1>\{title\}<\/h1>/)
    assert.match(src, /<h2>\{title\}<\/h2>/)
    assert.match(src, /export function HxEmpty/)
  })

  it('page CSS keeps hx-page and does not squeeze Stage to 0.28fr', () => {
    const css = readFileSync(join(root, 'apps/renderer/src/styles/global.css'), 'utf8')
    assert.match(css, /\.hx-page\s*\{/)
    assert.match(css, /\.hx-empty\s*\{/)
    assert.equal(css.includes('minmax(0, 0.28fr)'), false)
    assert.equal(css.includes('0.28fr'), false)
  })

  it('Chat-and-Cowork home uses HxEmpty and Hex AI, not a Home HEX mash', () => {
    const chat = readFileSync(join(root, 'apps/renderer/src/panes/ChatPane.tsx'), 'utf8')
    const shell = readFileSync(join(root, 'apps/renderer/src/layout/WorkbenchShell.tsx'), 'utf8')
    assert.match(chat, /from '\.\.\/layout\/HxPage'/)
    assert.match(chat, /<HxEmpty/)
    assert.match(chat, /<p className="hx-kicker">Hex AI<\/p>/)
    assert.equal(chat.includes('approvals not sandbox'), false)
    assert.equal(chat.includes('dangerouslySetInnerHTML'), false)
    assert.match(shell, /placeholder="Hex AI"/)
    assert.match(shell, /title-brand/)
    assert.match(shell, /document\.title = 'Hex AI Workbench'/)
    assert.equal(shell.includes('keys in data/secrets'), false)
    assert.equal(projectTag('/home/x/Home AI'), 'Hex AI')
    assert.equal(projectTag('/tmp/Home AI'), 'Hex AI')
    assert.equal(String(projectTag('/home/x/Home AI')).includes('HEX'), false)
  })

  it('page panes stay imported; Stage pills stay Chat/Code/Design', () => {
    const pills = readFileSync(join(root, 'apps/renderer/src/panes/StagePills.tsx'), 'utf8')
    assert.match(pills, /Chat and Cowork/)
    assert.match(pills, /setActivity\('design'\)/)
    assert.equal(pills.includes("layoutMode: 'stage'"), false)
    const notes = readFileSync(join(root, 'apps/renderer/src/panes/NotesPane.tsx'), 'utf8')
    assert.match(notes, /w\.setActivity\('notes'\)/)
  })

  it('composer groups Effort and Review; no Settings gear; editor empty is HxEmpty', () => {
    const chat = readFileSync(join(root, 'apps/renderer/src/panes/ChatPane.tsx'), 'utf8')
    const editor = readFileSync(join(root, 'apps/renderer/src/panes/EditorPane.tsx'), 'utf8')
    const main = readFileSync(join(root, 'apps/desktop/src/main/index.ts'), 'utf8')
    assert.match(chat, /: 'Review'/)
    assert.match(chat, /runReview\('quick'\)/)
    assert.match(chat, /runReview\('deep'\)/)
    assert.match(chat, /homeai\.agentReview\(depth\)/)
    assert.equal(chat.includes('<Settings'), false)
    assert.equal(chat.includes('title="Settings"'), false)
    assert.match(chat, /className="follow-ctrl"/)
    assert.match(chat, /className="follow-select"/)
    assert.match(editor, /<HxEmpty/)
    assert.equal(editor.includes('dangerouslySetInnerHTML'), false)
    assert.match(main, /title: 'Hex AI Workbench'/)
    assert.match(main, /setTitle\('Hex AI Workbench'\)/)
  })
})

describe('Hex AI page chrome', () => {
  const pane = (name) => readFileSync(join(root, 'apps/renderer/src/panes', name), 'utf8')

  it('page panes wrap HxPage as text nodes and do not keep pane-head', () => {
    const pages = [
      'TelegramPane.tsx',
      'SettingsPane.tsx',
      'FleetPane.tsx',
      'LibraryPane.tsx',
      'TaskboardPane.tsx',
      'ModsPane.tsx',
      'QaPane.tsx'
    ]
    for (const name of pages) {
      const src = pane(name)
      assert.match(src, /from '\.\.\/layout\/HxPage'/, name)
      assert.match(src, /<HxPage/, name)
      assert.equal(src.includes('dangerouslySetInnerHTML'), false, name)
      assert.equal(src.includes('className="pane-head"'), false, name)
    }
    const css = readFileSync(join(root, 'apps/renderer/src/styles/global.css'), 'utf8')
    assert.equal(css.includes('0.28fr'), false)
    assert.match(css, /\[data-page='on'\]\[data-layout='stage'\]:not\(\[data-studio='on'\]\) \.body/)
    assert.match(css, /minmax\(0, 1fr\)/)
    assert.equal(css.includes('0px 0px minmax(0, 1fr)'), false)
  })

  it('sidebars use HxSideHead; Maps list stays HxSideHead and center is canvas-only; empties stay text', () => {
    for (const name of ['SearchPane.tsx', 'GitPane.tsx', 'NotesPane.tsx', 'FileTreePane.tsx']) {
      const src = pane(name)
      assert.match(src, /<HxSideHead/, name)
      assert.equal(src.includes('className="pane-head"'), false, name)
      assert.equal(src.includes('dangerouslySetInnerHTML'), false, name)
    }
    const maps = pane('MapsPane.tsx')
    assert.match(maps, /<HxSideHead/)
    assert.equal(maps.includes('<HxPage'), false)
    assert.match(maps, /className="maps-wrap"/)
    assert.match(pane('BrowserPane.tsx'), /<HxEmpty/)
    assert.match(pane('TerminalPane.tsx'), /<HxEmpty/)
    const design = readFileSync(join(root, 'apps/renderer/src/panes/design/DesignHome.tsx'), 'utf8')
    assert.match(design, /<p className="hx-kicker">Hex AI<\/p>/)
    assert.match(design, /<HxEmpty/)
    assert.equal(design.includes('cd-avatar'), false)
  })

  it('does not paint MCP URLs or fetch Fleet domains; composer Review grouping stays', () => {
    const mods = pane('ModsPane.tsx')
    assert.equal(mods.includes('{s.url'), false)
    assert.equal(mods.includes('s.url ?'), false)
    const fleet = pane('FleetPane.tsx')
    assert.equal(/fetch\(/.test(fleet), false)
    assert.equal(/openExternal/.test(fleet), false)
    const chat = pane('ChatPane.tsx')
    assert.match(chat, /runReview\('quick'\)/)
    assert.match(chat, /runReview\('deep'\)/)
    assert.match(chat, /homeai\.agentReview\(depth\)/)
    assert.equal(chat.includes('<Settings'), false)
  })
})

describe('Hex AI overlay chrome', () => {
  const pane = (name) => readFileSync(join(root, 'apps/renderer/src/panes', name), 'utf8')
  const layout = (name) => readFileSync(join(root, 'apps/renderer/src/layout', name), 'utf8')

  it('palette and quick-open keep empty copy as text nodes', () => {
    const pal = layout('CommandPalette.tsx')
    const qo = layout('QuickOpen.tsx')
    const css = readFileSync(join(root, 'apps/renderer/src/styles/global.css'), 'utf8')
    assert.match(pal, /<HxEmpty/)
    assert.match(pal, /No matching commands/)
    assert.match(pal, /Type to filter commands/)
    assert.equal(pal.includes('dangerouslySetInnerHTML'), false)
    assert.equal(pal.includes('innerHTML'), false)
    assert.equal(pal.includes('__html'), false)
    assert.match(qo, /<HxEmpty/)
    assert.match(qo, /No matching files/)
    assert.match(qo, /stripActivityText/)
    assert.equal(qo.includes('dangerouslySetInnerHTML'), false)
    assert.equal(qo.includes('innerHTML'), false)
    assert.equal(qo.includes('__html'), false)
    assert.match(css, /\.palette-head/)
    assert.match(css, /\.palette \.hit:focus-visible/)
    assert.match(css, /\.palette \.hit\.on/)
  })

  it('PlanDoc empty is HxEmpty; StageGo stays off the Chat pill row', () => {
    const plan = pane('PlanDoc.tsx')
    const go = pane('StageGo.tsx')
    const pills = pane('StagePills.tsx')
    const css = readFileSync(join(root, 'apps/renderer/src/styles/global.css'), 'utf8')
    assert.match(plan, /<HxEmpty/)
    assert.match(plan, /This plan is empty/)
    assert.equal(plan.includes('dangerouslySetInnerHTML'), false)
    assert.equal(plan.includes('innerHTML'), false)
    assert.match(go, /takeGoTab/)
    assert.match(go, /pinSkill/)
    assert.match(go, /<HxEmpty/)
    assert.equal(go.includes('Chat and Cowork'), false)
    assert.equal(go.includes("layoutMode: 'stage'"), false)
    assert.match(pills, /Chat and Cowork/)
    assert.match(css, /\.stage-go-row button \{[^}]*min-height: 32px/)
    assert.equal(css.includes('0.28fr'), false)
  })

  it('design canvas and inspector empty stay text; no fake V avatar; Review and HxPage stay', () => {
    const editor = readFileSync(join(root, 'apps/renderer/src/panes/design/DesignEditor.tsx'), 'utf8')
    const ir = readFileSync(join(root, 'apps/renderer/src/panes/design/IrCanvas.tsx'), 'utf8')
    const ins = readFileSync(join(root, 'apps/renderer/src/panes/design/Inspector.tsx'), 'utf8')
    const studio = readFileSync(join(root, 'apps/renderer/src/panes/design/studio.css'), 'utf8')
    const chat = pane('ChatPane.tsx')
    const css = readFileSync(join(root, 'apps/renderer/src/styles/global.css'), 'utf8')
    assert.match(ir, /<HxEmpty/)
    assert.match(ir, /Canvas is empty/)
    assert.equal(ir.includes('dangerouslySetInnerHTML'), false)
    assert.match(ins, /<HxEmpty/)
    assert.match(ins, /Select a layer/)
    assert.equal(ins.includes('dangerouslySetInnerHTML'), false)
    assert.match(editor, /<HxEmpty/)
    assert.equal(editor.includes('cd-avatar'), false)
    assert.equal(editor.includes('>V</span>'), false)
    assert.match(studio, /\[data-studio='on'\]|\.cd-body/)
    assert.match(css, /\[data-studio='on'\]\.workbench \.body,/)
    assert.match(css, /minmax\(0, 1fr\) !important/)
    assert.match(chat, /runReview\('quick'\)/)
    assert.match(chat, /runReview\('deep'\)/)
    assert.match(chat, /homeai\.agentReview\(depth\)/)
    for (const name of ['TelegramPane.tsx', 'SettingsPane.tsx', 'FleetPane.tsx', 'LibraryPane.tsx', 'TaskboardPane.tsx']) {
      const src = pane(name)
      assert.match(src, /<HxPage/, name)
      assert.equal(src.includes('className="pane-head"'), false, name)
    }
  })
})

describe('Hex AI leftover chrome', () => {
  const pane = (name) => readFileSync(join(root, 'apps/renderer/src/panes', name), 'utf8')
  const layout = (name) => readFileSync(join(root, 'apps/renderer/src/layout', name), 'utf8')

  it('overlays, empties, and honest-disabled tools stay Hex text — T-102', () => {
    const css = readFileSync(join(root, 'apps/renderer/src/styles/global.css'), 'utf8')
    const studio = readFileSync(join(root, 'apps/renderer/src/panes/design/studio.css'), 'utf8')
    const shell = layout('WorkbenchShell.tsx')
    const pal = layout('CommandPalette.tsx')
    const crash = layout('PaneErrorBoundary.tsx')
    const chat = pane('ChatPane.tsx')
    const tree = pane('FileTreePane.tsx')
    const git = pane('GitDensity.tsx')
    const browser = pane('BrowserPane.tsx')
    const bg = pane('BackgroundTasks.tsx')
    const editor = readFileSync(join(root, 'apps/renderer/src/panes/design/DesignEditor.tsx'), 'utf8')

    assert.equal(studio.includes('.cd-avatar'), false)
    assert.equal(studio.includes('cd-avatar'), false)
    assert.match(studio, /\.cd-tool-off/)
    assert.match(studio, /\.cd-tool-hint/)
    assert.match(editor, /cd-tool-off/)
    assert.match(editor, /cd-tool-hint/)
    assert.match(editor, /Hex AI draws from the brief/)
    assert.equal(editor.includes('dangerouslySetInnerHTML'), false)

    assert.match(chat, /<HxEmpty/)
    assert.match(chat, /No matching sessions/)
    assert.match(chat, /No sessions yet/)
    assert.match(chat, /Pending diffs/)
    assert.match(chat, /runReview\('quick'\)/)
    assert.match(chat, /runReview\('deep'\)/)
    assert.match(chat, /homeai\.agentReview\(depth\)/)
    assert.equal(chat.includes('dangerouslySetInnerHTML'), false)

    assert.match(tree, /No matching files/)
    assert.match(tree, /<HxEmpty/)
    assert.equal(tree.includes('dangerouslySetInnerHTML'), false)
    assert.match(git, />Changed</)
    assert.match(git, /Most hunks/)
    assert.equal(git.includes('Trending'), false)
    assert.equal(git.includes('Top movers'), false)

    assert.match(browser, /Page did not load/)
    assert.match(browser, /Browser is offline/)
    assert.match(browser, /<HxEmpty/)
    assert.equal(browser.includes('dangerouslySetInnerHTML'), false)
    assert.match(bg, /<HxEmpty/)
    assert.match(bg, /No forge yet/)
    assert.equal(bg.includes('dangerouslySetInnerHTML'), false)
    assert.match(crash, /<HxEmpty/)
    assert.equal(crash.includes('dangerouslySetInnerHTML'), false)

    assert.match(shell, /llama-pop[\s\S]*hx-kicker/)
    assert.match(shell, /about-pop[\s\S]*hx-kicker/)
    assert.match(shell, /Agent idle/)
    assert.match(shell, /No problems/)
    assert.match(shell, /w\.qa\.length/)
    assert.match(shell, /activateByKey/)
    assert.equal(shell.includes('Agent 0/0'), false)
    assert.equal(shell.includes('Browser Tab'), false)
    assert.equal(css.includes('#04395e'), false)
    assert.equal(css.includes('0.28fr'), false)
    assert.match(css, /\[data-tier='potato'\] \.llama-pop/)
    assert.match(css, /\[data-tier='potato'\] \.mode-pop/)
    assert.match(css, /\[data-tier='potato'\] \.sess-menu/)
    assert.match(pal, /c\.kbd \? <kbd>\{c\.kbd\}<\/kbd>/)
    assert.equal(pal.includes('c.kbd || c.id'), false)
    assert.equal(pal.includes('dangerouslySetInnerHTML'), false)

    const pills = pane('StagePills.tsx')
    assert.match(pills, /Chat and Cowork/)
    assert.equal(pills.includes("layoutMode: 'stage'"), false)
    for (const name of ['TelegramPane.tsx', 'SettingsPane.tsx', 'FleetPane.tsx']) {
      const src = pane(name)
      assert.match(src, /<HxPage/, name)
      assert.equal(src.includes('className="pane-head"'), false, name)
    }
  })
})

describe('Hex AI leftover chrome tokens', () => {
  const pane = (name) => readFileSync(join(root, 'apps/renderer/src/panes', name), 'utf8')
  const layout = (name) => readFileSync(join(root, 'apps/renderer/src/layout', name), 'utf8')

  it('send, studio save, unused pane-head, and terminal labels stay Hex — T-103', () => {
    const css = readFileSync(join(root, 'apps/renderer/src/styles/global.css'), 'utf8')
    const studio = readFileSync(join(root, 'apps/renderer/src/panes/design/studio.css'), 'utf8')
    const term = pane('TerminalPane.tsx')
    const pal = layout('CommandPalette.tsx')
    const chat = pane('ChatPane.tsx')

    assert.equal(css.includes('#007acc'), false)
    assert.equal(css.includes('#0e639c'), false)
    assert.equal(css.includes('#0078d4'), false)
    assert.equal(css.includes('#9cdcfe'), false)
    assert.match(css, /\.send\s*\{[^}]*var\(--amber\)/)
    assert.match(css, /\.send\s*\{[^}]*var\(--radius\)/)
    assert.match(css, /\.send:focus-visible[\s\S]*?var\(--focus\)/)
    assert.match(css, /\[data-tier='potato'\] \.send/)
    assert.equal(css.includes('.pane-head'), false)
    assert.equal(css.includes('0.28fr'), false)
    assert.match(css, /minmax\(0, 1fr\) !important/)

    assert.equal(studio.includes('#82b1ff'), false)
    assert.equal(studio.includes('#9cdcfe'), false)
    assert.match(studio, /\.cd-save\s*\{[^}]*var\(--amber\)/)
    assert.match(studio, /\.cd-tool-off/)
    assert.match(studio, /\.cd-body \{[^}]*grid-template-columns: 340px minmax\(0, 1fr\)/)

    assert.match(term, /Checks\{problems\.length/)
    assert.match(term, /Kernel log/)
    assert.match(term, /Workflow/)
    assert.match(term, /No problems/)
    assert.match(term, /termPanel: 'problems'/)
    assert.match(term, /termPanel: 'debug'/)
    assert.match(term, /termPanel: 'runtime'/)
    assert.match(term, /Runtime/)
    assert.match(term, /Debug this test/)
    assert.match(term, /aria-label="Bottom panels"/)
    assert.match(term, /activateByKey/)
    assert.match(term, /aria-label="New Terminal"/)
    assert.match(term, /role="tabpanel"/)
    assert.equal(term.includes('Debug Console'), false)
    assert.equal(term.includes('Problems{'), false)
    assert.equal(term.includes('dangerouslySetInnerHTML'), false)
    const runtime = pane('RuntimeDebugPane.tsx')
    const editor = pane('EditorPane.tsx')
    assert.match(runtime, /aria-label="Continue"/)
    assert.match(runtime, /aria-label="Stop debug session"/)
    assert.equal(runtime.includes('dangerouslySetInnerHTML'), false)
    assert.match(editor, /aria-label="Edit selection"/)
    assert.match(pal, /Checks panel/)
    assert.match(pal, /Kernel log/)
    assert.equal(pal.includes('Problems panel'), false)
    assert.equal(pal.includes('dangerouslySetInnerHTML'), false)

    assert.match(chat, /runReview\('quick'\)/)
    assert.match(chat, /runReview\('deep'\)/)
    assert.match(chat, /homeai\.agentReview\(depth\)/)
    assert.equal(chat.includes('dangerouslySetInnerHTML'), false)
    for (const name of ['TelegramPane.tsx', 'SettingsPane.tsx', 'FleetPane.tsx']) {
      const src = pane(name)
      assert.match(src, /<HxPage/, name)
      assert.equal(src.includes('className="pane-head"'), false, name)
    }
  })

  it('send-round and leftover product chrome hexes stay Hex tokens — T-104', () => {
    const css = readFileSync(join(root, 'apps/renderer/src/styles/global.css'), 'utf8')
    const studio = readFileSync(join(root, 'apps/renderer/src/panes/design/studio.css'), 'utf8')
    const term = pane('TerminalPane.tsx')
    const chat = pane('ChatPane.tsx')
    const product = `${css}\n${studio}`
    const sendRound = css.match(/\.send-round\s*\{[^}]*\}/)
    assert.ok(sendRound, 'send-round rule')
    assert.match(sendRound[0], /background:\s*var\(--amber\)/)
    assert.equal(/background:\s*#fff\b/i.test(sendRound[0]), false)
    assert.match(sendRound[0], /min-height:\s*32px/)
    assert.match(css, /\[data-tier='potato'\] \.send-round/)
    assert.match(studio, /\.cd-export\s*\{[^}]*var\(--amber\)/)
    assert.match(studio, /\.cd-tool-off/)
    const chromeHex = [
      '#89b4fa',
      '#569cd6',
      '#519aba',
      '#007acc',
      '#0e639c',
      '#0078d4',
      '#82b1ff',
      '#9cdcfe',
      '#ffab91',
      '#3b82f6',
      '#2979ff'
    ]
    for (const hex of chromeHex) {
      assert.equal(product.toLowerCase().includes(hex), false, hex)
    }
    assert.equal(css.includes('0.28fr'), false)
    assert.equal(css.includes('.pane-head'), false)
    assert.match(term, /Checks\{problems\.length/)
    assert.match(term, /Kernel log/)
    assert.match(term, /Workflow/)
    assert.equal(term.includes('Debug Console'), false)
    assert.equal(term.includes('dangerouslySetInnerHTML'), false)
    assert.match(chat, /runReview\('quick'\)/)
    assert.match(chat, /runReview\('deep'\)/)
    assert.match(chat, /homeai\.agentReview\(depth\)/)
    assert.equal(chat.includes('dangerouslySetInnerHTML'), false)
    for (const name of ['TelegramPane.tsx', 'SettingsPane.tsx', 'FleetPane.tsx']) {
      const src = pane(name)
      assert.match(src, /<HxPage/, name)
      assert.equal(src.includes('className="pane-head"'), false, name)
    }
  })

  it('form cards, Design home, crumbs, and outline stay Hex text — T-105', () => {
    const pane = (name) => readFileSync(join(root, 'apps/renderer/src/panes', name), 'utf8')
    const css = readFileSync(join(root, 'apps/renderer/src/styles/global.css'), 'utf8')
    const chat = pane('ChatPane.tsx')
    const settings = pane('SettingsPane.tsx')
    const telegram = pane('TelegramPane.tsx')
    const fleet = pane('FleetPane.tsx')
    const git = pane('GitPane.tsx')
    const mods = pane('ModsPane.tsx')
    const home = readFileSync(join(root, 'apps/renderer/src/panes/design/DesignHome.tsx'), 'utf8')
    const editor = pane('EditorPane.tsx')
    const tree = pane('FileTreePane.tsx')
    const shell = readFileSync(join(root, 'apps/renderer/src/layout/WorkbenchShell.tsx'), 'utf8')
    const outline = readFileSync(join(root, 'apps/renderer/src/layout/GotoSymbol.tsx'), 'utf8')
    assert.match(css, /\.hx-form\s*\{/)
    assert.match(css, /\.hx-card\s*\{/)
    for (const [name, src] of [
      ['SettingsPane.tsx', settings],
      ['TelegramPane.tsx', telegram],
      ['FleetPane.tsx', fleet],
      ['ModsPane.tsx', mods]
    ]) {
      assert.match(src, /className="hx-form/, name)
      assert.match(src, /className="hx-card/, name)
      assert.equal(src.includes('dangerouslySetInnerHTML'), false, name)
    }
    assert.match(git, /className="hx-form/)
    assert.match(settings, /hx-rail/)
    assert.match(settings, /Trust/)
    assert.match(settings, /Hardware/)
    assert.equal(home.includes('CHOOSE A TEMPLATE'), false)
    assert.match(editor, /takeCrumbPrefix/)
    assert.match(editor, /goCrumb/)
    assert.equal(editor.includes('homeai:fs:stat'), false)
    assert.equal(tree.includes('homeai:fs:stat'), false)
    assert.equal(shell.includes('homeai:fs:stat'), false)
    assert.match(tree, /treeFocus/)
    assert.match(outline, /takeBufferOutline/)
    assert.match(outline, /Search workspace/)
    assert.equal(outline.includes('dangerouslySetInnerHTML'), false)
    const term = pane('TerminalPane.tsx')
    assert.match(term, /problem-row/)
    assert.match(term, /outlineJump/)
    const lang = readFileSync(join(root, 'apps/renderer/src/lib/tsLanguage.ts'), 'utf8')
    assert.match(lang, /registerEditorOpener/)
    assert.equal(lang.includes('dangerouslySetInnerHTML'), false)
    assert.match(shell, /aria-label=\{it\.label\}/)
    assert.match(shell, /outlineOpen/)
    assert.match(shell, /GotoSymbol/)
    assert.equal(css.includes('0.28fr'), false)
    assert.match(chat, /runReview\('quick'\)/)
    assert.match(chat, /runReview\('deep'\)/)
    assert.match(chat, /homeai\.agentReview\(depth\)/)
  })

  it('workbench chrome uses Hex tokens; first-run is not a second product — T-111', () => {
    const css = readFileSync(join(root, 'apps/renderer/src/styles/global.css'), 'utf8')
    const shell = readFileSync(join(root, 'apps/renderer/src/layout/WorkbenchShell.tsx'), 'utf8')
    const titlebar = css.match(/\.titlebar\s*\{[^}]*\}/)
    const llama = css.match(/\.llama-pop\s*\{[^}]*\}/)
    const about = css.match(/\.about-pop\s*\{[^}]*\}/)
    assert.ok(titlebar && llama && about)
    assert.match(titlebar[0], /background:\s*var\(--bg-raise\)/)
    assert.match(llama[0], /background:\s*var\(--bg-panel\)/)
    assert.match(about[0], /background:\s*var\(--bg-panel\)/)
    assert.match(shell, /about-pop hx-card/)
    assert.match(shell, /className="hx-row"/)
    assert.equal(shell.includes('dangerouslySetInnerHTML'), false)
    assert.equal(shell.includes('homeai:fs:stat'), false)
    assert.equal(shell.includes("from './Onboard'"), false)
    assert.equal(shell.includes('<Onboard'), false)
    assert.equal(existsSync(join(root, 'apps/renderer/src/layout/Onboard.tsx')), false)
    const roots = readFileSync(join(root, 'packages/runtime/src/app-roots.mjs'), 'utf8')
    assert.match(roots, /if \(!roots \|\| !roots\.packaged\) return false/)
  })

  it('flex children scroll instead of clipping chrome — T-133', () => {
    const css = readFileSync(join(root, 'apps/renderer/src/styles/global.css'), 'utf8')
    const shell = readFileSync(join(root, 'apps/renderer/src/layout/WorkbenchShell.tsx'), 'utf8')
    const notes = readFileSync(join(root, 'apps/renderer/src/panes/NotesPane.tsx'), 'utf8')
    const browser = readFileSync(join(root, 'apps/renderer/src/panes/BrowserPane.tsx'), 'utf8')
    assert.match(css, /\.workbench\s*\{[^}]*grid-template-rows:\s*30px minmax\(0, 1fr\) 22px/)
    assert.match(css, /\.term-tabs\s*\{[^}]*overflow-x:\s*auto/)
    assert.match(css, /\.tree\s*\{[^}]*min-height:\s*0/)
    assert.match(css, /\.side-list\s*\{[^}]*min-height:\s*0/)
    assert.match(css, /\.notes-list\s*\{[^}]*min-height:\s*0/)
    assert.match(css, /\.agents-foot\s*\{[^}]*flex-shrink:\s*0/)
    assert.match(css, /\[data-page='on'\]:not\(\[data-studio='on'\]\) \.body\s*\{[^}]*var\(--activity\) minmax\(0, 1fr\) var\(--split\) var\(--chat\)/)
    assert.match(css, /\[data-page='on'\]\[data-chat='off'\]:not\(\[data-studio='on'\]\) \.body\s*\{[^}]*var\(--activity\) minmax\(0, 1fr\)/)
    assert.match(css, /\[data-editor='off'\]\[data-chat='on'\]:not\(\[data-studio='on'\]\):not\(\[data-page='on'\]\) \.body\s*\{[^}]*var\(--activity\) minmax\(0, 1fr\) !important/)
    assert.equal(css.includes('0px 0px minmax(0, 1fr)'), false)
    assert.match(css, /\.status \.stat-click[\s\S]*?text-overflow:\s*ellipsis/)
    assert.match(css, /\.center-stage\.split-side\s*\{[^}]*minmax\(0, 1fr\) minmax\(0, 1fr\)/)
    assert.match(css, /\.kanban\s*\{[^}]*auto-fit/)
    assert.equal(css.includes('0.28fr'), false)
    assert.match(shell, /data-activity=\{w\.activity\}/)
    assert.match(shell, /className="tab active pane-tab"/)
    assert.equal(shell.includes('dangerouslySetInnerHTML'), false)
    assert.match(notes, /className="side-input"/)
    assert.equal(notes.includes('dangerouslySetInnerHTML'), false)
    assert.match(browser, /minHeight: 0/)
    assert.equal(browser.includes('dangerouslySetInnerHTML'), false)
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  catalogCard,
  dockKind,
  dockKeyboard,
  manageCard,
  stageCard,
  statusDashboard,
  doneKeyboard,
  glassAppKeyboard,
  formatConsole,
  helpCard,
  menuCard,
  liveKeyboard,
  menuInlineKeyboard,
  needPairCard,
  phaseTrack,
  stripParseMode,
  takeMode,
  takeNav,
  welcomeCard
} from './telegram-chrome.mjs'

describe('telegram chrome', () => {
  it('never keeps markup or parse_mode on the glass', () => {
    const card = formatConsole(['hello <img src=x> https://evil.example'], { state: 'live', kicker: '<b>x' })
    assert.match(card, /^HOME · LIVE/)
    assert.equal(card.includes('<'), false)
    const welcome = welcomeCard({ displayName: 'Ada <script>' })
    assert.equal(welcome.includes('<'), false)
    assert.match(welcome, /kernel stays on your desk/i)
    const group = needPairCard(true)
    assert.match(group, /cannot drive/)
    assert.equal(stripParseMode({ parse_mode: 'HTML', text: 'x' }).parse_mode, undefined)
    assert.equal(takeMode('agent'), 'agent')
    assert.equal(takeMode('rm'), null)
    assert.equal(takeNav('tools'), 'tools')
    assert.equal(takeNav('stage'), 'stage')
    assert.equal(takeNav('skills'), 'skills')
    assert.equal(takeNav('fleet'), 'fleet')
    assert.match(helpCard(), /\/stage/)
    assert.match(helpCard(), /\/fleet/)
    assert.match(helpCard(), /\/new/)
    assert.equal(helpCard().includes('full PC tools'), false)
    assert.match(helpCard(), /packs not every MCP/)
    assert.match(helpCard(), /Ask/)
    assert.equal(helpCard({ approvalMode: 'auto-review' }).includes('Auto-review'), true)
    assert.equal(helpCard().includes('Auto-review'), false)
    assert.match(menuCard({ approvalMode: 'auto-review' }), /Auto-review/)
    assert.match(menuCard(), /Ask/)
    assert.equal(/Landlock sandbox/i.test(helpCard({ approvalMode: 'auto-review' })), false)
    assert.equal(takeNav('../x'), null)
  })

  it('maps the dock and jails callback ids', () => {
    assert.equal(dockKind('Pulse'), 'status')
    assert.equal(dockKind('Manage'), 'manage')
    assert.equal(dockKind('Stage'), 'stage')
    assert.equal(dockKind('Trust'), 'manage')
    assert.equal(dockKind('New'), 'new-chat')
    assert.equal(dockKind('Skills'), 'skills')
    assert.equal(dockKind('  STACK  '), 'tools')
    assert.equal(dockKind('HOME'), 'app')
    assert.equal(dockKind('Fleet'), 'fleet')
    assert.equal(dockKind('/fleet'), null)
    assert.equal(dockKind('hello'), null)
    const glass = glassAppKeyboard('https://glass.example/app')
    assert.equal(glass.keyboard[0][0].web_app.url, 'https://glass.example/app')
    const glassLabels = glass.keyboard.flat().map((b) => b.text)
    assert.equal(glassLabels.includes('Stage'), true)
    assert.equal(glassLabels.includes('Trust'), true)
    assert.equal(glassLabels.includes('Manage'), true)
    assert.equal(glassLabels.includes('Pulse'), true)
    const dockLabels = dockKeyboard().keyboard.flat().map((b) => b.text)
    assert.equal(dockLabels.includes('Stage'), true)
    assert.equal(dockLabels.includes('Trust'), true)
    assert.equal(dockLabels.includes('New'), true)
    assert.equal(dockLabels.includes('Skills'), true)
    assert.equal(dockLabels.includes('Fleet'), true)
    assert.equal(glassLabels.includes('New'), true)
    assert.equal(glassLabels.includes('Skills'), true)
    assert.equal(glassAppKeyboard('http://evil.example').keyboard[0][0].web_app, undefined)
    assert.match(phaseTrack('act'), /◉/)
    const menu = menuInlineKeyboard()
    assert.equal(menu.inline_keyboard[0][2].callback_data, 'mod:set:agent')
    assert.equal(menu.inline_keyboard[2][0].callback_data, 'nav:go:stage')
    assert.equal(menu.inline_keyboard[2][1].callback_data, 'nav:go:manage')
    assert.equal(menu.inline_keyboard[3][2].callback_data, 'mod:mind:cursor')
    assert.equal(menu.inline_keyboard[4][1].callback_data, 'nav:go:skills')
    assert.equal(menu.inline_keyboard[5][0].callback_data, 'nav:go:manage')
    assert.equal(takeNav('manage'), 'manage')
    assert.equal(takeNav('llama'), 'llama')
    assert.equal(takeNav('trust'), null)
    assert.equal(liveKeyboard('../x').inline_keyboard.length, 0)
    assert.equal(doneKeyboard('job.1').inline_keyboard[0][0].callback_data, 'run:job.1')
    const cat = catalogCard('STACK', 'git · status\nurl=https://evil.example')
    assert.match(cat, /HOME/)
    const pulse = statusDashboard({
      provider: 'cursor',
      llama: 'on',
      keys: 'cursor',
      cursor: 'RUNNING · ship <b>'
    })
    assert.match(pulse, /llama/)
    assert.equal(pulse.includes('<'), false)
    assert.equal(pulse.includes('sk-'), false)
    const desk = manageCard({
      online: true,
      mind: 'cursor',
      llama: 'on',
      keys: 'cursor',
      live: 'ship <b>',
      peers: 1
    })
    assert.match(desk, /MANAGE/)
    assert.equal(desk.includes('<'), false)
    const stage = stageCard({
      phase: 'act',
      think: 'Built',
      thinkTitle: '<script>plan</script>',
      approval: 'write_file <b>',
      waiting: true,
      llama: 'on',
      keys: 'openai',
      lanes: [
        { name: 'str_replace', status: 'running' },
        { name: 'test_run', status: 'done' }
      ],
      items: [{ type: 'error', error: 'boom <img src=x> token=sk-abc12345678' }]
    })
    assert.match(stage, /STAGE/)
    assert.match(stage, /Ask/)
    assert.match(stage, /no Landlock/)
    assert.match(stage, /implementing/)
    assert.equal(stage.includes('Built'), false)
    assert.equal(stage.includes('Cowork'), false)
    assert.equal(stage.includes('Hunt3'), false)
    assert.equal(stage.includes('<'), false)
    assert.equal(stage.includes('sk-'), false)
    assert.equal(/Landlock sandbox/i.test(stage), false)
    assert.equal(stripParseMode({ parse_mode: 'MarkdownV2', text: stage }).parse_mode, undefined)
    const phased = stageCard({
      phase: 'verify',
      busy: true,
      runId: 'job1',
      chunks: [
        { type: 'step', step: 'act' },
        { type: 'tool_call', toolCall: { id: 'e', name: 'explore', arguments: { path: '/etc/passwd' } }, lane: 'hunt' },
        { type: 'status', text: 'ok explore' },
        { type: 'step', step: 'verify' },
        { type: 'status', text: 'verify · critic pass (str_replace|debug_log|ask_user)' }
      ]
    })
    assert.match(phased, /Hunt 1\/1/)
    assert.match(phased, /Critic 0\/1/)
    assert.equal(phased.includes('/etc/passwd'), false)
    assert.equal(phased.includes('Hunt3'), false)
    assert.equal(phased.includes('<'), false)
    const ar = stageCard({ approvalMode: 'auto-review' })
    assert.match(ar, /Auto-review/)
    assert.match(ar, /no Landlock/)
    assert.equal(/Landlock sandbox/i.test(ar), false)
    assert.equal(ar.includes('<'), false)
    const def = stageCard({})
    assert.match(def, /Ask/)
    assert.equal(def.includes('Auto-review'), false)
    const lined = stageCard({
      approvalMode: 'auto-review',
      autoReviewLine: 'auto-review · judge · allow · safe-git'
    })
    assert.match(lined, /auto-review · judge · allow · safe-git/)
    assert.equal(stageCard({ autoReviewLine: 'rm -rf /' }).includes('rm -rf'), false)
    assert.equal(stageCard({ autoReviewLine: 'auto-review · judge · allow · <img>' }).includes('<'), false)
  })
})

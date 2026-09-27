import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  stripActivityText,
  takeCrumbPrefix,
  takeBufferOutline,
  groupActivity,
  countDiffLines,
  lastForgeStep,
  formatDuration,
  countRunningTasks,
  sessionPreview,
  sessionTitle,
  chatLink,
  projectTag,
  takeEffort,
  filterTranscript,
  splitHuntVerify,
  chromeRoute,
  phasePips,
  publicToolCall,
  toolCallName,
  foldMin,
  parseReviewHunks,
  laneBuckets,
  publicTokens,
  formatPublicTokens,
  parsePublicTokens,
  takeSseUsage,
  takeUsageTotal,
  formatAgo,
  EFFORT_LABELS,
  takeWorkflow,
  emptyWorkflow,
  workflowId,
  takeWorkflowModel,
  workflowPhaseLine,
  splitWorkflowPhases,
  workflowTokenLabel,
  desktopOwnsAgentChunk,
  workflowForgeStep
} from './activity.mjs'

describe('activity groups', () => {
  it('folds consecutive tools and strips markup from labels', () => {
    const groups = groupActivity([
      { id: '1', kind: 'user', text: 'fix auth' },
      { id: '2', kind: 'tool', text: 'ok explore src' },
      { id: '3', kind: 'shell', caption: '<img src=x>npm test', text: 'ok' },
      { id: '4', kind: 'assistant', text: 'done' }
    ])
    assert.equal(groups.length, 3)
    assert.equal(groups[1].type, 'commands')
    assert.equal(groups[1].items.length, 2)
    assert.equal(groups[1].label, 'Ran 2 commands')
    assert.equal(groups[1].label.includes('<'), false)
    const one = groupActivity([{ id: 's', kind: 'tool', text: '<b>ok grep</b>' }])
    assert.equal(one[0].label.includes('<'), false)
    assert.equal(one[0].label.includes('b'), true)
  })

  it('summarizes a single edit with +N −M and skips forge step rows', () => {
    const before = 'keep\n'
    const after = 'keep\nnew\n'
    const { adds, dels } = countDiffLines(before, after)
    const groups = groupActivity([
      { id: 's', kind: 'step', step: 'act' },
      { id: 'd', kind: 'diff', text: 'routes.py', path: 'app/routes.py', before, after }
    ])
    assert.equal(groups.length, 1)
    assert.equal(groups[0].label, `Edited routes.py +${adds} −${dels}`)
    assert.ok(adds > 0)
    assert.equal(lastForgeStep([{ kind: 'step', step: 'perceive' }, { kind: 'step', step: 'verify' }]), 'verify')
  })

  it('counts running tasks without treating busy+wait as two forge rows', () => {
    assert.equal(
      countRunningTasks({ busy: true, waitingShell: true, subRunning: 2, cloudRunning: 1, ptyCount: 3, queueLen: 1 }),
      6
    )
    assert.equal(countRunningTasks({ busy: false, waitingShell: true, ptyCount: 0 }), 1)
    assert.equal(formatDuration(76 * 3600_000 + 21 * 60_000 + 19_000), '76h 21m 19s')
    assert.equal(sessionPreview([{ kind: 'user', text: '<script>x</script> hi' }]).includes('<'), false)
    assert.equal(stripActivityText('<x>', 80), 'x')
    assert.equal(takeCrumbPrefix('../etc', 0), null)
    assert.equal(takeCrumbPrefix('apps/renderer/src/foo.tsx', 0), 'apps')
    assert.equal(takeCrumbPrefix('apps/renderer/src/foo.tsx', 2), 'apps/renderer/src')
    assert.equal(takeCrumbPrefix('apps/renderer/src/foo.tsx', 3), null)
    assert.equal(takeCrumbPrefix('data/secrets/x', 0), null)
    const outline = takeBufferOutline('export function hello() {}\n# Title\nconst skip', '')
    assert.equal(outline[0].line, 1)
    assert.equal(outline[0].label, 'function hello')
    assert.equal(outline.some((r) => r.label === 'Title'), true)
    assert.equal((takeBufferOutline('<script>function x(){}', 'x')[0]?.label || '').includes('<'), false)
  })

  it('public tool_call keeps the name and drops arguments', () => {
    const pub = publicToolCall({
      id: 'c1',
      name: 'explore',
      arguments: { path: '../secrets', token: 'sk-test' }
    })
    assert.deepEqual(pub, { id: 'c1', name: 'explore', arguments: {} })
    assert.equal(publicToolCall({ name: '<img src=x>' }), null)
    assert.equal(toolCallName('fs_read'), 'fs_read')
    assert.equal(toolCallName('a b'), null)
  })

  it('compact density folds consecutive thoughts; review hunks jail paths', () => {
    const g = groupActivity(
      [
        { id: 't1', kind: 'thought', text: '<b>one</b>' },
        { id: 't2', kind: 'thought', text: 'two' },
        { id: 'c', kind: 'tool', text: 'ok explore' }
      ],
      { density: 'compact' }
    )
    assert.equal(g[0].type, 'thought')
    assert.equal(g[0].items.length, 2)
    assert.equal(g[0].label, 'Thought · 2')
    assert.equal(foldMin('compact'), 2)
    assert.equal(foldMin('spacious'), 999)
    const hunks = parseReviewHunks('apps/renderer/src/panes/ChatPane.tsx med · keep\n../etc/passwd\n<script>x')
    assert.equal(hunks[0].path, 'apps/renderer/src/panes/ChatPane.tsx')
    assert.equal(hunks.some((h) => h.path.includes('..')), false)
    assert.equal(hunks.every((h) => !h.line.includes('<')), true)
    const lanes = laneBuckets([
      { id: 'a', name: 'explore', status: 'running', started: 1, tokens: '99k' },
      { id: 'b', name: '<img>', status: 'done' },
      { id: 'c', name: 'grep', status: 'error', tokens: 'not-a-count' }
    ])
    assert.equal(lanes.running[0].name, 'explore')
    assert.equal(lanes.running[0].tokens, '99k')
    assert.equal(lanes.error[0].tokens, '')
    assert.equal(publicTokens('12k'), '12k')
    assert.equal(publicTokens('sk-live'), '')
    assert.equal(formatAgo(0, 120_000), '2m')
    assert.equal(stripActivityText('<img src=x>shot.png', 80).includes('<'), false)
    assert.equal(stripActivityText('<b>shot.png</b>', 80).includes('<'), false)
  })

  it('jails session titles, chat links, transcript views, and Hunt/Verify names', () => {
    assert.equal(sessionTitle('<img src=x>Hi').includes('<'), false)
    assert.equal(sessionTitle('  '), 'New agent')
    assert.equal(chatLink('chat_ok'), 'homeai://chat/chat_ok')
    assert.equal(chatLink('../secret'), '')
    assert.equal(chatLink('javascript:alert(1)'), '')
    assert.equal(projectTag('/tmp/Home AI').includes('/'), false)
    assert.equal(projectTag('/tmp/Home AI'), 'Hex AI')
    assert.equal(projectTag('/home/x/Home AI'), 'Hex AI')
    assert.equal(projectTag(''), 'Hex AI')
    assert.equal(takeEffort(9), 5)
    assert.equal(takeEffort('nope'), 2)
    assert.equal(EFFORT_LABELS.length, 6)
    assert.equal(EFFORT_LABELS[2], 'Normal')
    const groups = groupActivity([
      { id: '1', kind: 'user', text: 'hi' },
      { id: '2', kind: 'tool', text: 'ok explore' },
      { id: '3', kind: 'thought', text: '<b>x</b>' }
    ])
    assert.equal(filterTranscript(groups, 'summary').length, 0)
    const think = filterTranscript(groups, 'thinking')
    assert.equal(think.some((g) => g.type === 'commands'), false)
    assert.equal(think.some((g) => g.type === 'thought'), true)
    const hv = splitHuntVerify([
      { id: 'a', name: 'explore', status: 'done' },
      { id: 'b', name: 'test_run', status: 'running' },
      { id: 'c', name: '<img>', status: 'done' }
    ])
    assert.equal(hv.hunt[0].name, 'explore')
    assert.equal(hv.verify[0].name, 'test_run')
    assert.equal(hv.hunt.some((r) => r.name.includes('<')), false)
    assert.equal(chromeRoute('design', true), 'design')
    assert.equal(chromeRoute('design', false), 'design')
    assert.equal(chromeRoute('design', 'stage'), 'design')
    assert.equal(chromeRoute('files', true), 'cowork')
    assert.equal(chromeRoute('files', false), 'code')
    assert.equal(chromeRoute('files', 'stage'), 'code')
    assert.equal(chromeRoute('files', 'focus'), 'code')
    assert.equal(chromeRoute('files', 'dock'), 'code')
    const routes = new Set(['design', 'cowork', 'code'])
    for (const a of ['files', 'design', 'library']) {
      for (const c of [true, false, 'stage', 'focus', 'dock', 'cowork']) {
        assert.equal(routes.has(chromeRoute(a, c)), true)
      }
    }
    assert.notEqual(chromeRoute('files', true), chromeRoute('files', false))
    assert.notEqual(chromeRoute('design', false), chromeRoute('files', false))
    const pips = phasePips(5, 8)
    assert.equal(pips.length, 8)
    assert.equal(pips.filter((x) => x === 'on').length, 5)
    assert.equal(phasePips(99, 3).every((x) => x === 'on'), true)
    const live = phasePips(1, 3, 3, 1)
    assert.equal(live[1], 'run')
    assert.equal(publicTokens('1.7M'), '1.7M')
    assert.equal(publicTokens('123.6k'), '123.6k')
    assert.equal(formatPublicTokens(1_700_000), '1.7M')
    assert.equal(parsePublicTokens('1.7M'), 1_700_000)
  })
})

describe('takeWorkflow', () => {
  it('jails id and title, drops a mismatched run id, and never paints markup', () => {
    let wf = takeWorkflow(null, { type: 'status', text: 'start' }, {
      runId: 'abc.1',
      task: 'Hunt <script>x</script> delivery',
      model: 'Opus 5',
      now: 1000
    })
    assert.equal(wf.id, 'wf_abc.1')
    assert.equal(wf.title.includes('<'), false)
    assert.equal(takeWorkflowModel('Opus 5'), '')
    assert.equal(wf.model, '')
    const kept = takeWorkflow(wf, { type: 'tool_call', toolCall: { id: 'e', name: 'explore', arguments: {} }, lane: 'hunt' }, {
      runId: 'other',
      now: 1001
    })
    assert.equal(kept.agents.length, 0)
    assert.equal(kept.id, 'wf_abc.1')
    wf = takeWorkflow(wf, { type: 'tool_call', toolCall: { id: 'e', name: 'explore', arguments: { path: '../secrets' } }, lane: 'hunt' }, {
      runId: 'abc.1',
      model: 'local',
      now: 1002
    })
    assert.equal(wf.agents[0].name, 'explore')
    assert.equal(wf.model, 'local 2B')
    assert.equal(JSON.stringify(wf).includes('secrets'), false)
    assert.equal(workflowId('../x'), '')
    assert.equal(emptyWorkflow().id, '')
  })

  it('puts critic-pass tools on critic, not ACT str_replace, and skipVerify is skipped', () => {
    const meta = { runId: 'r1', task: 'fix', model: 'openai', now: 10 }
    let wf = takeWorkflow(null, { type: 'step', step: 'act' }, meta)
    wf = takeWorkflow(wf, { type: 'tool_call', toolCall: { id: 's', name: 'str_replace', arguments: {} }, lane: 'hunt' }, { ...meta, now: 11 })
    wf = takeWorkflow(wf, { type: 'status', text: 'ok str_replace' }, { ...meta, now: 12 })
    wf = takeWorkflow(wf, { type: 'tool_call', toolCall: { id: 't', name: 'test_run', arguments: {} }, lane: 'verify' }, { ...meta, now: 13 })
    wf = takeWorkflow(wf, { type: 'status', text: 'ok test_run' }, { ...meta, now: 14 })
    const act = splitWorkflowPhases(wf)
    assert.equal(act.hunt[0].name, 'str_replace')
    assert.equal(act.verify[0].name, 'test_run')
    assert.equal(act.critic.length, 0)
    wf = takeWorkflow(wf, { type: 'step', step: 'verify' }, { ...meta, now: 15 })
    wf = takeWorkflow(wf, { type: 'status', text: 'verify · critic pass (str_replace|debug_log|ask_user)' }, { ...meta, now: 16 })
    wf = takeWorkflow(wf, { type: 'tool_call', toolCall: { id: 'c', name: 'str_replace', arguments: {} }, lane: 'critic' }, { ...meta, now: 17 })
    const phases = splitWorkflowPhases(wf)
    assert.equal(phases.critic.some((a) => a.name === 'critic'), true)
    assert.equal(phases.critic.some((a) => a.name === 'str_replace' && a.lane === 'critic'), true)
    assert.equal(phases.hunt.filter((a) => a.name === 'str_replace').length, 1)
    assert.match(workflowPhaseLine(wf), /Hunt 1\/1/)
    assert.match(workflowPhaseLine(wf), /Verify 1\/1/)
    assert.match(workflowPhaseLine(wf), /Critic 0\/2/)
    let skipped = takeWorkflow(null, { type: 'status', text: 'verify · skipped (subagent)' }, { runId: 'nest', now: 1 })
    assert.equal(skipped.criticSkipped, true)
    assert.equal(skipped.agents.some((a) => a.name === 'critic'), false)
    assert.match(workflowPhaseLine(skipped), /Critic skipped/)
    let fleetWf = takeWorkflow(null, { type: 'status', text: 'fleet · repos 1 · bots 0 · live 1' }, { runId: 'fl', now: 1 })
    assert.match(fleetWf.fleet, /live 1/)
    assert.equal(fleetWf.fleet.includes('<'), false)
    assert.equal(splitWorkflowPhases(fleetWf).hunt.some((a) => a.name === 'fleet'), true)
  })

  it('fills tokens only from usage, never from text length', () => {
    const essay = 'x'.repeat(4000)
    let wf = takeWorkflow(null, { type: 'text', text: essay }, { runId: 'tok', now: 1 })
    assert.equal(wf.tokens, '')
    assert.equal(takeSseUsage({ usage: { total_tokens: 1500 } }), 1500)
    assert.equal(takeSseUsage({ timings: { prompt_n: 10, predicted_n: 20 } }), 30)
    assert.equal(takeUsageTotal({ total: -3 }), 0)
    wf = takeWorkflow(wf, { type: 'usage', usage: { total: 1500 } }, { runId: 'tok', now: 2 })
    assert.equal(wf.tokens, '1.5k')
    assert.equal(wf.tokensKind, 'usage')
    assert.equal(workflowTokenLabel(wf), '1.5k')
    wf = takeWorkflow(wf, { type: 'context', context: { total: 8000 } }, { runId: 'tok', now: 3 })
    assert.equal(wf.tokensKind, 'usage')
    let ctx = takeWorkflow(null, { type: 'context', context: { total: 8000 } }, { runId: 'ctx', now: 1 })
    assert.equal(ctx.tokensKind, 'context')
    assert.match(workflowTokenLabel(ctx), /context/)
    assert.equal(publicTokens('<img>'), '')
    assert.equal(publicTokens('sk-live'), '')
    assert.equal(formatPublicTokens(essay.length / 4), '1k')
    assert.equal(wf.tokens.includes(String(essay.length)), false)
  })

  it('holds usage until the next running agent, maps empty critic, and seals stopped runs', () => {
    let wf = takeWorkflow(null, { type: 'usage', usage: { total: 1500 } }, { runId: 'u', now: 1 })
    assert.equal(wf.agents.length, 0)
    assert.equal(wf.tokens, '1.5k')
    wf = takeWorkflow(wf, { type: 'tool_call', toolCall: { id: 'e', name: 'explore', arguments: {} }, lane: 'hunt' }, {
      runId: 'u',
      now: 2
    })
    assert.equal(wf.agents[0].tokens, '1.5k')
    assert.equal(wf.pendingUsage, 0)
    let skip = takeWorkflow(null, { type: 'status', text: 'verify · files changed — no critic tools' }, { runId: 'c1', now: 1 })
    assert.equal(skip.criticSkipped, true)
    skip = takeWorkflow(null, { type: 'status', text: 'verify · no tools' }, { runId: 'c2', now: 1 })
    assert.equal(skip.criticSkipped, true)
    assert.match(workflowPhaseLine(skip), /Critic skipped/)
    let stopped = takeWorkflow(null, { type: 'status', text: 'stopped' }, { runId: 's', now: 1 })
    stopped = takeWorkflow(stopped, { type: 'tool_call', toolCall: { id: 'e', name: 'explore', arguments: {} } }, {
      runId: 's',
      now: 2
    })
    assert.equal(stopped.status, 'stopped')
    assert.equal(stopped.agents.length, 0)
    assert.equal(desktopOwnsAgentChunk('abc', 'abc', 'desktop'), true)
    assert.equal(desktopOwnsAgentChunk('abc', 'abc', 'telegram'), false)
    assert.equal(desktopOwnsAgentChunk('abc', 'other', 'desktop'), false)
    assert.equal(desktopOwnsAgentChunk('../x', '../x', 'desktop'), false)
    assert.equal(workflowForgeStep([], { step: 'act' }), 'act')
    assert.equal(workflowForgeStep([{ kind: 'step', step: 'verify' }], { step: 'act' }), 'verify')
    assert.equal(workflowForgeStep([], { step: '<act>' }), '')
  })
})

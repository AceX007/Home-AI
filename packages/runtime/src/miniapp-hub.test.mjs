import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { forgetMiniRun, lastMiniRunId, miniPulse, pushMiniChunk, rememberMiniRun } from './miniapp-hub.mjs'

describe('miniapp hub', () => {
  it('keeps only remembered runs and strips tool arguments', () => {
    forgetMiniRun('mn_hub1')
    assert.equal(miniPulse('mn_hub1'), null)
    pushMiniChunk('mn_hub1', { type: 'text', text: 'ghost' })
    assert.equal(miniPulse('mn_hub1'), null)
    rememberMiniRun('mn_hub1', { title: 'fix auth', mode: 'agent' })
    pushMiniChunk('mn_hub1', { type: 'step', step: 'act' })
    pushMiniChunk('mn_hub1', {
      type: 'tool_call',
      toolCall: { id: 'c1', name: 'read_file', arguments: { path: '/etc/passwd' } },
      lane: 'hunt'
    })
    pushMiniChunk('mn_hub1', { type: 'status', text: 'ok read_file' })
    pushMiniChunk('mn_hub1', { type: 'step', step: 'verify' })
    pushMiniChunk('mn_hub1', { type: 'status', text: 'verify · critic pass (x)' })
    const hunted = miniPulse('mn_hub1')
    assert.match(hunted.phases, /Hunt 1\/1/)
    assert.match(hunted.phases, /Critic 0\/1/)
    assert.equal(hunted.phases.includes('<'), false)
    assert.equal(hunted.autoReviewLine, '')
    pushMiniChunk('mn_hub1', { type: 'status', text: 'auto-review · judge · allow · safe-git' })
    pushMiniChunk('mn_hub1', { type: 'status', text: 'rm -rf /' })
    const reviewed = miniPulse('mn_hub1')
    assert.equal(reviewed.autoReviewLine, 'auto-review · judge · allow · safe-git')
    assert.equal(reviewed.autoReviewLine.includes('rm -rf'), false)
    pushMiniChunk('mn_hub1', {
      type: 'tool_call',
      toolCall: { id: 'c1', name: 'read_file', arguments: { path: '/etc/passwd' } }
    })
    pushMiniChunk('mn_hub1', {
      type: 'question',
      question: { id: 'q', questions: [{ prompt: 'Pick <b>', options: ['ship', '<img>'] }] }
    })
    const ask = miniPulse('mn_hub1')
    assert.equal(ask.ask, true)
    assert.equal(ask.options.includes('<img>'), false)
    pushMiniChunk('mn_hub1', { type: 'approval', approval: { id: 'a1', tool: 'write_file' } })
    const hold = miniPulse('mn_hub1')
    assert.equal(hold.hold, true)
    assert.equal(JSON.stringify(hold).includes('/etc/passwd'), false)
    pushMiniChunk('mn_hub1', { type: 'error', error: 'fail <b> token=sk-abc12345678' })
    const fault = miniPulse('mn_hub1')
    assert.match(fault.error || '', /fail/)
    assert.equal(fault.error.includes('<'), false)
    assert.equal(fault.error.includes('sk-'), false)
    pushMiniChunk('mn_hub1', { type: 'done' })
    const done = miniPulse('mn_hub1')
    assert.equal(done.done, true)
    assert.match(done.card, /HOME/)
    assert.equal(lastMiniRunId(), 'mn_hub1')
    forgetMiniRun('mn_hub1')
    assert.equal(miniPulse('mn_hub1'), null)
    rememberMiniRun('tg_pulse1', { title: 'phone job', mode: 'agent' })
    pushMiniChunk('tg_pulse1', { type: 'step', step: 'act' })
    const phone = miniPulse('tg_pulse1')
    assert.equal(lastMiniRunId(), 'tg_pulse1')
    assert.match(phone.card || phone.phases || '', /./)
    forgetMiniRun('tg_pulse1')
  })
})

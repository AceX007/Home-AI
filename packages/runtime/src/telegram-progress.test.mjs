import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { approvalKeyboard, chatAckKeyboard, progressCard } from './telegram-progress.mjs'

describe('telegram progress card', () => {
  it('shows phase and tool names without arguments or markup', () => {
    const card = progressCard(
      [
        { type: 'step', step: 'act' },
        { type: 'status', text: 'route=local_tools' },
        {
          type: 'tool_call',
          toolCall: { id: 'c1', name: 'str_replace', arguments: { path: '/etc/passwd', token: 'sk-secret' } }
        },
        { type: 'status', text: 'ok str_replace' },
        { type: 'text', text: 'done <img src=x> token=sk-abc12345678' },
        { type: 'done' }
      ],
      { title: 'fix <b>auth', startedAt: 1000, now: 4000 }
    )
    assert.match(card, /LANDED/)
    assert.match(card, /HOME/)
    assert.match(card, /act/)
    assert.match(card, /str_replace/)
    assert.equal(card.includes('/etc/passwd'), false)
    assert.equal(card.includes('sk-'), false)
    assert.equal(card.includes('<'), false)
    const kb = chatAckKeyboard('draft.1')
    assert.equal(kb.inline_keyboard[0][0].callback_data, 'run:draft.1')
    assert.equal(approvalKeyboard('../x').inline_keyboard.length, 0)
  })

  it('faults on error chunks and does not mint tokens from text length', () => {
    const card = progressCard(
      [
        { type: 'step', step: 'verify' },
        { type: 'approval', approval: { tool: 'write_file' } },
        { type: 'error', error: 'fail <b> path=/etc/passwd' },
        { type: 'text', text: 'x'.repeat(2400) },
        { type: 'done' }
      ],
      { title: 'ship', startedAt: 1000, now: 2000 }
    )
    assert.match(card, /FAULT/)
    assert.match(card, /hold/)
    assert.equal(card.includes('<'), false)
    assert.equal(/\d+k?\s*tokens/i.test(card), false)
    assert.equal(String(card).includes(String(2400)), false)
  })
})

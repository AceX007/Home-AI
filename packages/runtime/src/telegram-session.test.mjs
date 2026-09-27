import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { takeTelegramSession } from './telegram-session.mjs'

describe('telegram session DTO', () => {
  it('keeps allowlisted session fields and drops token, hash, and proto', () => {
    const s = takeTelegramSession({
      configured: true,
      online: true,
      token: '1234567890:AAsecretsecretsecret',
      peers: [42, { id: 7 }, { id: -3 }, '../x'],
      pairing: { hash: 'ab'.repeat(32), exp: 99 },
      mode: 'agent',
      mind: 'cursor',
      llama: 'on',
      keys: 'cursor · openai',
      cursor: 'ready',
      live: [{ id: 'tg_1', title: 'fix <b>auth', mode: 'agent' }, { id: '../x' }],
      threads: [{ id: 'chat_home', title: 'Home <script>' }, { id: '../secret' }],
      glass: true,
      admin: true
    })
    assert.equal(s.configured, true)
    assert.equal(s.online, true)
    assert.deepEqual(s.peers, [42, 7])
    assert.equal(s.pairing.exp, 99)
    assert.equal(s.pairing.hash, undefined)
    assert.equal(s.token, undefined)
    assert.equal(s.admin, undefined)
    assert.equal(s.mind, 'cursor')
    assert.equal(s.mode, 'agent')
    assert.equal(s.live[0].id, 'tg_1')
    assert.equal(s.live[0].title.includes('<'), false)
    assert.equal(s.live.some((j) => j.id.includes('..')), false)
    assert.equal(s.threads[0].id, 'chat_home')
    assert.equal(s.threads.some((t) => t.id.includes('..')), false)
    assert.equal(JSON.stringify(s).includes('AAsecret'), false)
    assert.equal(takeTelegramSession({ keys: 'sk-live' }).keys, 'none')
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  consumePair,
  hashPairCode,
  isPeer,
  loadTelegramState,
  normalizePairCode,
  rememberUpdate,
  saveTelegramState,
  startPairing,
  takeTelegramState,
  telegramStatusView
} from './telegram-auth.mjs'

describe('telegram pairing', () => {
  it('hashes pair codes and consumes once', () => {
    assert.equal(normalizePairCode('ab12cd34'), 'AB12CD34')
    assert.equal(normalizePairCode('../x'), null)
    const now = 1_700_000_000_000
    const started = startPairing({ peers: [], pairing: null, offset: 0, seen: [] }, now)
    assert.equal(started.code.length, 8)
    assert.equal(started.state.pairing.hash, hashPairCode(started.code))
    const bad = consumePair(started.state, 'ZZZZZZZZ', 42, now + 1000)
    assert.equal(bad.ok, false)
    assert.equal(isPeer(bad.state, 42), false)
    const ok = consumePair(started.state, started.code, 42, now + 1000)
    assert.equal(ok.ok, true)
    assert.equal(isPeer(ok.state, 42), true)
    const again = consumePair(ok.state, started.code, 99, now + 2000)
    assert.equal(again.ok, false)
    const expired = consumePair(started.state, started.code, 7, now + 11 * 60 * 1000)
    assert.equal(expired.ok, false)
    assert.equal(telegramStatusView(ok.state, true, true).peers[0], 42)
    assert.equal(telegramStatusView(ok.state, true, true).pairing, null)
  })

  it('drops expired pairing and proto keys on load', () => {
    const raw = takeTelegramState({
      peers: [{ id: 1 }, { id: 'no' }, { id: 1 }],
      pairing: { hash: 'aa', exp: Date.now() - 1, code: 'LEAK' },
      offset: -3,
      seen: [1, 1],
      admin: true
    })
    assert.deepEqual(raw.peers.map((p) => p.id), [1])
    assert.equal(raw.pairing, null)
    assert.equal(raw.admin, undefined)
    assert.equal(JSON.stringify(raw).includes('LEAK'), false)
  })

  it('remembers update ids and persists without pair codes', () => {
    const root = mkdtempSync(join(tmpdir(), 'homeai-tg-'))
    try {
      let s = takeTelegramState({})
      const a = rememberUpdate(s, 10)
      assert.equal(a.fresh, true)
      const b = rememberUpdate(a.state, 10)
      assert.equal(b.fresh, false)
      saveTelegramState(root, a.state)
      const disk = JSON.parse(readFileSync(join(root, 'data', 'telegram', 'state.json'), 'utf8'))
      assert.equal(disk.offset, 10)
      assert.equal(loadTelegramState(root).offset, 10)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

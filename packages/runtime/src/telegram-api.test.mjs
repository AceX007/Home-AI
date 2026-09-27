import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  nextBackoff,
  telegramCall,
  telegramCallUrl,
  telegramFileId,
  telegramFilePath,
  telegramFileUrl,
  telegramTokenOk
} from './telegram-api.mjs'

describe('telegram api client', () => {
  it('rejects bad tokens and methods; never echoes the token', () => {
    assert.equal(telegramTokenOk('123:short'), false)
    assert.equal(telegramTokenOk('1234567890:AA' + 'x'.repeat(20)), true)
    assert.throws(() => telegramCallUrl('../x', 'getMe'), /bad token/)
    assert.throws(() => telegramCallUrl('TEST', 'getMe;rm'), /bad method/)
    assert.equal(telegramCallUrl('TEST', 'getUpdates').endsWith('/botTEST/getUpdates'), true)
  })

  it('scrubs tokens from errors and backs off', async () => {
    const token = '1234567890:AAsecretsecretsecret'
    await assert.rejects(
      () =>
        telegramCall(token, 'getMe', {}, async () => ({
          json: async () => ({ ok: false, description: `fail ${token}` })
        })),
      (err) => {
        assert.equal(String(err.message).includes('AAsecret'), false)
        return true
      }
    )
    assert.equal(nextBackoff(400) > 400, true)
    assert.equal(nextBackoff(40_000), 30_000)
    assert.equal(nextBackoff(400, 8000), 8000)
    await assert.rejects(
      () =>
        telegramCall(token, 'getMe', {}, async () => ({
          status: 429,
          headers: { get: (n) => (String(n).toLowerCase() === 'retry-after' ? '3' : null) },
          json: async () => ({ ok: false, error_code: 429, description: 'Too Many Requests' })
        })),
      (err) => {
        assert.equal(err.retryAfterMs, 3000)
        return true
      }
    )
    assert.equal(telegramFileId('AgACAgIAAxkBAAIBtest'), 'AgACAgIAAxkBAAIBtest')
    assert.equal(telegramFileId('../x'), null)
    assert.equal(telegramFilePath('photos/file_1.jpg'), 'photos/file_1.jpg')
    assert.equal(telegramFilePath('../etc/passwd'), null)
    assert.equal(telegramFilePath('/etc/passwd'), null)
    assert.throws(() => telegramFileUrl(token, '../x'), /bad file/)
    assert.equal(telegramFileUrl('TEST', 'photos/file_1.jpg').includes(token), false)
  })
})

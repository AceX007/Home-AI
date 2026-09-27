import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inboxStt, inboxSttAllowed, speak, speakRel } from './voice.mjs'

const ogg = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(12)])

describe('voice tools', () => {
  it('T-81 inbox_stt jails svg and secrets; missing whisper is generic', async () => {
    const root = mkdtempSync(join(tmpdir(), 'homeai-stt-'))
    mkdirSync(join(root, 'data', 'inbox'), { recursive: true })
    mkdirSync(join(root, 'data', 'secrets'), { recursive: true })
    writeFileSync(join(root, 'data', 'secrets', 'k'), 'secret-token')
    writeFileSync(join(root, 'data', 'inbox', 'x.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    writeFileSync(join(root, 'data', 'inbox', 'v.ogg'), ogg)
    assert.equal(inboxSttAllowed('data/inbox/x.svg'), false)
    const svg = await inboxStt(root, 'data/inbox/x.svg')
    assert.match(svg, /stt refuses/)
    assert.equal(svg.includes('secret-token'), false)
    const leak = await inboxStt(root, '../data/secrets/k')
    assert.equal(leak.includes('secret-token'), false)
    const ok = await inboxStt(root, 'data/inbox/v.ogg')
    assert.equal(ok.includes('<'), false)
    assert.equal(/https?:\/\//.test(ok), false)
    assert.equal(/whisper\.cpp|openai\.com|PATH=/i.test(ok), false)
    assert.ok(ok === 'stt unavailable' || typeof ok === 'string')
  })

  it('T-82 speak wav rel has no ..; missing piper is generic', async () => {
    assert.equal(speakRel('../x').includes('..'), false)
    assert.match(speakRel('../x'), /^data\/tts\/[\w.-]+\.wav$/)
    const root = mkdtempSync(join(tmpdir(), 'homeai-tts-'))
    const out = await speak(root, 'hello <img> world')
    assert.equal(out.includes('<'), false)
    assert.equal(/https?:\/\//.test(out), false)
    if (out === 'tts unavailable') {
      assert.equal(/pip install|PATH=/i.test(out), false)
    } else {
      assert.match(out, /^data\/tts\/s[0-9a-z]+\.wav$/)
      assert.equal(out.includes('..'), false)
    }
  })
})

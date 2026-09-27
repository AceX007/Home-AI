import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inboxName, saveInboxSafe, takeInboxFile } from './inbox.mjs'

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

describe('inbox jail', () => {
  it('allows a png magic and rejects svg, html, traversal, and php', () => {
    const root = mkdtempSync(join(tmpdir(), 'homeai-in-'))
    try {
      const ok = saveInboxSafe(root, 'shot.png', png.toString('base64'))
      assert.match(ok.rel, /^data\/inbox\/\d+-shot\.png$/)
      assert.equal(inboxName('../x.png'), null)
      assert.equal(inboxName('shell.php'), null)
      assert.equal(inboxName('note.svg'), null)
      assert.equal(takeInboxFile('x.png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">').toString('base64')), null)
      assert.equal(takeInboxFile('note.md', Buffer.from('<script>alert(1)</script>').toString('base64')), null)
      assert.equal(saveInboxSafe(root, 'x.svg', png.toString('base64')), null)
      const ogg = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(8)])
      const oggOk = saveInboxSafe(root, 'voice.ogg', ogg.toString('base64'))
      assert.match(oggOk.rel, /^data\/inbox\/\d+-voice\.ogg$/)
      assert.equal(inboxName('voice.php'), null)
      assert.equal(takeInboxFile('voice.php', ogg.toString('base64')), null)
      assert.equal(takeInboxFile('voice.ogg', png.toString('base64')), null)
      assert.equal(takeInboxFile('clip.wav', ogg.toString('base64')), null)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { notesRel, calendarRel, writeNoteFile, listNotes, upsertCalendar, takeVevent, inboxOnly } from './life-files.mjs'
import { extractHtml, looksLikeHtml } from './web-extract.mjs'
import { inboxOcrAllowed } from './ocr.mjs'

describe('life files', () => {
  it('jails note and calendar names', () => {
    assert.equal(notesRel('../secret'), null)
    assert.equal(notesRel('hello.md'), 'notes/hello.md')
    assert.equal(calendarRel('work.ics'), 'data/calendar/work.ics')
    assert.equal(takeVevent({ summary: 'Meet\n<script>', dtstart: '20260901T090000Z' }).summary.includes('<'), false)
    const html = extractHtml('<html><title>Hi</title><script>x</script><p>Body &amp; more</p></html>', 'https://ex.test')
    assert.match(html, /title Hi/)
    assert.equal(html.includes('<script>'), false)
    const decoded = extractHtml('<html><p>&lt;script&gt;x&lt;/script&gt;</p></html>', '')
    assert.equal(decoded.includes('<script>'), false)
    assert.equal(looksLikeHtml('<html><p>x</p>', ''), true)
    assert.equal(looksLikeHtml('{"ok":true}', 'application/json'), false)
    assert.equal(inboxOcrAllowed('data/inbox/shot.png'), true)
    assert.equal(inboxOcrAllowed('data/inbox/x.svg'), false)
    assert.equal(inboxOcrAllowed('data/inbox/page.html'), false)
  })

  it('writes notes and calendar under jail', () => {
    const root = mkdtempSync(join(tmpdir(), 'homeai-life-'))
    const rel = writeNoteFile(root, 'alpha', '# hi <script>')
    assert.equal(rel, 'notes/alpha.md')
    assert.equal(listNotes(root)[0].title, 'alpha')
    assert.equal(listNotes(root)[0].preview.includes('<'), false)
    const ics = upsertCalendar(root, 'standup', { summary: 'Standup', dtstart: '20260901T090000Z' })
    assert.equal(ics, 'data/calendar/standup.ics')
    assert.throws(() => inboxOnly(root, 'notes/alpha.md'), /inbox only/)
  })
})

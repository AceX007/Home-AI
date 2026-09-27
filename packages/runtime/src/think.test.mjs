import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { bumpThinkStatus, parseThinkFront, redactCloudText, thinkRel, thinkRelFromOpen, validateThinkMarkdown, shouldCloseThink, chunkIsForgeError } from './think.mjs'

const ok = `---
title: Density slider persist
status: ready
files: apps/renderer/src/panes/DesignPane.tsx, packages/runtime/src/designir.mjs
anti_patterns: AP-20260828-6
implement_provider: auto
---

## Goal
Persist density on mouseup.

## Map
DesignPane liveScale. applyDesignPatch.

## Edges
Stale revision if patching every tick.

## Edits
Commit scale on mouseup only.

## Verify
npm test

## Out of scope
Cassowary solver.
`

describe('think artifacts', () => {
  it('jails names to RAG/plans/*.think.md', () => {
    assert.equal(thinkRel('Density Slider'), 'RAG/plans/density-slider.think.md')
    assert.equal(thinkRel('../secrets'), 'RAG/plans/secrets.think.md')
    assert.equal(thinkRel('RAG/plans/foo.think.md'), 'RAG/plans/rag-plans-foo.think.md')
  })

  it('requires status, files, and section headings; rejects HTML', () => {
    const v = validateThinkMarkdown(ok)
    assert.equal(v.ok, true)
    assert.equal(v.status, 'ready')
    assert.equal(v.files[0].startsWith('apps/'), true)
    assert.equal(validateThinkMarkdown(ok.replace('## Verify', '## Tests')).ok, false)
    const html = ok.replace('mouseup.', 'mouseup <img src=x>.')
    assert.equal(validateThinkMarkdown(html).ok, false)
    assert.equal(validateThinkMarkdown(ok.replace('status: ready', 'status: nope')).ok, false)
  })

  it('redacts key-shaped strings before cloud implement', () => {
    const out = redactCloudText('Authorization: Bearer sk-abc12345678 token=ghp_secret')
    assert.equal(out.includes('sk-abc'), false)
    assert.equal(out.includes('[redacted]'), true)
    assert.equal(parseThinkFront(ok).files.length, 2)
  })

  it('bumps ready → implementing in frontmatter only; jails open paths', () => {
    const bumped = bumpThinkStatus(ok, 'implementing')
    assert.equal(bumped.changed, true)
    assert.equal(bumped.status, 'implementing')
    assert.equal(parseThinkFront(bumped.markdown).status, 'implementing')
    assert.match(bumped.markdown, /## Goal/)
    assert.equal(bumpThinkStatus(bumped.markdown, 'implementing').changed, false)
    assert.throws(() => bumpThinkStatus(ok.replace('status: ready', 'status: think'), 'implementing'), /need ready/)
    assert.equal(thinkRelFromOpen('/home/x/Home AI/RAG/plans/density-slider.think.md'), 'RAG/plans/density-slider.think.md')
    assert.equal(thinkRelFromOpen('RAG/plans/../secrets.think.md'), '')
    assert.equal(thinkRelFromOpen('RAG/plans/foo.md'), '')
    const done = bumpThinkStatus(bumped.markdown, 'done')
    assert.equal(done.status, 'done')
    assert.equal(parseThinkFront(done.markdown).status, 'done')
    assert.throws(() => bumpThinkStatus(ok.replace('status: ready', 'status: think'), 'done'), /need implementing/)
    assert.equal(shouldCloseThink(false), true)
    assert.equal(shouldCloseThink(true), false)
    assert.equal(shouldCloseThink(undefined), false)
    assert.equal(chunkIsForgeError({ type: 'error', error: 'fail' }), true)
    assert.equal(chunkIsForgeError({ type: 'text', text: 'ok' }), false)
    assert.equal(chunkIsForgeError({ type: 'done' }), false)
  })
})

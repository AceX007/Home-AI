import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseSkillFrontMatter } from './front-matter.mjs'

describe('skill front matter', () => {
  it('T-91 folds >- scalars and strips markup / proto keys', () => {
    const md = `---
name: demo
description: >-
  hello world
  second line
__proto__: admin
---
body here
`
    const { meta, body } = parseSkillFrontMatter(md)
    assert.equal(meta.description, 'hello world second line')
    assert.equal(meta.name, 'demo')
    assert.equal(meta.__proto__, undefined)
    assert.equal(body.startsWith('body'), true)
    const dirty = parseSkillFrontMatter('---\ndescription: >-\n  hi <img>\n---\nx')
    assert.equal(dirty.meta.description.includes('<'), false)
    const pipe = parseSkillFrontMatter('---\ndescription: |\n  a\n  b\n---\n')
    assert.equal(pipe.meta.description, 'a\nb')
  })
})

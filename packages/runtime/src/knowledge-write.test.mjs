import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  deleteRule,
  deleteSkill,
  knowledgeSlug,
  listWritableSkills,
  ruleRel,
  skillRel,
  writeRule,
  writeSkill
} from './knowledge-write.mjs'
import { ragWriteRel } from './search-proof.mjs'

describe('knowledge write jail', () => {
  it('jails slugs to RAG/skills and RAG/rules', () => {
    assert.equal(skillRel('../secrets'), 'RAG/skills/secrets/SKILL.md')
    assert.equal(ruleRel('My Rule'), 'RAG/rules/my-rule.md')
    assert.equal(knowledgeSlug('README'), 'note')
  })

  it('ragWriteRel allows human plans and never think docs', () => {
    assert.equal(ragWriteRel('plans', 'auth-fix'), 'RAG/plans/auth-fix.md')
    assert.equal(ragWriteRel('plans', 'auth-fix.think.md'), 'RAG/plans/auth-fix.md')
    assert.equal(ragWriteRel('plans', '../secrets'), null)
    assert.equal(ragWriteRel('secrets', 'x.md'), null)
    assert.equal(ragWriteRel('thoughts', 'note'), 'RAG/thoughts/note.md')
    assert.equal(ragWriteRel('notes', 'idea.md'), 'notes/idea.md')
  })

  it('writes and deletes only under the RAG trees; rejects HTML', () => {
    const root = mkdtempSync(join(tmpdir(), 'homeai-k-'))
    try {
      const sk = writeSkill(root, { name: 'Ship Fast', description: 'when shipping', body: 'Use the kernel loop.' })
      assert.equal(sk.rel, 'RAG/skills/ship-fast/SKILL.md')
      assert.equal(existsSync(join(root, sk.rel)), true)
      assert.equal(listWritableSkills(root)[0].slug, 'ship-fast')
      assert.throws(() => writeSkill(root, { name: 'x', body: 'hi <img>' }), /html/)
      deleteSkill(root, 'ship-fast')
      assert.equal(existsSync(join(root, sk.rel)), false)
      const ru = writeRule(root, { name: 'Be brief', body: 'Short answers.' })
      assert.equal(ru.rel, 'RAG/rules/be-brief.md')
      deleteRule(root, 'be-brief')
      assert.equal(existsSync(join(root, ru.rel)), false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('refuses README and extra-root deletes', () => {
    const root = mkdtempSync(join(tmpdir(), 'homeai-k2-'))
    try {
      mkdirSync(join(root, 'RAG', 'rules'), { recursive: true })
      writeFileSync(join(root, 'RAG', 'rules', 'README.md'), 'no', 'utf8')
      assert.throws(() => deleteRule(root, 'README'), /note|missing|readme/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

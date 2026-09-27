import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { chromeRoute, lastForgeError, thinkPick, forgeIsFault, takeGoTab, publicSkillPeek, publicStackPeek } from './activity.mjs'

describe('stage chrome lock', () => {
  it('T-46 chromeRoute is design|cowork|code; layoutMode strings are not cowork', () => {
    assert.equal(chromeRoute('design', 'focus'), 'design')
    assert.equal(chromeRoute('files', true), 'cowork')
    assert.equal(chromeRoute('files', false), 'code')
    assert.equal(chromeRoute('files', 'stage'), 'code')
    assert.equal(chromeRoute('files', 'focus'), 'code')
    assert.equal(chromeRoute('files', 'dock'), 'code')
    assert.equal(chromeRoute('files', 'cowork'), 'code')
    const routes = ['design', 'cowork', 'code']
    for (const mode of ['dock', 'stage', 'focus', true, false, 'cowork']) {
      assert.equal(routes.includes(chromeRoute('files', mode)), true)
      assert.notEqual(chromeRoute('files', mode), 'stage')
      assert.notEqual(chromeRoute('files', mode), 'focus')
      assert.notEqual(chromeRoute('files', mode), 'chat')
    }
    assert.equal(chromeRoute('files', true), 'cowork')
  })

  it('thinkPick only ready|implementing jailed think docs; lastForgeError is text', () => {
    assert.equal(thinkPick([{ path: 'RAG/plans/x.think.md', status: 'draft', title: 'no' }]), null)
    assert.equal(thinkPick([{ path: '../secrets.think.md', status: 'ready', title: 'x' }]), null)
    const pick = thinkPick([
      { path: 'RAG/plans/done.think.md', status: 'done', title: 'old' },
      { path: 'RAG/plans/go.think.md', status: 'ready', title: '<b>Go</b>', files: ['apps/x.ts', '../etc'] }
    ])
    assert.equal(pick.path, 'RAG/plans/go.think.md')
    assert.equal(pick.title.includes('<'), false)
    assert.deepEqual(pick.files, ['apps/x.ts'])
    assert.equal(lastForgeError([{ kind: 'error', text: 'fail <img>' }]).includes('<'), false)
    assert.equal(forgeIsFault([{ kind: 'error', text: 'x' }, { kind: 'assistant', text: 'ok' }]), false)
    assert.equal(forgeIsFault([{ kind: 'assistant', text: 'ok' }, { kind: 'error', text: 'x' }]), true)
    assert.equal(lastForgeError([{ kind: 'error', text: 'boom <b>' }]), 'boom b')
  })

  it('Go strip peeks jail skill slashes and tool names', () => {
    assert.equal(takeGoTab('skills'), 'skills')
    assert.equal(takeGoTab('cowork'), null)
    assert.equal(takeGoTab('../mode'), null)
    const skills = publicSkillPeek([
      { slash: '/xss<script>', name: '<b>Boom</b>', description: 'steal <img>' },
      { slash: '../../etc', name: 'nope' },
      { name: 'hunt-xss' }
    ])
    assert.equal(skills[0].slash, 'xssscript')
    assert.equal(skills[0].name.includes('<'), false)
    assert.equal(skills[0].hint.includes('<'), false)
    assert.equal(skills.some((s) => s.slash.includes('..')), false)
    assert.equal(skills.some((s) => s.slash === 'hunt-xss'), true)
    const stack = publicStackPeek(['explore', { name: 'rm -rf' }, { name: 'terminal_run' }, '<img>'])
    assert.deepEqual(stack.map((r) => r.name), ['explore', 'terminal_run'])
  })
})

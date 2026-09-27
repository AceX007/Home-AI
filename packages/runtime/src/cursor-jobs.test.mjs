import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { cursorAgentId, cursorGetUrl, cursorJobList, cursorJobSummary } from './cursor-jobs.mjs'

describe('cursor job summaries', () => {
  it('drops ids that would change the agents URL', () => {
    assert.equal(cursorAgentId('abc-123'), 'abc-123')
    assert.equal(cursorAgentId('../secret'), null)
    assert.equal(cursorAgentId('x/../y'), null)
    assert.equal(cursorAgentId('a?b=1'), null)
    assert.throws(() => cursorGetUrl('../x'), /bad agent id/)
    assert.equal(cursorGetUrl('job.1'), 'https://api.cursor.com/v1/agents/job.1')
  })

  it('keeps status fields and strips markup from names', () => {
    const job = cursorJobSummary({
      id: 'ag1',
      status: 'RUNNING',
      name: '<img src=x>cloud',
      summary: 'ok',
      apiKey: 'sk-secret'
    })
    assert.equal(job.id, 'ag1')
    assert.equal(job.status, 'RUNNING')
    assert.equal(job.name.includes('<'), false)
    assert.equal(job.apiKey, undefined)
    assert.deepEqual(
      cursorJobList({ agents: [{ id: 'a.1', status: 'FINISHED', title: 'done' }, { id: '../nope' }] }).map((j) => j.id),
      ['a.1']
    )
  })
})

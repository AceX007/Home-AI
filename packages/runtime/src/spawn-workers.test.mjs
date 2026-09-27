import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseWorkerJobs } from './spawn-workers.mjs'

describe('spawn workers', () => {
  it('caps at four named read-only jobs', () => {
    const jobs = parseWorkerJobs([
      { name: 'chrome', kind: 'explore', query: 'layout' },
      { name: 'browse', kind: 'grep', query: 'route' },
      { name: 'buy', kind: 'outline', path: 'apps/renderer/src/panes/ChatPane.tsx' },
      { name: 'account', kind: 'read', path: 'AGENTS.md' }
    ])
    assert.equal(jobs.length, 4)
    assert.equal(jobs[0].name, 'chrome')
  })

  it('rejects extra workers, path escape, and bad names', () => {
    assert.throws(
      () =>
        parseWorkerJobs([
          { name: 'a', query: 'x' },
          { name: 'b', query: 'x' },
          { name: 'c', query: 'x' },
          { name: 'd', query: 'x' },
          { name: 'e', query: 'x' }
        ]),
      /max 4/
    )
    assert.throws(() => parseWorkerJobs([{ name: 'x', path: '../etc/passwd', kind: 'read' }]), /escapes/)
    assert.throws(() => parseWorkerJobs([{ name: 'spawn;rm', query: 'x' }]), /name/)
  })
})

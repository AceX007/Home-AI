import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseTaskCall, digestSubagent, normalizeSubagentKind, runSubagentJobs, nestedExploreForgeFlags, toolsForSubagent } from './subagent.mjs'
import { parseWorkerJobs } from './spawn-workers.mjs'

describe('subagents', () => {
  it('parses task call and caps workers', () => {
    const jobs = parseTaskCall({ subagent_type: 'explore', query: 'auth' })
    assert.equal(jobs[0].kind, 'explore')
    assert.equal(normalizeSubagentKind('grep'), 'explore')
    assert.throws(() => parseTaskCall({ subagent_type: 'bash', query: 'ls' }, { think: true }), /explore-only/)
    const many = parseWorkerJobs([
      { name: 'a', kind: 'bash', query: 'true' },
      { name: 'b', kind: 'browser', query: 'https://127.0.0.1/' },
      { name: 'c', kind: 'research', query: 'home ai' },
      { name: 'd', kind: 'explore', query: 'x' }
    ])
    assert.equal(many.length, 4)
  })

  it('digest keeps last bash lines and runSubagentJobs calls child tools', async () => {
    const long = { ok: true, name: 'terminal_run', content: Array.from({ length: 100 }, (_, i) => `L${i}`).join('\n') }
    const d = digestSubagent('bash', [long])
    assert.equal(d.includes('L0'), false)
    assert.equal(d.includes('L99'), true)
    const calls = []
    const text = await runSubagentJobs([{ name: 'ex', kind: 'explore', query: 'foo', path: '' }], async (c) => {
      calls.push(c.name)
      return { ok: true, name: c.name, content: 'hit AGENTS.md' }
    })
    assert.deepEqual(calls, ['explore'])
    assert.match(text, /ex/)
    assert.match(text, /hit AGENTS.md/)
    assert.match(text, /Explore finished/)
    const htmlD = digestSubagent('research', [
      { ok: true, name: 'http_fetch', content: '<html><title>Hi</title><script>alert(1)</script><p>Body</p></html>' }
    ])
    assert.equal(htmlD.includes('<script>'), false)
    assert.match(htmlD, /Body/)
    const researchCalls = []
    await runSubagentJobs([{ name: 'r', kind: 'research', query: 'https://example.com/x', path: '' }], async (c) => {
      researchCalls.push(c.name)
      return { ok: true, name: c.name, content: 't' }
    })
    assert.deepEqual(researchCalls, ['web_extract'])
  })

  it('nested forge hook is skipped when no callback; think never nested-LLMs', async () => {
    const flags = nestedExploreForgeFlags()
    assert.equal(flags.skipVerify, true)
    assert.equal(flags.skipRemember, true)
    assert.equal(flags.maxTurns, 2)
    const exploreTools = toolsForSubagent('explore', [
      { name: 'explore', description: 'e', permissions: ['read'], parameters: {} },
      { name: 'terminal_run', description: 'x', permissions: ['exec'], parameters: {} },
      { name: 'task', description: 't', permissions: ['read'], parameters: {} }
    ])
    assert.deepEqual(
      exploreTools.map((t) => t.name),
      ['explore']
    )

    const det = []
    await runSubagentJobs([{ name: 'ex', kind: 'explore', query: 'foo', path: '' }], async (c) => {
      det.push(c.name)
      return { ok: true, name: c.name, content: 'det' }
    })
    assert.deepEqual(det, ['explore'])

    let nested = 0
    const child = []
    const forged = await runSubagentJobs(
      [{ name: 'ex', kind: 'explore', query: 'auth', path: '' }],
      async (c) => {
        child.push(c.name)
        return { ok: true, name: c.name, content: 'should-not' }
      },
      {
        nestedForge: async () => {
          nested += 1
          return { ok: true, name: 'explore', content: 'forged digest' }
        }
      }
    )
    assert.equal(nested, 1)
    assert.deepEqual(child, [])
    assert.match(forged, /forged digest/)

    nested = 0
    const thinkChild = []
    await runSubagentJobs(
      [{ name: 'ex', kind: 'explore', query: 'x', path: '' }],
      async (c) => {
        thinkChild.push(c.name)
        return { ok: true, name: c.name, content: 'det' }
      },
      {
        think: true,
        nestedForge: async () => {
          nested += 1
          return { ok: true, name: 'explore', content: 'nope' }
        }
      }
    )
    assert.equal(nested, 0)
    assert.deepEqual(thinkChild, ['explore'])

    nested = 0
    const bashChild = []
    await runSubagentJobs(
      [{ name: 'b', kind: 'bash', query: 'true', path: '' }],
      async (c) => {
        bashChild.push(c.name)
        return { ok: true, name: c.name, content: 'ok' }
      },
      {
        nestedForge: async () => {
          nested += 1
          return { ok: true, name: 'explore', content: 'nope' }
        }
      }
    )
    assert.equal(nested, 0)
    assert.deepEqual(bashChild, ['terminal_run'])
  })
})

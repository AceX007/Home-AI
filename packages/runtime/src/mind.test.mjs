import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { healthPulse, pickForgeProvider, publicMindError, takeKernelHealth, takeMind, designMind, taskNeedsDesignTools, forgeForDesign, forgeFallbackNote, forgeTurnCap, forgeActHint } from './mind.mjs'

describe('mind picker', () => {
  it('allowlists minds and never keeps a raw provider string', () => {
    assert.equal(takeMind('local'), 'local')
    assert.equal(takeMind('Offline'), 'local')
    assert.equal(takeMind('2B'), 'local')
    assert.equal(takeMind('cloud'), 'openrouter')
    assert.equal(takeMind('cursor'), 'cursor')
    assert.equal(takeMind('root'), null)
    assert.equal(takeMind('../x'), null)
    assert.equal(takeMind({ toString: () => 'cursor' }), null)
  })

  it('picks forge: think and implement stay off Cursor; missing keys fall back', () => {
    assert.equal(pickForgeProvider({ mind: 'cursor', mode: 'think', keys: { cursor: true } }), 'local')
    assert.equal(
      pickForgeProvider({ mind: 'cursor', thinkPath: true, keys: { cursor: true, openai: true } }),
      'openai'
    )
    assert.equal(pickForgeProvider({ mind: 'cursor', keys: { cursor: true } }), 'cursor')
    assert.equal(pickForgeProvider({ mind: 'cursor', keys: {} }), 'local')
    assert.equal(pickForgeProvider({ mind: 'openai', keys: { openrouter: true } }), 'openrouter')
    assert.equal(pickForgeProvider({ mind: 'evil', keys: { cursor: true } }), 'local')
    assert.equal(pickForgeProvider({ mind: 'local', localOk: false, keys: { openrouter: true } }), 'openrouter')
    assert.equal(pickForgeProvider({ mind: 'local', verifyOk: false, hasSidecar: true, keys: {} }), 'local')
    assert.equal(
      pickForgeProvider({ mind: 'cursor', mode: 'think', localOk: false, keys: { openrouter: true, cursor: true } }),
      'local'
    )
  })

  it('T-47 remints Design off Cursor Cloud Agents and never leaks keys', () => {
    assert.equal(designMind('cursor'), 'local')
    assert.equal(designMind('openai'), 'openai')
    assert.equal(designMind('OpenRouter'), 'openrouter')
    assert.equal(taskNeedsDesignTools('Call design_get then design_patch'), true)
    assert.equal(taskNeedsDesignTools('fix auth', true), true)
    assert.equal(taskNeedsDesignTools('fix auth'), false)
    assert.equal(forgeForDesign('cursor', { cursor: true, openai: true }), 'openai')
    assert.equal(forgeForDesign('cursor', { cursor: true, openrouter: true }), 'openrouter')
    assert.equal(forgeForDesign('cursor', { cursor: true }), 'local')
    assert.equal(forgeForDesign('openai', { openai: true, cursor: true }), 'openai')
    assert.equal(forgeForDesign('local', { cursor: true }), 'local')
    const note = forgeFallbackNote('openai', {})
    assert.match(note, /OpenAI key missing/)
    assert.equal(note.includes('sk-'), false)
    assert.equal(forgeFallbackNote('openai', { openai: true }), '')
    assert.equal(forgeTurnCap(true), 20)
    assert.equal(forgeTurnCap(false), 12)
    assert.match(forgeActHint('agent', 'Call design_get then design_patch'), /design_get/)
    assert.doesNotMatch(forgeActHint('agent', 'Call design_get then design_patch'), /Start by gathering/)
    assert.match(forgeActHint('agent', 'fix auth', false), /explore/)
    assert.match(forgeActHint('agent', 'fix auth', true), /design_get/)
    const picked = pickForgeProvider({ mind: 'cursor', keys: { cursor: true } })
    assert.equal(picked, 'cursor')
    assert.notEqual(forgeForDesign(picked, { cursor: true, openai: true }), 'cursor')
  })

  it('health DTO drops secrets and unknown keys; errors never leak paths or keys', () => {
    const h = takeKernelHealth({
      llama: 'on',
      openai: true,
      cursor: true,
      apiKey: 'sk-secret',
      cursorJobs: [{ id: 'bc-1', status: 'RUNNING', name: 'ship <b>', summary: 'ok' }, { id: '../x' }]
    })
    assert.equal(h.llama, 'on')
    assert.equal(h.openai, true)
    assert.equal(h.cursor, true)
    assert.equal(h.apiKey, undefined)
    assert.equal(h.cursorJobs[0].id, 'bc-1')
    assert.equal(h.cursorJobs.some((j) => j.id.includes('..')), false)
    const pulse = healthPulse(h)
    assert.equal(pulse.llama, 'on')
    assert.match(pulse.keys, /openai/)
    assert.equal(pulse.keys.includes('sk-'), false)
    assert.equal(publicMindError(new Error('Model missing: /home/x/secret.gguf')).includes('/home'), false)
    assert.equal(publicMindError(new Error('Cursor agents 401: {"error":"sk-live"}')).includes('sk-'), false)
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { shouldAttachExistingListener, ownedLlamaPort, pickInfillPort } from './sidecar-own.mjs'

describe('T-72 sidecar owns its child', () => {
  it('does not attach a sidecar to a foreign listener', () => {
    assert.equal(shouldAttachExistingListener({ sidecar: true, portOpen: true }), false)
    assert.equal(shouldAttachExistingListener({ sidecar: true, portOpen: false }), false)
    assert.equal(shouldAttachExistingListener({ sidecar: false, portOpen: true }), true)
    assert.equal(shouldAttachExistingListener({ sidecar: false, portOpen: false }), false)
    assert.equal(shouldAttachExistingListener({}), false)
  })

  it('infill and nested forge only use an owned running port', () => {
    assert.equal(ownedLlamaPort({ running: true, port: 8766 }), 8766)
    assert.equal(ownedLlamaPort({ running: false, port: 8766 }), null)
    assert.equal(ownedLlamaPort({ running: true }), null)
    assert.equal(ownedLlamaPort({ running: true, port: 0 }), null)
    assert.equal(ownedLlamaPort(null), null)
    assert.equal(pickInfillPort({ running: true, port: 8766 }, { running: true, port: 8765 }), 8766)
    assert.equal(pickInfillPort({ running: false, port: 8766 }, { running: true, port: 8765 }), 8765)
    assert.equal(pickInfillPort({ running: true }, { running: true, port: 8765 }), 8765)
    assert.equal(pickInfillPort(null, null, 8765), 8765)
  })
})

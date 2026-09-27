import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyDesignPatch, defaultDesignIR, densityPatch, validateDesignIR, publicDesignEnvelope } from './designir.mjs'

describe('DesignIR patches', () => {
  it('accepts the default document', () => {
    assert.equal(validateDesignIR(defaultDesignIR()).ok, true)
  })

  it('applies a density token replace and bumps revision', () => {
    const base = defaultDesignIR()
    const { doc } = applyDesignPatch(base, { ...densityPatch(1.4), baseRevision: base.revision })
    assert.equal(doc.tokens.spaceScale, 1.4)
    assert.equal(doc.revision, 'rev_2')
    assert.equal(base.tokens.spaceScale, 1)
  })

  it('rejects prototype paths and html in text', () => {
    const base = defaultDesignIR()
    assert.throws(
      () => applyDesignPatch(base, { patch: [{ op: 'add', path: '/tokens/__proto__', value: { x: 1 } }] }),
      /escapes|outside/
    )
    assert.throws(
      () =>
        applyDesignPatch(base, {
          patch: [{ op: 'replace', path: '/nodes/hero.title/text', value: '<img src=x>' }]
        }),
      /html/
    )
    assert.throws(
      () =>
        applyDesignPatch(base, {
          patch: [{ op: 'replace', path: '/tokens/colorBg', value: 'url(https://evil.example)' }]
        }),
      /color|invalid/
    )
  })

  it('inits pages when a page op lands on a doc without pages', () => {
    const base = defaultDesignIR()
    const { doc } = applyDesignPatch(base, {
      patch: [{ op: 'add', path: '/pages/0', value: { id: 'p1', name: 'Screen 1' } }]
    })
    assert.equal(doc.pages.length, 1)
    assert.equal(doc.pages[0].id, 'p1')
  })

  it('adds nodes and replaces pages; rejects HTML in page names', () => {
    const base = defaultDesignIR()
    const { doc } = applyDesignPatch(base, {
      patch: [
        { op: 'add', path: '/pages/0', value: { id: 'p1', name: 'Screen 1' } },
        {
          op: 'add',
          path: '/nodes/p1.title',
          value: { type: 'text', tag: 'h1', page: 'p1', text: 'Hello', order: 1 }
        }
      ]
    })
    assert.equal(doc.pages[0].id, 'p1')
    assert.equal(doc.nodes['p1.title'].text, 'Hello')
    const { doc: grown } = applyDesignPatch(doc, {
      baseRevision: doc.revision,
      patch: [
        {
          op: 'replace',
          path: '/pages',
          value: [
            { id: 'p1', name: 'Screen 1' },
            { id: 'p2', name: 'Screen 2' }
          ]
        }
      ]
    })
    assert.equal(grown.pages.length, 2)
    const { doc: plus } = applyDesignPatch(grown, {
      baseRevision: grown.revision,
      patch: [{ op: 'add', path: '/pages/-', value: { id: 'p3', name: 'Three' } }]
    })
    assert.equal(plus.pages.length, 3)
    assert.equal(plus.pages[2].id, 'p3')
    assert.throws(
      () =>
        applyDesignPatch(grown, {
          baseRevision: grown.revision,
          patch: [{ op: 'replace', path: '/pages/0', value: { id: 'p1', name: '<b>x</b>' } }]
        }),
      /html|page.name/
    )
  })

  it('rejects stale revision and locked content', () => {
    const base = defaultDesignIR()
    assert.throws(() => applyDesignPatch(base, { baseRevision: 'rev_99', patch: densityPatch(1).patch }), /stale/)
    base.nodes['hero.title'].locks = { content: true }
    assert.throws(
      () => applyDesignPatch(base, { patch: [{ op: 'replace', path: '/nodes/hero.title/text', value: 'nope' }] }),
      /lock/
    )
  })

  it('drops unknown patch ops and still applies RFC replace', () => {
    const base = defaultDesignIR()
    const { doc } = applyDesignPatch(base, {
      patch: [...densityPatch(1.4).patch, { op: 'baseRevision', value: 'rev_1' }]
    })
    assert.equal(doc.tokens.spaceScale, 1.4)
    assert.equal(doc.revision, 'rev_2')
  })

  it('publicDesignEnvelope drops _raw and ops so IPC cannot use the 2B recover path', () => {
    const pub = publicDesignEnvelope({
      baseRevision: 'rev_1',
      _raw: '{"patch":[{"id":"p3","page":"p3","text":"x","order":0}]}',
      ops: [{ op: 'add', path: '/pages/-', value: { id: 'p9', name: 'Nope' } }],
      patch: [{ op: 'replace', path: '/tokens/spaceScale', value: 1.2 }]
    })
    assert.equal(Object.prototype.hasOwnProperty.call(pub, '_raw'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(pub, 'ops'), false)
    assert.equal(pub.baseRevision, 'rev_1')
    const base = defaultDesignIR()
    const { doc } = applyDesignPatch(base, pub)
    assert.equal(doc.tokens.spaceScale, 1.2)
    assert.throws(
      () =>
        applyDesignPatch(base, publicDesignEnvelope({ _raw: '{"patch":[{"id":"p3","page":"p3","text":"x","order":0}]}' })),
      /empty patch/
    )
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateDesignIR } from './designir.mjs'
import {
  designSlug,
  designRel,
  slugFromBrief,
  seedDesignIR,
  irGrew,
  profileFromTemplate,
  isShopSample,
  safeExportStem,
  DEFAULT_DESIGN_SLUG
} from './design-path.mjs'

describe('design path slug jail', () => {
  it('maps slug to designs/<slug>.design.json and rejects traversal', () => {
    assert.equal(designSlug(undefined), DEFAULT_DESIGN_SLUG)
    assert.equal(designSlug(''), DEFAULT_DESIGN_SLUG)
    assert.equal(designRel('default'), 'designs/default.design.json')
    assert.equal(designRel('quokka-shop-storefront'), 'designs/quokka-shop-storefront.design.json')
    assert.throws(() => designRel('../secrets'), /escapes|bad design slug/)
    assert.throws(() => designRel('designs/../etc/passwd'), /escapes|bad design slug/)
    assert.throws(() => designRel('/etc/passwd'), /escapes|bad design slug/)
    assert.throws(() => designRel('foo/bar'), /escapes|bad design slug/)
    assert.throws(() => designRel('__proto__'), /bad design slug/)
    assert.throws(() => designRel('constructor'), /bad design slug/)
    assert.throws(() => designRel('a'.repeat(41)), /bad design slug/)
  })

  it('seeds a validating IR from a brief and strips markup', () => {
    const doc = seedDesignIR({
      slug: 'pitch-deck',
      brief: 'Make a <b>pitch</b> deck',
      template: 'slides',
      name: 'Pitch'
    })
    const v = validateDesignIR(doc)
    assert.equal(v.ok, true, v.errors && v.errors.join(','))
    assert.equal(doc.artifact.id, 'pitch-deck')
    assert.equal(doc.artifact.profile, 'slides')
    assert.equal(doc.pages.length, 2)
    assert.equal(doc.brief.goal.includes('<'), false)
    assert.equal(doc.nodes['p1.title'].text, 'Pitch')
    assert.equal(isShopSample(doc), false)
    assert.equal(safeExportStem('pitch-deck', false), 'pitch-deck')
    assert.equal(safeExportStem('x', true), 'quokka-shop')
    assert.equal(profileFromTemplate('nope'), 'ui.web')
    assert.equal(profileFromTemplate('mobile'), 'ui.mobile')
  })

  it('T-48 irGrew detects page/node growth', () => {
    assert.equal(slugFromBrief('Make a pitch deck!!!'), 'make-a-pitch-deck')
    assert.equal(slugFromBrief('<script>x</script> Hello'), 'scriptx-script-hello')
    const empty = slugFromBrief('***')
    assert.match(empty, /^draft-[\w]+$/)
    const seed = seedDesignIR({ slug: 'pitch-deck', brief: 'A pitch' })
    assert.equal(irGrew(seed, seed), false)
    assert.equal(irGrew(seed, { ...seed, pages: [...seed.pages, { id: 'p3', name: 'Three' }] }), true)
    const more = { ...seed, nodes: { ...seed.nodes, 'p1.extra': { type: 'text', text: 'x' } } }
    assert.equal(irGrew(seed, more), true)
  })
})

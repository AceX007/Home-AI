import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { defaultDesignIR } from './designir.mjs'
import { applyDtcgToIr, designTokenRel } from './dtcg.mjs'

const sample = {
  color: {
    bg: { $value: '#111111', $type: 'color' },
    fg: { $value: '{color.bg}', $type: 'color' },
    accent: {
      $value: '#89d185',
      $type: 'color',
      $extensions: { 'com.homeai.ir': 'colorAccent' }
    }
  },
  space: { scale: { $value: 1.2, $type: 'number' } }
}

describe('DTCG ingest', () => {
  it('jails token files to designs/*.json', () => {
    assert.equal(designTokenRel('designs/tokens.json'), 'designs/tokens.json')
    assert.equal(designTokenRel(undefined), 'designs/tokens.json')
    assert.equal(designTokenRel(''), 'designs/tokens.json')
    assert.throws(() => designTokenRel('../tokens.json'), /escapes|designs/)
    assert.throws(() => designTokenRel('designs/../secrets.json'), /escapes/)
    assert.throws(() => designTokenRel('designs/default.design.json'), /not a token/)
  })

  it('maps aliases and homeai ir hints, skips remote values', () => {
    const base = defaultDesignIR()
    const { doc, applied } = applyDtcgToIr(base, sample, 'designs/tokens.json')
    assert.equal(doc.tokens.colorBg, '#111111')
    assert.equal(doc.tokens.colorFg, '#111111')
    assert.equal(doc.tokens.colorAccent, '#89d185')
    assert.equal(doc.tokens.spaceScale, 1.2)
    assert.equal(doc.revision, 'rev_2')
    assert.equal(base.tokens.colorBg, '#1e1e1e')
    assert.equal(applied.some((a) => a.startsWith('color.bg')), true)
    assert.equal(doc.tokenSources[0].path, 'designs/tokens.json')

    const remote = {
      color: { bg: { $value: 'https://evil.example/x', $type: 'color' } }
    }
    assert.throws(() => applyDtcgToIr(defaultDesignIR(), remote, 'designs/tokens.json'), /no mapped/)
  })

  it('rejects alias cycles and prototype keys', () => {
    const cyclic = {
      color: {
        bg: { $value: '{color.fg}' },
        fg: { $value: '{color.bg}' }
      }
    }
    assert.throws(() => applyDtcgToIr(defaultDesignIR(), cyclic, 'designs/tokens.json'), /cycle/)
    const proto = JSON.parse('{"__proto__":{"$value":"#ffffff"},"color":{"bg":{"$value":"#222222"}}}')
    const { doc } = applyDtcgToIr(defaultDesignIR(), proto, 'designs/brand.json')
    assert.equal(doc.tokens.colorBg, '#222222')
  })
})

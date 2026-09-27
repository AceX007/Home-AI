import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  takeStyleMap,
  takeStyleValue,
  parseCssDeclarations,
  styleToCss,
  takeAttrs,
  compileReactStyle
} from './design-style.mjs'
import { applyDesignPatch, defaultDesignIR, validateDesignIR } from './designir.mjs'

describe('design style sanitizer', () => {
  it('accepts allowlisted declarations and round-trips css', () => {
    const { style, attrs } = parseCssDeclarations(
      'height: 748px;\ndisplay: flex;\nflex-direction: column;\nanimation: qIn .45s ease both;\n@class mcs'
    )
    assert.equal(style.height, '748px')
    assert.equal(style.display, 'flex')
    assert.equal(style.animation, 'qIn .45s ease both')
    assert.equal(attrs.class, 'mcs')
    assert.match(styleToCss(style, attrs), /@class mcs/)
  })

  it('rejects html, url(), unknown props, and prototype keys', () => {
    assert.throws(() => parseCssDeclarations('background: url(https://x)'), /unsafe/)
    assert.throws(() => parseCssDeclarations('color: <red>'), /unsafe/)
    assert.throws(() => parseCssDeclarations('behavior: url(x)'), /prop|unsafe/)
    assert.throws(() => takeStyleMap(JSON.parse('{"__proto__":{"display":"flex"}}')), /style key/)
    assert.throws(() => takeStyleValue('display', 'table-caption'), /style display/)
    assert.throws(() => takeAttrs({ onclick: 'x' }), /attr/)
    assert.throws(() => takeAttrs({ class: 'A B' }), /attr|class/)
  })

  it('compileReactStyle drops unsafe values instead of painting them', () => {
    const css = compileReactStyle({
      style: JSON.parse('{"background":"url(https://x)","color":"#ffffff","display":"flex","__proto__":{"color":"red"}}')
    })
    assert.equal(css.background, undefined)
    assert.equal(css.color, '#ffffff')
    assert.equal(css.display, 'flex')
    assert.equal(Object.prototype.color, undefined)
  })

  it('patches nested style through DesignIR without html', () => {
    const base = defaultDesignIR()
    base.nodes['hero.title'].style = { color: '#cccccc' }
    assert.equal(validateDesignIR(base).ok, true)
    const { doc } = applyDesignPatch(base, {
      patch: [{ op: 'replace', path: '/nodes/hero.title/style/color', value: '#89d185' }]
    })
    assert.equal(doc.nodes['hero.title'].style.color, '#89d185')
    assert.throws(
      () =>
        applyDesignPatch(base, {
          patch: [{ op: 'replace', path: '/nodes/hero.title/style', value: { background: 'url(x)' } }]
        }),
      /unsafe|color|invalid|style/
    )
  })

  it('accepts the on-disk storefront DesignIR', async () => {
    const { readFile } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
    const raw = JSON.parse(await readFile(join(root, 'designs/default.design.json'), 'utf8'))
    const v = validateDesignIR(raw)
    assert.equal(v.ok, true, v.errors.join('; '))
  })
})

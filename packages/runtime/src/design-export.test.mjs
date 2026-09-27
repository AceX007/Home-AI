import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { exportFrame, exportSvgString, safeMarkText, safeHex } from './design-export.mjs'
import { applyHandleDelta } from './design-handle.mjs'
import { compileReactStyle, takeLayout } from './design-style.mjs'

describe('design selection export and handles', () => {
  it('strips markup from export text and ignores non-hex fills', () => {
    assert.equal(safeMarkText('<script>alert(1)</script>').includes('<'), false)
    assert.equal(safeHex('url(https://x)', '#111111'), '#111111')
    const frame = exportFrame(
      { text: 'Hi <b>x</b>', style: { background: 'url(https://x)', color: '#ffffff' } },
      { colorBg: '#000000', colorAccent: '#32d74b' },
      { scale: 1, format: 'svg' }
    )
    assert.equal(frame.bg, '#000000')
    assert.equal(frame.fg, '#ffffff')
    assert.equal(frame.text.includes('<'), false)
    const svg = exportSvgString({ ...frame, text: '<script>alert(1)</script>' })
    assert.equal(svg.includes('<script'), false)
    assert.match(svg, /fill="#000000"/)
  })

  it('clamps handle deltas and copies only known layout keys', () => {
    const next = applyHandleDelta({ width: 100, height: 40, widthMode: 'fixed', heightMode: 'fixed' }, 'e', 50, 0)
    assert.equal(next.width, 150)
    assert.equal(next.height, 40)
    const abs = applyHandleDelta(
      { width: 100, height: 40, widthMode: 'fixed', heightMode: 'fixed', position: 'absolute', offX: 10, offY: 8 },
      'nw',
      -6,
      -4
    )
    assert.equal(abs.offX, 4)
    assert.equal(abs.offY, 4)
    const huge = applyHandleDelta({ width: 100, height: 40 }, 'se', 99999, 99999)
    assert.equal(huge.width, 4000)
    assert.equal(huge.height, 4000)
    const proto = JSON.parse('{"__proto__":{"width":9},"width":80,"height":20}')
    const clean = applyHandleDelta(proto, 'e', 10, 0)
    assert.equal(clean.width, 90)
    assert.equal(Object.prototype.width, undefined)
  })

  it('compiles absolute offset through takeLayout', () => {
    const lay = takeLayout({ position: 'absolute', offX: 12, offY: -3, widthMode: 'fixed', width: 40, heightMode: 'fixed', height: 20 })
    const css = compileReactStyle({ layout: lay, style: { color: '#ffffff' } })
    assert.equal(css.position, 'absolute')
    assert.equal(css.left, 12)
    assert.equal(css.top, -3)
    assert.throws(() => takeLayout({ offX: 9000 }), /layout num/)
  })
})

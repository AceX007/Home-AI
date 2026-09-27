const BLOCK = new Set(['', '__proto__', 'constructor', 'prototype'])

export const STYLE_KEYS = new Set([
  'display',
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'align-items',
  'gap',
  'width',
  'height',
  'min-width',
  'max-width',
  'min-height',
  'max-height',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'border-radius',
  'overflow',
  'overflow-x',
  'overflow-y',
  'opacity',
  'position',
  'flex',
  'background',
  'color',
  'border',
  'border-width',
  'border-style',
  'border-color',
  'font-size',
  'font-weight',
  'text-align',
  'cursor',
  'pointer-events',
  'object-fit',
  'white-space',
  'text-overflow',
  'text-decoration-color',
  'box-sizing',
  'aspect-ratio',
  'grid-template-columns',
  'grid-template-rows',
  'backdrop-filter',
  'transition',
  'animation',
  'scrollbar-width',
  '-ms-overflow-style'
])

const ENUM = {
  display: new Set(['flex', 'block', 'none', 'grid', 'inline-flex']),
  'flex-direction': new Set(['row', 'column', 'row-reverse', 'column-reverse']),
  'flex-wrap': new Set(['nowrap', 'wrap']),
  'justify-content': new Set(['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']),
  'align-items': new Set(['flex-start', 'center', 'flex-end', 'stretch', 'baseline']),
  overflow: new Set(['visible', 'hidden', 'auto', 'scroll']),
  'overflow-x': new Set(['visible', 'hidden', 'auto', 'scroll']),
  'overflow-y': new Set(['visible', 'hidden', 'auto', 'scroll']),
  position: new Set(['relative', 'absolute', 'static']),
  cursor: new Set(['default', 'pointer', 'text', 'grab']),
  'pointer-events': new Set(['auto', 'none']),
  'object-fit': new Set(['fill', 'contain', 'cover', 'none']),
  'white-space': new Set(['normal', 'nowrap', 'pre']),
  'text-overflow': new Set(['clip', 'ellipsis']),
  'box-sizing': new Set(['content-box', 'border-box']),
  'text-align': new Set(['left', 'center', 'right']),
  'font-weight': new Set(['400', '500', '600', '700', 'normal', 'bold']),
  'scrollbar-width': new Set(['none', 'thin', 'auto']),
  '-ms-overflow-style': new Set(['none', 'auto']),
  'aspect-ratio': new Set(['auto']),
  'grid-template-columns': new Set(['none']),
  'grid-template-rows': new Set(['none']),
  'backdrop-filter': new Set(['none']),
  transition: new Set(['none'])
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const RGB = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/
const LEN = /^(0|auto|none|fill|hug|[0-9]{1,4}(?:\.[0-9]{1,2})?(?:px|%)?)$/
const FLEX = /^(0|1|none|[0-9]{1,2})$/
const OPACITY = /^(0|1|0?\.\d{1,2})$/
const UNSAFE = /[<>]|url\s*\(|expression|javascript:|@import/i

export const TAGS = new Set(['div', 'span', 'button', 'p', 'h1', 'h2', 'img', 'row', 'column', 'group', 'sc-if', 'uc-if', 'nz-if'])
export const NODE_TYPES = new Set(['text', 'button', 'metric', 'frame', 'group', 'conditional', 'image'])
export const ATTR_KEYS = new Set(['class'])
export const CLASS_OK = /^[a-z][a-z0-9-]{0,39}$/
export const LAYOUT_MODES = new Set(['hug', 'fixed', 'fill'])
export const PAD_MODES = new Set(['none', 'all', 'xy', 'individual'])
export const POS_MODES = new Set(['inline', 'absolute'])

function ownKeys(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return []
  return Object.getOwnPropertyNames(obj)
}

export function takeStyleValue(prop, raw) {
  if (typeof prop !== 'string' || !STYLE_KEYS.has(prop) || BLOCK.has(prop)) throw new Error('style key')
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (prop === 'opacity') {
      if (raw < 0 || raw > 1) throw new Error('opacity')
      return String(Math.round(raw * 100) / 100)
    }
    if (raw < 0 || raw > 4000) throw new Error('style number')
    return Number.isInteger(raw) ? `${raw}px` : `${Math.round(raw * 100) / 100}px`
  }
  if (typeof raw !== 'string') throw new Error('style value')
  const v = raw.trim().slice(0, 80)
  if (!v || UNSAFE.test(v)) throw new Error('style unsafe')
  if (ENUM[prop]) {
    if (!ENUM[prop].has(v)) throw new Error(`style ${prop}`)
    return v
  }
  if (prop === 'background' || prop === 'color' || prop === 'border-color' || prop === 'text-decoration-color') {
    if (v === 'none' || v === 'transparent' || HEX.test(v) || RGB.test(v)) return v
    throw new Error('style color')
  }
  if (prop === 'flex') {
    if (!FLEX.test(v)) throw new Error('flex')
    return v
  }
  if (prop === 'animation') {
    if (
      v === 'none' ||
      /^[a-zA-Z][\w-]{0,24}\s+(?:[0-9]{1,2}(?:\.[0-9]{1,2})?|\.[0-9]{1,2})s\s+ease(?:-in-out|-in|-out)?(?:\s+both)?$/.test(v)
    ) {
      return v
    }
    throw new Error('animation')
  }
  if (prop === 'opacity') {
    if (!OPACITY.test(v)) throw new Error('opacity')
    return v
  }
  if (prop === 'border' && (v === 'none' || /^[0-9]{1,2}px solid (#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))$/.test(v))) return v
  if (!LEN.test(v) && !/^[0-9]{1,4}px [0-9]{1,4}px$/.test(v) && !/^[0-9]{1,4}px [0-9]{1,4}px [0-9]{1,4}px [0-9]{1,4}px$/.test(v)) {
    throw new Error(`style ${prop}`)
  }
  return v
}

export function takeStyleMap(raw) {
  if (raw == null) return undefined
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('bad style')
  const out = Object.create(null)
  for (const k of ownKeys(raw)) {
    if (BLOCK.has(k) || !STYLE_KEYS.has(k)) throw new Error('style key')
    out[k] = takeStyleValue(k, raw[k])
  }
  if (ownKeys(out).length > 48) throw new Error('style too large')
  return out
}

export function parseCssDeclarations(src) {
  if (typeof src !== 'string') throw new Error('css not string')
  if (src.length > 4000) throw new Error('css too large')
  if (UNSAFE.test(src)) throw new Error('css unsafe')
  const style = Object.create(null)
  const attrs = Object.create(null)
  for (const raw of src.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('@')) {
      const m = /^@([a-z]{1,20})\s+([a-zA-Z0-9._-]{1,40})$/.exec(line)
      if (!m) throw new Error('bad @attr')
      if (!ATTR_KEYS.has(m[1])) throw new Error('attr key')
      if (m[1] === 'class' && !CLASS_OK.test(m[2])) throw new Error('class')
      attrs[m[1]] = m[2]
      continue
    }
    const cut = line.indexOf(':')
    if (cut < 1) throw new Error('bad declaration')
    const prop = line.slice(0, cut).trim()
    const val = line.slice(cut + 1).trim().replace(/;$/, '').trim()
    if (!STYLE_KEYS.has(prop)) throw new Error(`css prop ${prop}`)
    style[prop] = takeStyleValue(prop, val)
  }
  return { style, attrs }
}

export function styleToCss(style, attrs) {
  const lines = []
  if (style && typeof style === 'object') {
    for (const k of Object.keys(style)) {
      if (!STYLE_KEYS.has(k)) continue
      lines.push(`${k}: ${style[k]};`)
    }
  }
  if (attrs && typeof attrs === 'object' && typeof attrs.class === 'string') {
    lines.push(`@class ${attrs.class}`)
  }
  return lines.join('\n')
}

export function takeAttrs(raw) {
  if (raw == null) return undefined
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('bad attrs')
  const out = Object.create(null)
  for (const k of ownKeys(raw)) {
    if (BLOCK.has(k) || !ATTR_KEYS.has(k)) throw new Error('attr key')
    const v = raw[k]
    if (typeof v !== 'string' || (k === 'class' && !CLASS_OK.test(v))) throw new Error('attr value')
    out[k] = v
  }
  return out
}

function numField(v, min, max) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error('layout num')
  return v
}

export function takeLayout(raw) {
  if (raw == null) return undefined
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('bad layout')
  const out = Object.create(null)
  for (const k of ownKeys(raw)) {
    if (BLOCK.has(k)) throw new Error('layout key')
    const v = raw[k]
    if (k === 'widthMode' || k === 'heightMode') {
      if (!LAYOUT_MODES.has(v)) throw new Error(k)
      out[k] = v
    } else if (k === 'padMode' || k === 'marginMode') {
      if (!PAD_MODES.has(v)) throw new Error(k)
      out[k] = v
    } else if (k === 'position') {
      if (!POS_MODES.has(v)) throw new Error(k)
      out[k] = v
    } else if (
      k === 'width' ||
      k === 'height' ||
      k === 'gap' ||
      k === 'radius' ||
      k === 'padT' ||
      k === 'padR' ||
      k === 'padB' ||
      k === 'padL' ||
      k === 'padV' ||
      k === 'padH' ||
      k === 'marT' ||
      k === 'marR' ||
      k === 'marB' ||
      k === 'marL' ||
      k === 'marV' ||
      k === 'marH'
    ) {
      out[k] = numField(v, 0, 4000)
    } else if (k === 'offX' || k === 'offY') {
      out[k] = numField(v, -4000, 4000)
    } else if (k === 'opacity') {
      out[k] = numField(v, 0, 1)
    } else throw new Error('layout key')
  }
  return out
}

export function compileReactStyle(node) {
  const out = {}
  const style = node && node.style && typeof node.style === 'object' ? node.style : {}
  for (const k of ownKeys(style)) {
    if (BLOCK.has(k) || !STYLE_KEYS.has(k)) continue
    try {
      const safe = takeStyleValue(k, style[k])
      const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      out[camel] = safe
    } catch {
      continue
    }
  }
  const lay = node && node.layout && typeof node.layout === 'object' ? node.layout : null
  if (lay) {
    if (lay.widthMode === 'fixed' && typeof lay.width === 'number') out.width = lay.width
    if (lay.widthMode === 'fill') out.width = '100%'
    if (lay.heightMode === 'fixed' && typeof lay.height === 'number') out.height = lay.height
    if (lay.heightMode === 'fill') out.height = '100%'
    if (typeof lay.gap === 'number') out.gap = lay.gap
    if (typeof lay.radius === 'number') out.borderRadius = lay.radius
    if (typeof lay.opacity === 'number') out.opacity = lay.opacity
    if (lay.padMode === 'all' && typeof lay.padT === 'number') out.padding = lay.padT
    if (lay.padMode === 'xy') {
      out.padding = `${lay.padV ?? 0}px ${lay.padH ?? 0}px`
    }
    if (lay.padMode === 'individual') {
      out.padding = `${lay.padT ?? 0}px ${lay.padR ?? 0}px ${lay.padB ?? 0}px ${lay.padL ?? 0}px`
    }
    if (lay.marginMode === 'all' && typeof lay.marT === 'number') out.margin = lay.marT
    if (lay.marginMode === 'xy') {
      out.margin = `${lay.marV ?? 0}px ${lay.marH ?? 0}px`
    }
    if (lay.marginMode === 'individual') {
      out.margin = `${lay.marT ?? 0}px ${lay.marR ?? 0}px ${lay.marB ?? 0}px ${lay.marL ?? 0}px`
    }
    if (lay.position === 'absolute') {
      out.position = 'absolute'
      if (typeof lay.offX === 'number') out.left = lay.offX
      if (typeof lay.offY === 'number') out.top = lay.offY
    }
  }
  return out
}

import { takeLayout } from './design-style.mjs'

const HANDLES = new Set(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'])
const LAY_KEYS = [
  'widthMode',
  'heightMode',
  'width',
  'height',
  'gap',
  'radius',
  'opacity',
  'padMode',
  'padT',
  'padR',
  'padB',
  'padL',
  'padV',
  'padH',
  'marginMode',
  'marT',
  'marR',
  'marB',
  'marL',
  'marV',
  'marH',
  'position',
  'offX',
  'offY'
]

function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) return lo
  return Math.min(hi, Math.max(lo, Math.round(n)))
}

function copyLay(src) {
  const out = Object.create(null)
  if (!src || typeof src !== 'object' || Array.isArray(src)) return out
  for (const k of LAY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k]
  }
  return out
}

export function applyHandleDelta(lay, handle, dx, dy) {
  const k = typeof handle === 'string' && HANDLES.has(handle) ? handle : 'se'
  const x = Number.isFinite(dx) ? dx : 0
  const y = Number.isFinite(dy) ? dy : 0
  const next = copyLay(lay)
  const dw = k.includes('e') ? x : k.includes('w') ? -x : 0
  const dh = k.includes('s') ? y : k.includes('n') ? -y : 0
  next.widthMode = 'fixed'
  next.heightMode = 'fixed'
  next.width = clamp((typeof next.width === 'number' ? next.width : 120) + dw, 8, 4000)
  next.height = clamp((typeof next.height === 'number' ? next.height : 40) + dh, 8, 4000)
  if (next.position === 'absolute') {
    if (k.includes('w')) next.offX = clamp((typeof next.offX === 'number' ? next.offX : 0) + x, -4000, 4000)
    if (k.includes('n')) next.offY = clamp((typeof next.offY === 'number' ? next.offY : 0) + y, -4000, 4000)
  }
  try {
    return takeLayout(next)
  } catch {
    return takeLayout({ widthMode: 'fixed', heightMode: 'fixed', width: 120, height: 40 })
  }
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function safeMarkText(raw) {
  if (typeof raw !== 'string') return 'Q'
  const t = raw.replace(/[<>&"'`]/g, '').trim().slice(0, 48)
  return t || 'Q'
}

export function safeHex(raw, fallback = '#111111') {
  if (typeof raw !== 'string') return fallback
  const v = raw.trim()
  return HEX.test(v) ? v : fallback
}

function xmlText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function exportFrame(node, tokens, opts) {
  const scale = opts && opts.scale === 1 ? 1 : 2
  const format = opts && opts.format === 'svg' ? 'svg' : 'png'
  const w = 256 * scale
  const h = 256 * scale
  const style = node && node.style && typeof node.style === 'object' && !Array.isArray(node.style) ? node.style : {}
  const tok = tokens && typeof tokens === 'object' && !Array.isArray(tokens) ? tokens : {}
  const bg = safeHex(style.background, safeHex(tok.colorBg, '#111111'))
  const fg = safeHex(style.color, safeHex(tok.colorFg, '#f0f1f5'))
  const accent = safeHex(tok.colorAccent, '#32d74b')
  const text = safeMarkText(node && node.text)
  return { scale, format, w, h, bg, fg, accent, text }
}

export function exportSvgString(frame) {
  const w = Number(frame && frame.w) || 256
  const h = Number(frame && frame.h) || 256
  const bg = safeHex(frame && frame.bg, '#111111')
  const fg = safeHex(frame && frame.fg, '#f0f1f5')
  const accent = safeHex(frame && frame.accent, '#32d74b')
  const text = xmlText(safeMarkText(frame && frame.text))
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    '" height="' +
    h +
    '" viewBox="0 0 256 256">' +
    '<rect fill="' +
    bg +
    '" width="256" height="256"/>' +
    '<rect fill="' +
    accent +
    '" x="78" y="40" width="100" height="100" rx="18"/>' +
    '<text x="128" y="108" text-anchor="middle" fill="' +
    fg +
    '" font-size="22" font-family="sans-serif" font-weight="700">' +
    text +
    '</text></svg>'
  )
}

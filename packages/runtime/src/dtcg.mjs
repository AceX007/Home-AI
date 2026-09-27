import { validateDesignIR } from './designir.mjs'

const BLOCK = new Set(['', '__proto__', 'constructor', 'prototype'])
const COLOR_KEYS = new Set(['colorBg', 'colorFg', 'colorMuted', 'colorAccent', 'colorCard'])
const IR_TOKEN_KEYS = new Set([...COLOR_KEYS, 'spaceScale', 'radius'])
const NAME_TO_IR = {
  'color.bg': 'colorBg',
  'color.background': 'colorBg',
  'color.fg': 'colorFg',
  'color.foreground': 'colorFg',
  'color.text': 'colorFg',
  'color.muted': 'colorMuted',
  'color.accent': 'colorAccent',
  'color.card': 'colorCard',
  'color.surface': 'colorCard',
  'space.scale': 'spaceScale',
  'density.scale': 'spaceScale',
  'size.radius': 'radius',
  'radius.default': 'radius',
  'dimension.radius': 'radius'
}

function ownGet(obj, key) {
  if (!obj || typeof obj !== 'object') return undefined
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined
}

function isLeaf(v) {
  return Boolean(v && typeof v === 'object' && !Array.isArray(v) && ownGet(v, '$value') !== undefined)
}

function irHint(leaf) {
  const ext = ownGet(leaf, '$extensions')
  const hint = ext && typeof ext === 'object' ? ownGet(ext, 'com.homeai.ir') : undefined
  return typeof hint === 'string' && IR_TOKEN_KEYS.has(hint) ? hint : undefined
}

export function designTokenRel(rel) {
  const s = String(rel || 'designs/tokens.json').replace(/\\/g, '/').trim()
  if (!s || s.includes('\0') || s.includes('..')) throw new Error('path escapes workspace')
  if (!s.startsWith('designs/') || !s.endsWith('.json')) throw new Error('tokens must be under designs/*.json')
  if (s.endsWith('default.design.json')) throw new Error('not a token file')
  if (!/^designs\/[\w./-]+\.json$/.test(s)) throw new Error('bad token path')
  return s
}

function flattenDtcg(node, prefix, out, depth) {
  if (depth > 8) throw new Error('dtcg too deep')
  if (!node || typeof node !== 'object' || Array.isArray(node)) return
  if (Object.keys(out).length > 200) throw new Error('too many tokens')
  for (const [k, v] of Object.entries(node)) {
    if (BLOCK.has(k) || k.startsWith('$')) continue
    if (!/^[\w.-]{1,64}$/.test(k)) continue
    const path = prefix ? `${prefix}.${k}` : k
    if (isLeaf(v)) {
      out[path] = { value: ownGet(v, '$value'), ir: irHint(v) }
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      flattenDtcg(v, path, out, depth + 1)
    }
  }
}

function resolveOne(flat, key, stack, resolved) {
  if (Object.prototype.hasOwnProperty.call(resolved, key)) return resolved[key]
  const rec = ownGet(flat, key)
  if (!rec) throw new Error(`unresolved alias ${key}`)
  if (stack.has(key)) throw new Error(`alias cycle ${key}`)
  let val = rec.value
  if (typeof val === 'string') {
    const m = val.match(/^\{([\w.-]+)\}$/)
    if (m) {
      stack.add(key)
      val = resolveOne(flat, m[1], stack, resolved)
      stack.delete(key)
    }
  }
  resolved[key] = val
  return val
}

function remoteOrHtml(val) {
  if (typeof val !== 'string') return false
  return /^https?:\/\//i.test(val.trim()) || /[<>]|url\s*\(/i.test(val)
}

function acceptMapped(irKey, val) {
  if (remoteOrHtml(val)) return false
  if (COLOR_KEYS.has(irKey)) {
    return typeof val === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(val)
  }
  if (irKey === 'spaceScale') {
    const n = typeof val === 'number' ? val : Number(val)
    return Number.isFinite(n) && n >= 0.6 && n <= 1.8
  }
  if (irKey === 'radius') {
    const n = typeof val === 'number' ? val : Number(val)
    return Number.isFinite(n) && n >= 0 && n <= 48
  }
  return false
}

function coerce(irKey, val) {
  if (COLOR_KEYS.has(irKey)) return String(val)
  return typeof val === 'number' ? val : Number(val)
}

function nextRevision(rev) {
  const n = Number(String(rev || 'rev_0').replace(/^rev_/, ''))
  return `rev_${Number.isFinite(n) ? n + 1 : 1}`
}

export function applyDtcgToIr(doc, dtcg, sourcePath) {
  const v0 = validateDesignIR(doc)
  if (!v0.ok) throw new Error(v0.errors.join('; ') || 'invalid designir')
  const rel = designTokenRel(sourcePath)
  const flat = Object.create(null)
  flattenDtcg(dtcg, '', flat, 0)
  const resolved = Object.create(null)
  for (const key of Object.keys(flat)) resolveOne(flat, key, new Set(), resolved)
  const tokens = { ...doc.tokens }
  const applied = []
  const skipped = []
  for (const path of Object.keys(flat)) {
    const rec = flat[path]
    const irKey = rec.ir || NAME_TO_IR[path]
    const val = resolved[path]
    if (!irKey || !acceptMapped(irKey, val)) {
      skipped.push(path)
      continue
    }
    tokens[irKey] = coerce(irKey, val)
    applied.push(`${path}→${irKey}`)
  }
  if (!applied.length) throw new Error('no mapped tokens')
  const next = {
    ...doc,
    tokens,
    tokenSources: [{ path: rel, format: 'dtcg-2025.10' }],
    revision: nextRevision(doc.revision)
  }
  const v1 = validateDesignIR(next)
  if (!v1.ok) throw new Error(v1.errors.join('; ') || 'invalid after ingest')
  return { doc: next, applied, skipped }
}

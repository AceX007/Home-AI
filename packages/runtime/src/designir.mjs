import { takeStyleMap, takeStyleValue, takeAttrs, takeLayout, TAGS, NODE_TYPES } from './design-style.mjs'
import { parseToolArguments } from './qwen-tools.mjs'

const BLOCK_SEG = new Set(['', '__proto__', 'constructor', 'prototype'])
const ROOT_KEYS = new Set(['nodes', 'tokens', 'brief', 'locks', 'artifact', 'comments', 'pages'])
const PAGE_ID = /^[\w.-]{1,40}$/
const COMMENT_STATUSES = new Set(['open', 'resolved', 'needs-re-anchor'])
const COMMENT_FIELDS = new Set(['nodeId', 'prop', 'text', 'status', 'anchorRevision'])
const COMMENT_ID = /^cmt_[\w.-]{1,36}$/

export function defaultDesignIR() {
  return {
    schema: 'designir/0.1',
    revision: 'rev_1',
    artifact: { id: 'home-ai-kernel', profile: 'ui.web' },
    brief: {
      goal: 'Operator workbench hero: local 2B, approvals, one primary action',
      audience: 'single operator'
    },
    tokens: {
      spaceScale: 1,
      colorBg: '#1e1e1e',
      colorFg: '#cccccc',
      colorMuted: '#8a8a8a',
      colorAccent: '#89d185',
      colorCard: '#252526',
      radius: 6
    },
    nodes: {
      'hero.kicker': {
        type: 'text',
        role: 'kicker',
        order: 0,
        text: 'Hex AI Kernel v2'
      },
      'hero.title': {
        type: 'text',
        role: 'title',
        order: 1,
        text: 'Local 2B · patch, do not repaint'
      },
      'hero.body': {
        type: 'text',
        role: 'body',
        order: 2,
        text: 'DesignIR is the source of truth. Drag density locally. The 2B only writes scoped patches.'
      },
      'metric.local': {
        type: 'metric',
        order: 3,
        text: 'Local 2B',
        detail: 'default route'
      },
      'metric.approvals': {
        type: 'metric',
        order: 4,
        text: 'Approvals',
        detail: 'not Landlock'
      },
      'metric.secrets': {
        type: 'metric',
        order: 5,
        text: 'Secrets',
        detail: 'data/secrets'
      },
      'cta.primary': {
        type: 'button',
        order: 6,
        text: 'Build from plan',
        locks: { content: false, layout: false }
      }
    },
    locks: {},
    comments: {}
  }
}

const COLOR_KEYS = new Set(['colorBg', 'colorFg', 'colorMuted', 'colorAccent', 'colorCard'])

function validateTokens(tokens, errors) {
  for (const [k, v] of Object.entries(tokens)) {
    if (BLOCK_SEG.has(k) || !/^[\w.-]{1,40}$/.test(k)) {
      errors.push(`token ${k}`)
      continue
    }
    if (COLOR_KEYS.has(k)) {
      if (typeof v !== 'string' || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) {
        errors.push(`${k} color`)
      }
    } else if (k === 'spaceScale') {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0.6 || v > 1.8) errors.push('spaceScale')
    } else if (k === 'radius') {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 48) errors.push('radius')
    } else if (typeof v === 'string') {
      if (/[<>]|url\s*\(/i.test(v) || v.length > 80) errors.push(`${k} token`)
    } else if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors.push(`${k} token type`)
    }
  }
}

export function validateDesignIR(doc) {
  const errors = []
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, errors: ['not an object'] }
  }
  if (doc.schema !== 'designir/0.1') errors.push('schema must be designir/0.1')
  if (typeof doc.revision !== 'string' || !/^rev_\d+$/.test(doc.revision)) errors.push('revision')
  if (!doc.artifact || typeof doc.artifact.id !== 'string') errors.push('artifact.id')
  if (!doc.tokens || typeof doc.tokens !== 'object' || Array.isArray(doc.tokens)) errors.push('tokens')
  else validateTokens(doc.tokens, errors)
  if (doc.tokenSources != null) {
    if (!Array.isArray(doc.tokenSources) || doc.tokenSources.length > 8) errors.push('tokenSources')
    else {
      for (const s of doc.tokenSources) {
        if (!s || typeof s.path !== 'string' || s.path.includes('..') || !/^designs\/[\w./-]+\.json$/.test(s.path)) {
          errors.push('tokenSources.path')
        }
      }
    }
  }
  if (!doc.nodes || typeof doc.nodes !== 'object' || Array.isArray(doc.nodes)) errors.push('nodes')
  if (doc.nodes) {
    for (const [id, node] of Object.entries(doc.nodes)) {
      if (!/^[\w.-]{1,80}$/.test(id)) errors.push(`bad node id ${id}`)
      if (!node || typeof node !== 'object') {
        errors.push(`node ${id}`)
        continue
      }
      if (typeof node.type !== 'string' || !NODE_TYPES.has(node.type)) errors.push(`${id}.type`)
      if (node.text != null) {
        if (typeof node.text !== 'string') errors.push(`${id}.text`)
        else if (/[<>]/.test(node.text)) errors.push(`${id}.text html`)
      }
      if (node.detail != null && typeof node.detail === 'string' && /[<>]/.test(node.detail)) {
        errors.push(`${id}.detail html`)
      }
      if (node.parent != null && node.parent !== '') {
        if (typeof node.parent !== 'string' || !/^[\w.-]{1,80}$/.test(node.parent)) errors.push(`${id}.parent`)
      }
      if (node.tag != null && (typeof node.tag !== 'string' || !TAGS.has(node.tag))) errors.push(`${id}.tag`)
      if (node.visible != null && typeof node.visible !== 'boolean') errors.push(`${id}.visible`)
      if (node.tid != null && (!Number.isInteger(node.tid) || node.tid < 1 || node.tid > 99999)) errors.push(`${id}.tid`)
      if (node.page != null && (typeof node.page !== 'string' || !PAGE_ID.test(node.page))) errors.push(`${id}.page`)
      try {
        if (node.style != null) takeStyleMap(node.style)
      } catch {
        errors.push(`${id}.style`)
      }
      try {
        if (node.attrs != null) takeAttrs(node.attrs)
      } catch {
        errors.push(`${id}.attrs`)
      }
      try {
        if (node.layout != null) takeLayout(node.layout)
      } catch {
        errors.push(`${id}.layout`)
      }
    }
    for (const [id, node] of Object.entries(doc.nodes)) {
      if (node && node.parent && !Object.prototype.hasOwnProperty.call(doc.nodes, node.parent)) {
        errors.push(`${id}.parent missing`)
      }
    }
  }
  if (doc.pages != null) {
    if (!Array.isArray(doc.pages) || doc.pages.length > 16) errors.push('pages')
    else {
      for (const p of doc.pages) {
        if (!p || typeof p.id !== 'string' || !PAGE_ID.test(p.id)) errors.push('page.id')
        if (p.name != null && (typeof p.name !== 'string' || /[<>]/.test(p.name) || p.name.length > 80)) errors.push('page.name')
      }
    }
  }
  if (doc.artifact && doc.artifact.name != null) {
    if (typeof doc.artifact.name !== 'string' || /[<>]/.test(doc.artifact.name) || doc.artifact.name.length > 80) {
      errors.push('artifact.name')
    }
  }
  validateComments(doc, errors)
  return { ok: errors.length === 0, errors }
}

export function densityPatch(scale) {
  const n = Number(scale)
  const value = Number.isFinite(n) ? Math.min(1.8, Math.max(0.6, Math.round(n * 100) / 100)) : 1
  return {
    intentId: 'slider.density',
    scope: ['tokens.spaceScale'],
    patch: [{ op: 'replace', path: '/tokens/spaceScale', value }]
  }
}

function decodeSeg(s) {
  return s.replace(/~1/g, '/').replace(/~0/g, '~')
}

function pointer(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.includes('\0')) {
    throw new Error('bad json pointer')
  }
  const segs = path.split('/').slice(1).map(decodeSeg)
  if (!segs.length || !ROOT_KEYS.has(segs[0])) throw new Error('path outside patchable roots')
  for (const s of segs) {
    if (BLOCK_SEG.has(s) || s === '__proto__') throw new Error('path escapes')
  }
  if (segs[0] === 'comments' && segs[1] && !COMMENT_ID.test(segs[1])) throw new Error('comment id')
  return segs
}

function ownGet(obj, key) {
  if (!obj || typeof obj !== 'object') return undefined
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined
}

function takePage(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('bad page')
  for (const k of Object.getOwnPropertyNames(raw)) {
    if (BLOCK_SEG.has(k) || (k !== 'id' && k !== 'name')) throw new Error('page field')
  }
  const id = ownGet(raw, 'id')
  if (typeof id !== 'string' || !PAGE_ID.test(id)) throw new Error('page.id')
  const out = { id }
  const name = ownGet(raw, 'name')
  if (name != null) {
    if (typeof name !== 'string' || /[<>]/.test(name) || name.length > 80) throw new Error('page.name')
    out.name = name
  }
  return out
}

function takePages(raw) {
  if (!Array.isArray(raw) || raw.length > 16) throw new Error('pages')
  return raw.map(takePage)
}

function takeComment(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('bad comment')
  for (const k of Object.keys(raw)) {
    if (BLOCK_SEG.has(k) || !COMMENT_FIELDS.has(k)) throw new Error('comment field')
  }
  const nodeId = ownGet(raw, 'nodeId')
  const text = ownGet(raw, 'text')
  const status = ownGet(raw, 'status')
  const anchorRevision = ownGet(raw, 'anchorRevision')
  const prop = ownGet(raw, 'prop')
  if (typeof nodeId !== 'string' || !/^[\w.-]{1,80}$/.test(nodeId)) throw new Error('comment nodeId')
  if (typeof text !== 'string') throw new Error('text must be string')
  if (/[<>]/.test(text)) throw new Error('html not allowed in designir')
  if (!COMMENT_STATUSES.has(status)) throw new Error('comment status')
  if (typeof anchorRevision !== 'string' || !/^rev_\d+$/.test(anchorRevision)) throw new Error('comment revision')
  if (prop != null && prop !== 'text' && prop !== 'detail') throw new Error('comment prop')
  const out = {
    nodeId,
    text: text.slice(0, 500),
    status,
    anchorRevision
  }
  if (prop === 'text' || prop === 'detail') out.prop = prop
  return out
}

function validateComments(doc, errors) {
  const comments = doc.comments
  if (comments == null) return
  if (typeof comments !== 'object' || Array.isArray(comments)) {
    errors.push('comments')
    return
  }
  const ids = Object.keys(comments)
  if (ids.length > 64) errors.push('too many comments')
  const nodes = doc.nodes && typeof doc.nodes === 'object' ? doc.nodes : {}
  for (const id of ids) {
    if (BLOCK_SEG.has(id) || !COMMENT_ID.test(id)) {
      errors.push(`comment id ${id}`)
      continue
    }
    let rec
    try {
      rec = takeComment(ownGet(comments, id))
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `comment ${id}`)
      continue
    }
    if (rec.status === 'open' && !Object.prototype.hasOwnProperty.call(nodes, rec.nodeId)) {
      errors.push(`${id} needs-re-anchor`)
    }
  }
}

function walk(doc, segs, createLast) {
  let cur = doc
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segs[i]
    const next = ownGet(cur, k)
    if (next == null || typeof next !== 'object') throw new Error('path missing')
    cur = next
  }
  const last = segs[segs.length - 1]
  if (createLast && !Object.prototype.hasOwnProperty.call(cur, last) && (typeof cur === 'object' && !Array.isArray(cur))) {
    /* add allowed */
  }
  return { parent: cur, last }
}

const NODE_FIELDS = new Set([
  'type',
  'text',
  'detail',
  'role',
  'order',
  'locks',
  'parent',
  'tag',
  'visible',
  'tid',
  'page',
  'style',
  'attrs',
  'layout'
])

function takeNode(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('bad node')
  for (const k of Object.getOwnPropertyNames(raw)) {
    if (BLOCK_SEG.has(k) || !NODE_FIELDS.has(k)) throw new Error('node field')
  }
  const type = ownGet(raw, 'type')
  if (typeof type !== 'string' || !NODE_TYPES.has(type)) throw new Error('type')
  const out = { type }
  const text = ownGet(raw, 'text')
  if (text != null) {
    if (typeof text !== 'string' || /[<>]/.test(text)) throw new Error('html not allowed in designir')
    out.text = text.slice(0, 500)
  }
  const detail = ownGet(raw, 'detail')
  if (detail != null) {
    if (typeof detail !== 'string' || /[<>]/.test(detail)) throw new Error('html not allowed in designir')
    out.detail = detail.slice(0, 500)
  }
  const role = ownGet(raw, 'role')
  if (role != null) {
    if (typeof role !== 'string' || !/^[\w.-]{1,40}$/.test(role)) throw new Error('role')
    out.role = role
  }
  const order = ownGet(raw, 'order')
  if (order != null) {
    if (typeof order !== 'number' || !Number.isInteger(order) || order < 0 || order > 9999) throw new Error('order')
    out.order = order
  }
  const parent = ownGet(raw, 'parent')
  if (parent != null && parent !== '') {
    if (typeof parent !== 'string' || !/^[\w.-]{1,80}$/.test(parent)) throw new Error('parent')
    out.parent = parent
  }
  const tag = ownGet(raw, 'tag')
  if (tag != null) {
    if (typeof tag !== 'string' || !TAGS.has(tag)) throw new Error('tag')
    out.tag = tag
  }
  const visible = ownGet(raw, 'visible')
  if (visible != null) {
    if (typeof visible !== 'boolean') throw new Error('visible')
    out.visible = visible
  }
  const tid = ownGet(raw, 'tid')
  if (tid != null) {
    if (!Number.isInteger(tid) || tid < 1 || tid > 99999) throw new Error('tid')
    out.tid = tid
  }
  const page = ownGet(raw, 'page')
  if (page != null) {
    if (typeof page !== 'string' || !PAGE_ID.test(page)) throw new Error('page')
    out.page = page
  }
  const style = ownGet(raw, 'style')
  if (style != null) out.style = takeStyleMap(style)
  const attrs = ownGet(raw, 'attrs')
  if (attrs != null) out.attrs = takeAttrs(attrs)
  const layout = ownGet(raw, 'layout')
  if (layout != null) out.layout = takeLayout(layout)
  const locks = ownGet(raw, 'locks')
  if (locks != null && typeof locks === 'object' && !Array.isArray(locks)) {
    const next = {}
    if (locks.content === true) next.content = true
    if (locks.layout === true) next.layout = true
    if (locks.style === true) next.style = true
    out.locks = next
  }
  return out
}

function lockBlocks(doc, segs) {
  if (segs[0] !== 'nodes' || segs.length < 3) return false
  const node = ownGet(doc.nodes, segs[1])
  if (!node || typeof node !== 'object') return false
  const locks = node.locks && typeof node.locks === 'object' ? node.locks : {}
  const field = segs[2]
  if (field === 'text' && locks.content) return true
  if ((field === 'order' || field === 'role' || field === 'parent' || field === 'layout') && locks.layout) return true
  if ((field === 'style' || field === 'attrs') && locks.style) return true
  return false
}

function applyOp(doc, op) {
  if (!op || typeof op !== 'object') throw new Error('bad op')
  const kind = op.op
  if (kind !== 'add' && kind !== 'remove' && kind !== 'replace') throw new Error('op not allowed')
  const segs = pointer(op.path)
  if (lockBlocks(doc, segs)) throw new Error('lock respected')
  const { parent, last } = walk(doc, segs, kind === 'add')
  if (kind === 'remove') {
    if (!Object.prototype.hasOwnProperty.call(parent, last)) throw new Error('remove missing')
    delete parent[last]
    return
  }
  let value = op.value
  if (segs[0] === 'comments' && segs.length === 2 && kind !== 'remove') {
    value = takeComment(value)
  } else if (last === 'text' || last === 'detail') {
    if (typeof value !== 'string') throw new Error('text must be string')
    if (/[<>]/.test(value)) throw new Error('html not allowed in designir')
    value = value.slice(0, 500)
  } else if (segs[0] === 'comments' && last === 'status') {
    if (!COMMENT_STATUSES.has(value)) throw new Error('comment status')
  } else if (segs[0] === 'nodes' && segs.length === 2 && kind !== 'remove') {
    value = takeNode(value)
  } else if (segs[0] === 'nodes' && segs[2] === 'style') {
    if (segs.length === 3) value = takeStyleMap(value)
    else if (segs.length === 4) value = takeStyleValue(last, value)
    else throw new Error('style path')
  } else if (segs[0] === 'nodes' && segs[2] === 'attrs') {
    if (segs.length === 3) value = takeAttrs(value)
    else if (segs.length === 4 && last === 'class') value = takeAttrs({ class: value }).class
    else throw new Error('attrs path')
  } else if (segs[0] === 'nodes' && segs[2] === 'layout') {
    if (segs.length === 3) value = takeLayout(value)
    else throw new Error('layout path')
  } else if (segs[0] === 'nodes' && last === 'parent') {
    if (value !== '' && (typeof value !== 'string' || !/^[\w.-]{1,80}$/.test(value))) throw new Error('parent')
  } else if (segs[0] === 'nodes' && last === 'tag') {
    if (typeof value !== 'string' || !TAGS.has(value)) throw new Error('tag')
  } else if (segs[0] === 'nodes' && last === 'visible') {
    if (typeof value !== 'boolean') throw new Error('visible')
  } else if (segs[0] === 'nodes' && last === 'type') {
    if (typeof value !== 'string' || !NODE_TYPES.has(value)) throw new Error('type')
  } else if (segs[0] === 'pages') {
    if (segs.length === 1) value = takePages(value)
    else if (segs.length === 2) value = takePage(value)
    else throw new Error('page path')
  }
  if (kind === 'replace') {
    if (!Object.prototype.hasOwnProperty.call(parent, last)) throw new Error('replace missing')
    parent[last] = value
    return
  }
  if (kind === 'add' && Array.isArray(parent) && last === '-') {
    parent.push(value)
    return
  }
  parent[last] = value
}

function nextRevision(rev) {
  const n = Number(String(rev || 'rev_0').replace(/^rev_/, ''))
  return `rev_${Number.isFinite(n) ? n + 1 : 1}`
}

function safeSeg(raw) {
  const id = String(raw || '')
  if (!id || BLOCK_SEG.has(id) || id.includes('..') || !PAGE_ID.test(id)) return ''
  return id
}

function pageValueFromLoose(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null
  const id = safeSeg(item.id)
  if (!id) return null
  const out = { id }
  if (typeof item.name === 'string') out.name = item.name
  else if (typeof item.text === 'string') out.name = item.text.slice(0, 80)
  return out
}

function sanitizeRfcValue(path, value) {
  const segs = String(path || '')
    .split('/')
    .filter(Boolean)
  if (segs[0] === 'pages' && segs.length <= 2) {
    if (Array.isArray(value)) {
      const pages = []
      for (const row of value) {
        const p = pageValueFromLoose(row)
        if (p) pages.push(p)
        if (pages.length >= 16) break
      }
      return pages
    }
    return pageValueFromLoose(value)
  }
  if (segs[0] === 'nodes' && segs.length === 2 && value && typeof value === 'object' && !Array.isArray(value)) {
    return nodeValueFromLoose(value)
  }
  return value
}

function nodeValueFromLoose(item) {
  const type = typeof item.type === 'string' && NODE_TYPES.has(item.type) ? item.type : 'frame'
  const tagRaw = typeof item.tag === 'string' ? item.tag : type === 'text' ? 'p' : 'div'
  const tag = TAGS.has(tagRaw) ? tagRaw : 'div'
  const value = { type, tag }
  if (typeof item.text === 'string') value.text = item.text
  if (typeof item.detail === 'string') value.detail = item.detail
  if (typeof item.parent === 'string' && item.parent) value.parent = item.parent
  if (typeof item.order === 'number' && Number.isInteger(item.order)) value.order = item.order
  const page = safeSeg(item.page)
  if (page) value.page = page
  if (typeof item.visible === 'boolean') value.visible = item.visible
  return value
}

/** 2B often emits node maps or unknown ops instead of RFC 6902. Keep add/remove/replace; wrap loose nodes. */
export function coerceDesignOps(list) {
  const src = Array.isArray(list) ? list : []
  const out = []
  for (const item of src) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    if (out.length >= 32) break
    const kind = item.op
    if (kind === 'add' || kind === 'remove' || kind === 'replace') {
      if (typeof item.path === 'string' && item.path.startsWith('/')) {
        const row = { op: kind, path: item.path }
        if (kind !== 'remove') {
          const value = sanitizeRfcValue(item.path, item.value)
          if (value == null) continue
          row.value = value
        }
        out.push(row)
      }
      continue
    }
    const nid = safeSeg(item.id)
    if (!nid) continue
    const looksNode =
      item.type != null ||
      item.tag != null ||
      item.parent != null ||
      item.page != null ||
      item.text != null ||
      item.order != null
    if (!looksNode && typeof item.name === 'string') {
      out.push({ op: 'add', path: '/pages/-', value: { id: nid, name: item.name } })
      continue
    }
    if (!looksNode) continue
    const page = safeSeg(item.page) || (nid.includes('.') ? nid.split('.')[0] : nid)
    if (page && !nid.includes('.') && out.length < 32) {
      const name =
        typeof item.name === 'string'
          ? item.name
          : typeof item.text === 'string'
            ? item.text.slice(0, 80)
            : nid
      out.push({ op: 'add', path: '/pages/-', value: { id: page, name } })
    }
    if (out.length >= 32) break
    out.push({ op: 'add', path: `/nodes/${nid}`, value: nodeValueFromLoose(item) })
  }
  return out
}

function takeEnvelopePatch(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new Error('bad envelope')
  let patch = envelope.patch
  let baseRevision = envelope.baseRevision
  if (typeof envelope._raw === 'string' && envelope._raw) {
    const parsed = parseToolArguments(envelope._raw)
    if (!Array.isArray(patch) || !patch.length) patch = parsed.patch
    if (!baseRevision && parsed.baseRevision) baseRevision = parsed.baseRevision
  }
  if (typeof patch === 'string') {
    const trimmed = patch.trim()
    const parsed = parseToolArguments(trimmed.startsWith('[') ? `{"patch":${trimmed}}` : trimmed)
    patch = parsed.patch
    if (!baseRevision && parsed.baseRevision) baseRevision = parsed.baseRevision
  }
  if (!Array.isArray(patch)) {
    if (Array.isArray(envelope.ops)) patch = envelope.ops
    else if (Array.isArray(envelope.operations)) patch = envelope.operations
    else if (patch && typeof patch === 'object') patch = [patch]
    else patch = []
  }
  return { patch: coerceDesignOps(patch), baseRevision }
}

export function applyDesignPatch(doc, envelope) {
  const v0 = validateDesignIR(doc)
  if (!v0.ok) throw new Error(v0.errors.join('; ') || 'invalid designir')
  const taken = takeEnvelopePatch(envelope)
  if (taken.baseRevision && taken.baseRevision !== doc.revision) {
    throw new Error(`stale revision ${taken.baseRevision} != ${doc.revision}`)
  }
  const patch = taken.patch
  if (!Array.isArray(patch) || !patch.length) throw new Error('empty patch')
  if (patch.length > 32) throw new Error('too many ops')
  const next = JSON.parse(JSON.stringify(doc))
  const touchesComments = patch.some((op) => op && typeof op.path === 'string' && op.path.startsWith('/comments'))
  if (touchesComments && (!next.comments || typeof next.comments !== 'object' || Array.isArray(next.comments))) {
    next.comments = {}
  }
  const touchesPages = patch.some((op) => op && typeof op.path === 'string' && op.path.startsWith('/pages'))
  if (touchesPages && !Array.isArray(next.pages)) next.pages = []
  for (const op of patch) applyOp(next, op)
  next.revision = nextRevision(doc.revision)
  const v1 = validateDesignIR(next)
  if (!v1.ok) throw new Error(v1.errors.join('; ') || 'invalid after patch')
  return { doc: next, diagnostics: v1 }
}

/** IPC from the renderer: RFC envelope only. Truncated `_raw` is the agent tool loop. */
export function publicDesignEnvelope(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { patch: [] }
  const out = {}
  if (typeof raw.baseRevision === 'string') out.baseRevision = raw.baseRevision.slice(0, 32)
  if (typeof raw.intentId === 'string') out.intentId = raw.intentId.slice(0, 80)
  if (Array.isArray(raw.scope)) out.scope = raw.scope.map((s) => String(s).slice(0, 40)).slice(0, 8)
  if ('patch' in raw) out.patch = raw.patch
  return out
}

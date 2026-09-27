import { takeStyleValue, takeLayout, takeAttrs, STYLE_KEYS } from './design-style.mjs'

const NODE_ID = /^[\w.-]{1,80}$/
const COMMENT_ID = /^cmt_[\w.-]{1,36}$/
const BLOCK = new Set(['', '__proto__', 'constructor', 'prototype'])

function ownNames(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return []
  return Object.getOwnPropertyNames(obj).filter((k) => !BLOCK.has(k))
}

function sameJson(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function softStyle(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out = Object.create(null)
  for (const k of ownNames(raw)) {
    if (!STYLE_KEYS.has(k)) continue
    try {
      out[k] = takeStyleValue(k, raw[k])
    } catch {
      continue
    }
  }
  return ownNames(out).length ? out : undefined
}

function mergeNode(cur, d) {
  const next = { ...cur }
  if (typeof d.text === 'string') next.text = d.text.slice(0, 500)
  if (typeof d.visible === 'boolean') next.visible = d.visible
  if (Object.prototype.hasOwnProperty.call(d, 'style')) {
    const st = softStyle(d.style)
    if (st) next.style = st
  }
  if (d.layout) {
    try {
      next.layout = takeLayout(d.layout)
    } catch {
      /* keep current layout */
    }
  }
  if (d.attrs) {
    try {
      next.attrs = takeAttrs(d.attrs)
    } catch {
      /* keep current attrs */
    }
  }
  return next
}

export function sanitizeDraft(cur, d) {
  if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return cur
  if (!d || typeof d !== 'object' || Array.isArray(d)) return cur
  return mergeNode(cur, d)
}

export function overlayDrafts(doc, drafts) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return doc
  const nodes = doc.nodes && typeof doc.nodes === 'object' && !Array.isArray(doc.nodes) ? { ...doc.nodes } : {}
  for (const id of ownNames(drafts)) {
    if (!NODE_ID.test(id)) continue
    if (!Object.prototype.hasOwnProperty.call(nodes, id)) continue
    const d = drafts[id]
    if (!d || typeof d !== 'object' || Array.isArray(d)) continue
    nodes[id] = mergeNode(nodes[id], d)
  }
  return { ...doc, nodes }
}

export function layerRows(nodes, limit = 64) {
  const cap = Number.isFinite(limit) ? Math.min(64, Math.max(1, limit)) : 64
  const ids = ownNames(nodes).filter((id) => NODE_ID.test(id) && nodes[id] && typeof nodes[id] === 'object' && !Array.isArray(nodes[id]))
  const idSet = new Set(ids)
  const kids = Object.create(null)
  const roots = []
  for (const id of ids) {
    const p = nodes[id].parent
    if (typeof p === 'string' && idSet.has(p) && p !== id) {
      if (!kids[p]) kids[p] = []
      kids[p].push(id)
    } else roots.push(id)
  }
  const byOrder = (a, b) => (nodes[a].order ?? 0) - (nodes[b].order ?? 0)
  roots.sort(byOrder)
  for (const k of ownNames(kids)) kids[k].sort(byOrder)
  const out = []
  const seen = new Set()
  function walk(id, depth) {
    if (seen.has(id) || depth > 8 || out.length >= cap) return
    seen.add(id)
    out.push({ id, depth })
    for (const c of kids[id] || []) walk(c, depth + 1)
  }
  for (const r of roots) walk(r, 0)
  for (const id of ids) {
    if (!seen.has(id)) walk(id, 0)
  }
  return out
}

function fieldOp(ops, id, field, cur, next) {
  if (sameJson(cur, next)) return
  if (next == null) return
  const path = `/nodes/${id}/${field}`
  ops.push({ op: cur == null ? 'add' : 'replace', path, value: next })
}

export function opsForDrafts(doc, drafts, limit = 32) {
  const ops = []
  const nodes = doc && doc.nodes && typeof doc.nodes === 'object' ? doc.nodes : {}
  const cap = Number.isFinite(limit) ? Math.min(32, Math.max(1, limit)) : 32
  for (const id of ownNames(drafts)) {
    if (!NODE_ID.test(id)) continue
    const cur = Object.prototype.hasOwnProperty.call(nodes, id) ? nodes[id] : null
    const draft = drafts[id]
    if (!cur || !draft || typeof draft !== 'object') continue
    if (typeof draft.text === 'string' && draft.text !== (cur.text ?? '')) {
      ops.push({ op: 'replace', path: `/nodes/${id}/text`, value: draft.text })
    }
    if (Object.prototype.hasOwnProperty.call(draft, 'style')) {
      const st = softStyle(draft.style)
      if (st) fieldOp(ops, id, 'style', cur.style, st)
    }
    if (draft.layout) {
      try {
        fieldOp(ops, id, 'layout', cur.layout, takeLayout(draft.layout))
      } catch {
        /* skip bad layout */
      }
    }
    if (draft.attrs) {
      try {
        fieldOp(ops, id, 'attrs', cur.attrs, takeAttrs(draft.attrs))
      } catch {
        /* skip bad attrs */
      }
    }
    if (typeof draft.visible === 'boolean' && draft.visible !== cur.visible) {
      fieldOp(ops, id, 'visible', cur.visible, draft.visible)
    }
    if (ops.length >= cap) break
  }
  return ops.slice(0, cap)
}

export function nextCommentId(now = Date.now(), nonce = '') {
  const core = `${Number(now).toString(36)}${String(nonce)}`.replace(/[^a-z0-9]/gi, '').slice(-12)
  const id = `cmt_${core || 'x'}`
  if (!COMMENT_ID.test(id)) return 'cmt_x'
  return id
}

export function canvasPins(comments, nodes) {
  const nodeSet =
    nodes && typeof nodes === 'object' && !Array.isArray(nodes) ? new Set(ownNames(nodes)) : null
  const out = []
  for (const id of ownNames(comments)) {
    if (!COMMENT_ID.test(id)) continue
    const rec = comments[id]
    if (!rec || typeof rec !== 'object') continue
    if (rec.status !== 'open' && rec.status !== 'needs-re-anchor') continue
    if (typeof rec.text !== 'string') continue
    const text = rec.text.replace(/[<>]/g, '').slice(0, 500)
    if (!text) continue
    const nodeId = typeof rec.nodeId === 'string' && NODE_ID.test(rec.nodeId) ? rec.nodeId : ''
    const live = Boolean(nodeId && (!nodeSet || nodeSet.has(nodeId)))
    if (live && rec.status === 'open') out.push({ id, nodeId, text })
    else out.push({ id, nodeId, text, status: 'needs-re-anchor' })
    if (out.length >= 64) break
  }
  return out
}

export function pinCaption(pin) {
  const text = String(pin?.text || '')
    .replace(/[<>]/g, '')
    .slice(0, 500)
  if (pin?.status === 'needs-re-anchor') return text ? `${text} · needs-re-anchor` : 'needs-re-anchor'
  return text
}

export function cloneOverlay(drafts) {
  const out = Object.create(null)
  let n = 0
  for (const id of ownNames(drafts)) {
    if (!NODE_ID.test(id)) continue
    const d = drafts[id]
    if (!d || typeof d !== 'object' || Array.isArray(d)) continue
    try {
      const raw = JSON.parse(JSON.stringify(d))
      if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.style) {
        const st = softStyle(raw.style)
        if (st) raw.style = st
        else delete raw.style
      }
      out[id] = raw
    } catch {
      continue
    }
    n += 1
    if (n >= 32) break
  }
  return out
}

export function pushUndo(past, current) {
  const list = Array.isArray(past) ? past.slice() : []
  const snap = cloneOverlay(current)
  const last = list[list.length - 1]
  if (last && sameJson(last, snap)) return list
  list.push(snap)
  return list.slice(-32)
}

export function stepUndo(past, future, current) {
  const p = Array.isArray(past) ? past.slice() : []
  const f = Array.isArray(future) ? future.slice() : []
  if (!p.length) return { past: p, future: f, overlay: cloneOverlay(current) }
  const prev = p.pop()
  f.push(cloneOverlay(current))
  return {
    past: p,
    future: f.slice(-32),
    overlay: prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : Object.create(null)
  }
}

export function stepRedo(past, future, current) {
  const p = Array.isArray(past) ? past.slice() : []
  const f = Array.isArray(future) ? future.slice() : []
  if (!f.length) return { past: p, future: f, overlay: cloneOverlay(current) }
  const next = f.pop()
  p.push(cloneOverlay(current))
  return {
    past: p.slice(-32),
    future: f,
    overlay: next && typeof next === 'object' && !Array.isArray(next) ? next : Object.create(null)
  }
}

export function rememberCssDraft(map, prevId, nextId, currentCss, fallbackCss) {
  const out = Object.create(null)
  for (const k of ownNames(map)) {
    if (!NODE_ID.test(k)) continue
    const v = map[k]
    if (typeof v === 'string') out[k] = v.slice(0, 4000)
  }
  if (prevId && NODE_ID.test(prevId) && prevId !== nextId && typeof currentCss === 'string') {
    out[prevId] = currentCss.slice(0, 4000)
  }
  const next = nextId && NODE_ID.test(nextId) ? nextId : ''
  const css = next && typeof out[next] === 'string' ? out[next] : String(fallbackCss ?? '').slice(0, 4000)
  return { map: out, css }
}

export function keepCanvasFocus(doc, page, sel) {
  const pages = Array.isArray(doc?.pages) ? doc.pages.filter((p) => p && typeof p.id === 'string') : []
  const nextPage = pages.some((p) => p.id === page) ? page : pages[0]?.id || 'p1'
  const nodes = doc?.nodes && typeof doc.nodes === 'object' && !Array.isArray(doc.nodes) ? doc.nodes : {}
  const ids = ownNames(nodes).filter((id) => NODE_ID.test(id))
  let nextSel = null
  if (typeof sel === 'string' && NODE_ID.test(sel) && Object.prototype.hasOwnProperty.call(nodes, sel)) {
    nextSel = sel
  } else {
    nextSel = ids.find((id) => nodes[id] && nodes[id].page === nextPage) || ids[0] || null
  }
  return { page: nextPage, sel: nextSel }
}

export function pruneOverlay(overlay, nodes) {
  const out = Object.create(null)
  const n = nodes && typeof nodes === 'object' && !Array.isArray(nodes) ? nodes : {}
  for (const id of ownNames(overlay)) {
    if (!NODE_ID.test(id)) continue
    if (!Object.prototype.hasOwnProperty.call(n, id)) continue
    out[id] = overlay[id]
  }
  return out
}

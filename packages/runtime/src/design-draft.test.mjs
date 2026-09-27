import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { defaultDesignIR, applyDesignPatch } from './designir.mjs'
import { overlayDrafts, opsForDrafts, nextCommentId, canvasPins, pinCaption, cloneOverlay, pushUndo, stepUndo, stepRedo, layerRows, sanitizeDraft, rememberCssDraft, keepCanvasFocus, pruneOverlay } from './design-draft.mjs'

describe('design drafts and comment pins', () => {
  it('overlays only known node ids and ignores prototype keys', () => {
    const base = defaultDesignIR()
    const drafts = Object.create(null)
    drafts['hero.title'] = { ...base.nodes['hero.title'], text: 'Kept while switching' }
    drafts['hero.body'] = { ...base.nodes['hero.body'], text: 'Second node' }
    drafts.__proto__ = { text: 'nope' }
    drafts['missing.node'] = { type: 'text', text: 'ghost' }
    const live = overlayDrafts(base, drafts)
    assert.equal(live.nodes['hero.title'].text, 'Kept while switching')
    assert.equal(live.nodes['hero.body'].text, 'Second node')
    assert.equal(live.nodes['missing.node'], undefined)
    assert.equal(base.nodes['hero.title'].text.includes('Kept'), false)
    const poisoned = JSON.parse('{"__proto__":{"type":"text","text":"x"},"hero.title":{"type":"text","text":"ok"}}')
    const live2 = overlayDrafts(base, poisoned)
    assert.equal(live2.nodes['hero.title'].text, 'ok')
    assert.equal(Object.prototype.text, undefined)
  })

  it('emits a capped patch for every dirty node and applies it', () => {
    const base = defaultDesignIR()
    const drafts = {
      'hero.title': { ...base.nodes['hero.title'], text: 'A' },
      'hero.kicker': { ...base.nodes['hero.kicker'], text: 'B' }
    }
    const ops = opsForDrafts(base, drafts)
    assert.equal(ops.length, 2)
    const { doc } = applyDesignPatch(base, { patch: ops, baseRevision: base.revision })
    assert.equal(doc.nodes['hero.title'].text, 'A')
    assert.equal(doc.nodes['hero.kicker'].text, 'B')
    assert.equal(opsForDrafts(base, { __proto__: { text: 'x' } }).length, 0)
  })

  it('emits visible toggles without dropping other dirty nodes', () => {
    const base = defaultDesignIR()
    const drafts = {
      'hero.title': { ...base.nodes['hero.title'], text: 'A', visible: false }
    }
    const ops = opsForDrafts(base, drafts)
    assert.equal(ops.some((o) => o.path === '/nodes/hero.title/visible' && o.value === false), true)
    assert.equal(ops.some((o) => o.path === '/nodes/hero.title/text' && o.value === 'A'), true)
  })

  it('T-48 mints comment ids and keeps dead pins as needs-re-anchor', () => {
    assert.match(nextCommentId(1_700_000_000_000, 'ab'), /^cmt_[\w.-]{1,36}$/)
    const pins = canvasPins({
      cmt_ok1: { nodeId: 'hero.title', text: 'nice <b>nope</b>', status: 'open' },
      not_a_cmt: { nodeId: 'hero.title', text: 'skip', status: 'open' },
      cmt_closed: { nodeId: 'hero.title', text: 'old', status: 'resolved' }
    })
    assert.equal(pins.length, 1)
    assert.equal(pins[0].text.includes('<'), false)
    assert.equal(pins[0].nodeId, 'hero.title')
    const gone = canvasPins(
      {
        cmt_ok3: { nodeId: 'ghost.node', text: 'lost <b>x</b>', status: 'open' },
        cmt_ok4: { nodeId: 'not valid!!', text: 'still here', status: 'open' }
      },
      { 'hero.title': { type: 'text' } }
    )
    assert.equal(gone.length, 2)
    assert.equal(gone.every((p) => p.status === 'needs-re-anchor'), true)
    assert.equal(gone[0].text.includes('<'), false)
    assert.equal(pinCaption(gone[0]).includes('needs-re-anchor'), true)
    assert.equal(pinCaption(gone[0]).includes('<'), false)
    const protoPins = canvasPins(
      JSON.parse(
        '{"__proto__":{"status":"open","nodeId":"hero.title","text":"x"},"cmt_ok2":{"nodeId":"hero.title","text":"safe","status":"open"}}'
      )
    )
    assert.equal(protoPins.length, 1)
    assert.equal(protoPins[0].text, 'safe')
    const base = defaultDesignIR()
    assert.throws(
      () =>
        applyDesignPatch(base, {
          patch: [
            {
              op: 'add',
              path: '/comments/cmt_bad',
              value: {
                nodeId: 'hero.title',
                text: 'nice <b>x</b>',
                status: 'open',
                anchorRevision: base.revision
              }
            }
          ]
        }),
      /html/
    )
  })

  it('undo stack clones own-key overlays and ignores prototype keys', () => {
    const base = defaultDesignIR()
    const a = { 'hero.title': { ...base.nodes['hero.title'], text: 'A' } }
    const b = { 'hero.title': { ...base.nodes['hero.title'], text: 'B' } }
    const past = pushUndo([], a)
    assert.equal(past.length, 1)
    assert.equal(pushUndo(past, a).length, 1)
    const poisoned = JSON.parse('{"__proto__":{"text":"x"},"hero.title":{"type":"text","text":"C"}}')
    const live = cloneOverlay(poisoned)
    assert.equal(live['hero.title'].text, 'C')
    assert.equal(Object.prototype.text, undefined)
    const u = stepUndo(pushUndo([], a), [], b)
    assert.equal(u.overlay['hero.title'].text, 'A')
    const r = stepRedo(u.past, u.future, u.overlay)
    assert.equal(r.overlay['hero.title'].text, 'B')
  })

  it('drops unsafe overlay styles and nests layer rows without cycles', () => {
    const base = defaultDesignIR()
    base.nodes['hero.title'].style = { color: '#cccccc' }
    const live = overlayDrafts(base, {
      'hero.title': {
        ...base.nodes['hero.title'],
        style: { background: 'url(https://x)', color: '#ffffff' }
      }
    })
    assert.equal(live.nodes['hero.title'].style.background, undefined)
    assert.equal(live.nodes['hero.title'].style.color, '#ffffff')
    const ops = opsForDrafts(base, {
      'hero.title': { ...base.nodes['hero.title'], style: { background: 'url(https://x)', color: '#89d185' } }
    })
    assert.equal(ops.some((o) => String(o.value?.background || '').includes('url')), false)
    const nodes = {
      root: { type: 'frame', order: 0, text: 'Column' },
      child: { type: 'text', parent: 'root', order: 1, text: 'Q' },
      loop: { type: 'group', parent: 'loop', order: 2, text: 'self' }
    }
    const rows = layerRows(nodes)
    assert.equal(rows[0].id, 'root')
    assert.equal(rows[0].depth, 0)
    assert.equal(rows.some((r) => r.id === 'child' && r.depth === 1), true)
    const proto = JSON.parse('{"__proto__":{"type":"text"},"root":{"type":"frame","order":0}}')
    assert.equal(layerRows(proto).every((r) => r.id !== '__proto__'), true)
  })

  it('sanitizeDraft and cloneOverlay drop url() so a sibling overlay cannot restore it', () => {
    const base = defaultDesignIR()
    const dirty = { ...base.nodes['hero.title'], style: { background: 'url(https://x)', color: '#ffffff' } }
    const clean = sanitizeDraft(base.nodes['hero.title'], dirty)
    assert.equal(clean.style.background, undefined)
    assert.equal(clean.style.color, '#ffffff')
    const snap = cloneOverlay({ 'hero.title': dirty })
    assert.equal(snap['hero.title'].style.background, undefined)
    assert.equal(String(snap['hero.title'].style.color), '#ffffff')
  })

  it('remembers Code-tab css per node id without prototype keys', () => {
    const a = rememberCssDraft(null, 'hero.title', 'hero.body', 'color: tomato', 'color: #fff')
    assert.equal(a.map['hero.title'], 'color: tomato')
    assert.equal(a.css, 'color: #fff')
    const b = rememberCssDraft(a.map, 'hero.body', 'hero.title', 'font-size: 12px', 'color: #000')
    assert.equal(b.css, 'color: tomato')
    const proto = rememberCssDraft(JSON.parse('{"__proto__":"x","hero.title":"ok"}'), 'n', 'hero.title', 'nope', '')
    assert.equal(Object.prototype.hasOwnProperty.call(proto.map, '__proto__'), false)
    assert.equal(proto.css, 'ok')
  })

  it('keeps page and selection when remote pages grow, and prunes dead overlay ids', () => {
    const remote = defaultDesignIR()
    remote.pages = [
      { id: 'p1', name: 'One' },
      { id: 'p2', name: 'Two' }
    ]
    remote.nodes['hero.title'].page = 'p1'
    const focus = keepCanvasFocus(remote, 'p1', 'hero.title')
    assert.equal(focus.page, 'p1')
    assert.equal(focus.sel, 'hero.title')
    const gone = keepCanvasFocus(remote, 'missing', 'nope.node')
    assert.equal(gone.page, 'p1')
    assert.ok(gone.sel)
    const drafts = Object.create(null)
    drafts['hero.title'] = { text: 'x' }
    drafts['ghost'] = { text: 'y' }
    drafts.__proto__ = { text: 'z' }
    const kept = pruneOverlay(drafts, remote.nodes)
    assert.equal(kept['hero.title'].text, 'x')
    assert.equal(kept.ghost, undefined)
  })
})

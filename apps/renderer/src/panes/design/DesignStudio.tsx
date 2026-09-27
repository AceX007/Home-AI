import { useEffect, useMemo, useRef, useState } from 'react'
import type { DesignIR, DesignListItem, DesignNode } from '@homeai/core'
import { overlayDrafts, opsForDrafts, nextCommentId, pushUndo, stepUndo, stepRedo, sanitizeDraft, keepCanvasFocus, pruneOverlay, exportFrame, exportSvgString, isShopSample, safeExportStem, DEFAULT_DESIGN_SLUG, irGrew, designTask, designMind, forgeFallbackNote } from '@homeai/runtime/browser'
import { useWorkbench } from '../../store/useWorkbench'
import DesignHome from './DesignHome'
import DesignEditor from './DesignEditor'
import './studio.css'

function cloneNode(n: DesignNode): DesignNode {
  return JSON.parse(JSON.stringify(n)) as DesignNode
}

function kickDesign(task: string) {
  const cur = useWorkbench.getState()
  const mind = designMind(cur.provider)
  useWorkbench.setState({ agentMode: 'agent', provider: mind, chatOpen: true })
  useWorkbench.getState().setActivity('design')
  useWorkbench.getState().run(task, { provider: mind, needsTools: true })
}

export default function DesignStudio() {
  const w = useWorkbench()
  const [view, setView] = useState<'home' | 'editor'>('home')
  const [slug, setSlug] = useState(DEFAULT_DESIGN_SLUG)
  const [doc, setDoc] = useState<DesignIR | null>(null)
  const [projects, setProjects] = useState<DesignListItem[]>([])
  const [overlay, setOverlay] = useState<Record<string, DesignNode>>({})
  const [past, setPast] = useState<Array<Record<string, DesignNode>>>([])
  const [future, setFuture] = useState<Array<Record<string, DesignNode>>>([])
  const [err, setErr] = useState('')
  const [ingestNote, setIngestNote] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const [draft, setDraft] = useState<DesignNode | null>(null)
  const [prompt, setPrompt] = useState('Make a pitch deck for a new product')
  const [template, setTemplate] = useState('blank')
  const [homeTab, setHomeTab] = useState<'projects' | 'systems' | 'templates'>('projects')
  const [q, setQ] = useState('')
  const [page, setPage] = useState('p1')
  const [commentText, setCommentText] = useState('')
  const [creating, setCreating] = useState(false)
  const [growFail, setGrowFail] = useState(false)
  const slugRef = useRef(slug)
  const viewRef = useRef(view)
  const pageRef = useRef(page)
  const selRef = useRef(sel)
  const draftRef = useRef(draft)
  const overlayRef = useRef(overlay)
  const docRef = useRef(doc)
  const seedRef = useRef<{ slug: string; snap: DesignIR | null }>({ slug: '', snap: null })
  const busyWas = useRef(false)
  slugRef.current = slug
  viewRef.current = view
  pageRef.current = page
  selRef.current = sel
  draftRef.current = draft
  overlayRef.current = overlay
  docRef.current = doc

  const mergedOverlay = useMemo(() => {
    const next = { ...overlay }
    if (sel && draft) next[sel] = draft
    return next
  }, [overlay, sel, draft])

  const liveDoc = doc ? (overlayDrafts(doc, mergedOverlay) as DesignIR) : null
  const dirty = !!(doc && opsForDrafts(doc, mergedOverlay).length)
  const shop = isShopSample(liveDoc)

  const applyDoc = (next: DesignIR, keep?: boolean) => {
    const focus = keepCanvasFocus(next, keep ? pageRef.current : '', keep ? selRef.current : null) as {
      page: string
      sel: string | null
    }
    setDoc(next)
    setPage(focus.page)
    setSel(focus.sel)
    setDraft(focus.sel && next.nodes[focus.sel] ? cloneNode(next.nodes[focus.sel]) : null)
  }

  const ingestRemote = (next: DesignIR) => {
    if (docRef.current && next.revision === docRef.current.revision) return
    const focus = keepCanvasFocus(next, pageRef.current, selRef.current) as { page: string; sel: string | null }
    const prevSel = selRef.current
    setDoc(next)
    setOverlay((o) => pruneOverlay(o, next.nodes) as Record<string, DesignNode>)
    setPage(focus.page)
    if (focus.sel !== prevSel) {
      setSel(focus.sel)
      const over = overlayRef.current
      const node = focus.sel && next.nodes[focus.sel] ? next.nodes[focus.sel] : null
      const draftNode = focus.sel && over[focus.sel] && node ? sanitizeDraft(node, over[focus.sel]) : node
      setDraft(draftNode ? cloneNode(draftNode as DesignNode) : null)
    } else if (focus.sel && next.nodes[focus.sel] && !draftRef.current) {
      setDraft(cloneNode(next.nodes[focus.sel]))
    }
    setErr('')
  }

  const refresh = async (id = slugRef.current, opts?: { keep?: boolean }) => {
    try {
      const next = (await window.homeai.designGet(id)) as DesignIR
      if (opts?.keep) ingestRemote(next)
      else {
        setOverlay({})
        setPast([])
        setFuture([])
        setErr('')
        applyDoc(next, false)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const refreshList = async () => {
    try {
      const rows = (await window.homeai.designList()) as DesignListItem[]
      setProjects(Array.isArray(rows) ? rows : [])
    } catch {
      setProjects([])
    }
  }

  useEffect(() => {
    void refresh()
    void refreshList()
  }, [])

  useEffect(() => {
    const off = window.homeai.onDesignChanged((p) => {
      if (p.slug !== slugRef.current || viewRef.current !== 'editor') return
      void refresh(p.slug, { keep: true })
    })
    return off
  }, [])

  useEffect(() => {
    if (!w.busy || view !== 'editor') return
    const t = window.setInterval(() => {
      if (useWorkbench.getState().busy && viewRef.current === 'editor') {
        void refresh(slugRef.current, { keep: true })
      }
    }, 1600)
    return () => window.clearInterval(t)
  }, [w.busy, view])

  useEffect(() => {
    const was = busyWas.current
    busyWas.current = w.busy
    if (!was || w.busy) return
    if (view !== 'editor') return
    if (seedRef.current.slug !== slug) return
    if (!irGrew(seedRef.current.snap, doc)) setGrowFail(true)
    else setGrowFail(false)
  }, [w.busy, view, slug, doc])

  const pick = (id: string | null) => {
    if (!doc || !id || !doc.nodes[id]) return
    const next = { ...overlay }
    if (sel && draft) next[sel] = sanitizeDraft(doc.nodes[sel], draft) as DesignNode
    setOverlay(next)
    setSel(id)
    setDraft(cloneNode(sanitizeDraft(doc.nodes[id], next[id] ?? doc.nodes[id]) as DesignNode))
  }

  const save = async () => {
    if (!doc) return
    const ops = opsForDrafts(doc, mergedOverlay)
    if (!ops.length) {
      setOverlay({})
      return
    }
    try {
      const next = (await window.homeai.designPatch(
        {
          baseRevision: doc.revision,
          intentId: 'studio.save',
          patch: ops
        },
        slug
      )) as DesignIR
      setDoc(next)
      setOverlay({})
      setPast([])
      setFuture([])
      if (sel && next.nodes[sel]) setDraft(cloneNode(next.nodes[sel]))
      setErr('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      await refresh(slug)
    }
  }

  const discard = () => {
    if (!doc) return
    setPast((p) => pushUndo(p, mergedOverlay))
    setFuture([])
    setOverlay({})
    if (sel && doc.nodes[sel]) setDraft(cloneNode(doc.nodes[sel]))
  }

  const restoreOverlay = (next: Record<string, DesignNode>) => {
    setOverlay(next)
    if (sel && next[sel] && doc?.nodes[sel]) setDraft(cloneNode(sanitizeDraft(doc.nodes[sel], next[sel]) as DesignNode))
    else if (sel && doc?.nodes[sel]) setDraft(cloneNode(doc.nodes[sel]))
  }

  const undo = () => {
    const r = stepUndo(past, future, mergedOverlay)
    setPast(r.past)
    setFuture(r.future)
    restoreOverlay(r.overlay)
  }

  const redo = () => {
    const r = stepRedo(past, future, mergedOverlay)
    setPast(r.past)
    setFuture(r.future)
    restoreOverlay(r.overlay)
  }

  const ingestTokens = async () => {
    try {
      const r = (await window.homeai.designIngestTokens(undefined, slug)) as {
        doc: DesignIR
        applied: string[]
        skipped: string[]
      }
      setDoc(r.doc)
      setOverlay({})
      setPast([])
      setFuture([])
      if (sel && r.doc.nodes[sel]) setDraft(cloneNode(r.doc.nodes[sel]))
      setIngestNote(`Imported ${r.applied.length} tokens`)
      setErr('')
      setView('editor')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const exportMark = (opts?: { scale?: number; format?: string }) => {
    const node = sel && liveDoc?.nodes[sel] ? liveDoc.nodes[sel] : { text: shop ? 'Q' : (liveDoc?.artifact.name ?? 'D').slice(0, 1), style: {} }
    const frame = exportFrame(node, liveDoc?.tokens, opts)
    const stem = safeExportStem(slug, shop)
    if (frame.format === 'svg') {
      const svg = exportSvgString(frame)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
      a.download = `${stem}.svg`
      a.click()
      URL.revokeObjectURL(a.href)
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = frame.w
    canvas.height = frame.h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const s = frame.w / 256
    ctx.fillStyle = frame.bg
    ctx.fillRect(0, 0, frame.w, frame.h)
    ctx.fillStyle = frame.accent
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath()
      ctx.roundRect(78 * s, 40 * s, 100 * s, 100 * s, 18 * s)
      ctx.fill()
    } else {
      ctx.fillRect(78 * s, 40 * s, 100 * s, 100 * s)
    }
    ctx.fillStyle = frame.fg
    ctx.font = `bold ${22 * s}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(frame.text, 128 * s, 108 * s)
    canvas.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${stem}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    })
  }

  const pinComment = async () => {
    if (!doc || !sel) return
    const text = commentText.replace(/[<>]/g, '').trim().slice(0, 500)
    if (!text) return
    const id = nextCommentId(Date.now(), sel.replace(/[^\w]/g, '').slice(-4))
    try {
      const next = (await window.homeai.designPatch(
        {
          baseRevision: doc.revision,
          intentId: 'studio.comment',
          patch: [
            {
              op: 'add',
              path: `/comments/${id}`,
              value: { nodeId: sel, text, status: 'open', anchorRevision: doc.revision }
            }
          ]
        },
        slug
      )) as DesignIR
      setDoc(next)
      setCommentText('')
      setErr('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const onCreate = async () => {
    const mind = designMind(w.provider)
    const llamaDown = w.kernelPulse?.llama === 'off' || w.kernelPulse?.llama === 'missing'
    if (mind === 'local' && llamaDown) {
      setErr('Local 2B is offline')
      return
    }
    setCreating(true)
    setErr('')
    setGrowFail(false)
    try {
      const created = (await window.homeai.designCreate({
        brief: prompt,
        template,
        name: prompt.trim().slice(0, 80) || undefined
      })) as { slug: string; doc: DesignIR }
      setSlug(created.slug)
      setOverlay({})
      setPast([])
      setFuture([])
      applyDoc(created.doc)
      setView('editor')
      seedRef.current = { slug: created.slug, snap: created.doc }
      kickDesign(designTask(created.slug, prompt, template))
      void refreshList()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  const onOpen = async (id: string) => {
    setErr('')
    setGrowFail(false)
    seedRef.current = { slug: '', snap: null }
    try {
      const next = (await window.homeai.designGet(id)) as DesignIR
      setSlug(id)
      setOverlay({})
      setPast([])
      setFuture([])
      applyDoc(next)
      setView('editor')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const retryGenerate = () => {
    setGrowFail(false)
    kickDesign(designTask(slug, prompt, template))
  }

  const mind = designMind(w.provider)
  const llamaDown = w.kernelPulse?.llama === 'off' || w.kernelPulse?.llama === 'missing'
  const localBlocked = mind === 'local' && llamaDown
  const pulseKeys = {
    openai: (w.kernelPulse?.keys || '').includes('openai'),
    openrouter: (w.kernelPulse?.keys || '').includes('openrouter'),
    cursor: (w.kernelPulse?.keys || '').includes('cursor')
  }
  const fallNote = forgeFallbackNote(mind, pulseKeys)
  const remintHit = [...w.log]
    .reverse()
    .find((i) => i.kind === 'status' && /DesignIR needs tools/.test(i.text))
  const remintText = remintHit && 'text' in remintHit ? remintHit.text : ''

  return (
    <div className="cd-root">
      {err ? <div className="cd-banner">{err}</div> : null}
      {localBlocked ? <div className="cd-banner">Local 2B is offline</div> : null}
      {fallNote ? <div className="cd-banner">{fallNote}</div> : null}
      {remintText ? <div className="cd-banner ok">{remintText}</div> : null}
      {growFail ? (
        <div className="cd-banner">
          Generate did not grow the canvas.{' '}
          <button type="button" className="cd-retry" onClick={retryGenerate}>
            Retry
          </button>
        </div>
      ) : null}
      {creating ? <div className="cd-banner ok">Creating artifact…</div> : null}
      {view === 'home' ? (
        <DesignHome
          prompt={prompt}
          onPrompt={setPrompt}
          template={template}
          onTemplate={setTemplate}
          onCreate={() => void onCreate()}
          onOpen={(id) => void onOpen(id)}
          projects={projects}
          creating={creating}
          q={q}
          onQ={setQ}
          tab={homeTab}
          onTab={setHomeTab}
          ingestNote={ingestNote}
          onIngest={() => void ingestTokens()}
        />
      ) : (
        <DesignEditor
          doc={liveDoc}
          slug={slug}
          projects={projects}
          onOpenProject={(id) => void onOpen(id)}
          shop={shop}
          generating={w.busy}
          sel={sel}
          onSel={pick}
          title={doc?.artifact.name ?? slug}
          onBack={() => {
            setView('home')
            void refreshList()
          }}
          draft={draft}
          onDraft={(n, id, opts) => {
            const target = id ?? sel
            if (!target || !doc?.nodes[target]) return
            const clean = sanitizeDraft(doc.nodes[target], n) as DesignNode
            if (opts?.history !== false) {
              setPast((p) => pushUndo(p, mergedOverlay))
              setFuture([])
            }
            setOverlay((o) => ({ ...o, [target]: clean }))
            setSel(target)
            setDraft(clean)
          }}
          dirty={dirty}
          onSave={() => void save()}
          onDiscard={discard}
          onExport={exportMark}
          canUndo={past.length > 0}
          canRedo={future.length > 0}
          onUndo={undo}
          onRedo={redo}
          page={page}
          onPage={setPage}
          commentText={commentText}
          onComment={setCommentText}
          onPinComment={() => void pinComment()}
        />
      )}
    </div>
  )
}

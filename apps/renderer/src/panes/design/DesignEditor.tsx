import { useEffect, useRef, useState } from 'react'
import type { DesignIR, DesignNode } from '@homeai/core'
import Inspector, { type EditTab } from './Inspector'
import PhoneCanvas, { INITIAL_SHOP, type ShopState } from './PhoneCanvas'
import IrCanvas from './IrCanvas'
import { useWorkbench } from '../../store/useWorkbench'
import { canvasPins, designSlug, designMind } from '@homeai/runtime/browser'
import { HxEmpty } from '../../layout/HxPage'

export type CanvasMode = 'select' | 'hand' | 'comment' | 'edit'
export type Tool = 'select' | 'hand' | 'text' | 'frame' | 'rect' | 'ellipse' | 'line' | 'pen'

export default function DesignEditor(props: {
  doc: DesignIR | null
  slug: string
  projects?: Array<{ slug: string; name: string }>
  onOpenProject?: (slug: string) => void
  shop: boolean
  generating?: boolean
  sel: string | null
  onSel: (id: string | null) => void
  title: string
  onBack: () => void
  draft: DesignNode | null
  onDraft: (n: DesignNode, id?: string, opts?: { history?: boolean }) => void
  dirty: boolean
  onSave: () => void
  onDiscard: () => void
  onExport: (opts?: { scale: 1 | 2; format: 'png' | 'svg' }) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  page: string
  onPage: (id: string) => void
  commentText: string
  onComment: (s: string) => void
  onPinComment: () => void
}) {
  const w = useWorkbench()
  const [mode, setMode] = useState<CanvasMode>('edit')
  const [tab, setTab] = useState<EditTab>('simple')
  const [tool, setTool] = useState<Tool>('select')
  const [zoom, setZoom] = useState(100)
  const [present, setPresent] = useState(false)
  const [presentMenu, setPresentMenu] = useState(false)
  const [share, setShare] = useState('')
  const [shop, setShop] = useState<ShopState>(INITIAL_SHOP)
  const [tweak, setTweak] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [chat, setChat] = useState('')
  const [tip, setTip] = useState<string | null>(null)
  const [help, setHelp] = useState(false)
  const [titleOpen, setTitleOpen] = useState(false)
  const [hideInspector, setHideInspector] = useState(false)
  const [layerQ, setLayerQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const pages = (props.doc?.pages ?? []).slice(0, 16)
  const pins = canvasPins(props.doc?.comments, props.doc?.nodes)

  const kickDesign = (task: string) => {
    const mind = designMind(w.provider)
    useWorkbench.setState({ agentMode: 'agent', provider: mind, chatOpen: true })
    useWorkbench.getState().setActivity('design')
    useWorkbench.getState().run(task, { provider: mind, needsTools: true })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) props.onRedo()
        else props.onUndo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        props.onRedo()
        return
      }
      if (e.key === 'v' || e.key === 'V') {
        setTool('select')
        setMode('select')
      }
      if (e.key === 'h' || e.key === 'H') {
        setTool('hand')
        setMode('hand')
      }
      if (e.key === 't' || e.key === 'T') {
        setTool('text')
        setMode('edit')
      }
      if (e.key === 'c' || e.key === 'C') {
        setMode('comment')
        setTool('select')
      }
      if (e.key === 'Escape') {
        setPresent(false)
        setPresentMenu(false)
        if (document.fullscreenElement) void document.exitFullscreen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props])

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setPresent(false)
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const interact = (mode === 'hand' || tool === 'hand') && mode !== 'comment'
  const editing = mode === 'edit'

  return (
    <div className={`cd-editor ${present ? 'present' : ''} ${editing && hideInspector ? 'no-inspect' : ''}`} ref={stageRef}>
      <header className="cd-appbar">
        <button type="button" className="cd-mark" onClick={props.onBack} aria-label="Projects" title="Projects">
          ◐
        </button>
        <div className="cd-title-wrap">
          <button type="button" className="cd-title-dd" onClick={() => setTitleOpen((v) => !v)}>
            {props.title}
            <span>▾</span>
          </button>
          {titleOpen ? (
            <div className="cd-menu cd-title-menu">
              {(props.projects ?? []).slice(0, 16).map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  className={p.slug === props.slug ? 'on' : ''}
                  onClick={() => {
                    props.onOpenProject?.(p.slug)
                    setTitleOpen(false)
                  }}
                >
                  {p.name || p.slug}
                </button>
              ))}
              <button type="button" onClick={() => { props.onBack(); setTitleOpen(false) }}>
                All projects
              </button>
            </div>
          ) : null}
        </div>
        <span className="spacer" />
        <button
          type="button"
          className={`cd-ico-btn ${hideInspector ? '' : 'on'}`}
          aria-label="Layout"
          title="Toggle inspector"
          onClick={() => setHideInspector((v) => !v)}
        >
          ▤
        </button>
        <button
          type="button"
          className="cd-ico-btn"
          aria-label="Search"
          title="Search layers"
          onClick={() => {
            setSearchOpen(true)
            setMode('edit')
            setTab('pro')
            setHideInspector(false)
            window.setTimeout(() => searchRef.current?.focus(), 0)
          }}
        >
          ⌕
        </button>
        {searchOpen ? (
          <input
            ref={searchRef}
            className="cd-layer-q"
            value={layerQ}
            placeholder="Search layers"
            onChange={(e) => setLayerQ(e.target.value.replace(/[<>]/g, '').slice(0, 80))}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchOpen(false)
                setLayerQ('')
              }
            }}
          />
        ) : null}
        <button type="button" className="cd-ico-btn" aria-label="Help" onClick={() => setHelp((v) => !v)}>
          ?
        </button>
      </header>

      <div className="cd-body">
        {editing && !hideInspector ? (
          <Inspector
            tab={tab}
            onTab={setTab}
            doc={props.doc}
            sel={props.sel}
            onSel={(id) => props.onSel(id)}
            draft={props.draft}
            onDraft={props.onDraft}
            dirty={props.dirty}
            onSave={props.onSave}
            onDiscard={props.onDiscard}
            onExport={props.onExport}
            tweak={tweak}
            onTweak={setTweak}
            onTweakGo={() => {
              kickDesign(
                tweak.trim()
                  ? `DesignIR tweak for slug "${props.slug}" (design_get/design_patch with id "${props.slug}", no HTML): ${tweak.trim().slice(0, 400)}`
                  : `Read design_get id "${props.slug}". Propose three named density/color tweaks as design_patch ops under /tokens. Pass id "${props.slug}". No HTML.`
              )
            }}
            collapsed={collapsed}
            onToggle={(k) => setCollapsed((c) => ({ ...c, [k]: !c[k] }))}
            patching={Boolean(props.generating)}
            onToggleVisible={(id) => {
              const n = props.doc?.nodes[id]
              if (!n) return
              props.onDraft({ ...n, visible: n.visible === false }, id)
            }}
            layerQ={layerQ}
          />
        ) : (
          <aside className="cd-chat">
            <h3>{props.title}</h3>
            <p className="cd-chat-note">Comment on a node, or describe a change. Inspector edits stay local.</p>
            <ul className="cd-todos">
              <li>Pin comments on the canvas</li>
              <li>Edit in Simple / Pro / Code</li>
            </ul>
            <textarea value={chat} placeholder="Describe what you want to create..." onChange={(e) => setChat(e.target.value.slice(0, 2000))} />
            <button
              type="button"
              className="cd-save"
              onClick={() => {
                if (!chat.trim()) return
                kickDesign(
                  `DesignIR slug "${props.slug}" (design_get then design_patch with id "${props.slug}", no HTML): ${chat.trim().slice(0, 800)}`
                )
                setChat('')
              }}
            >
              Send
            </button>
          </aside>
        )}

        <section className="cd-canvas-col">
          <div className="cd-canvas-bar">
            <div className="cd-page-wrap">
            <select
              className="cd-page-sel"
              value={props.page}
              onChange={(e) => props.onPage(e.target.value)}
            >
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="cd-page-n">{pages.length} pages</span>
            </div>
            <span className="spacer" />
            <span className="cd-zoom">{zoom}%</span>
            <div className="cd-tools">
              <button type="button" className={mode === 'select' || tool === 'select' ? 'on' : ''} aria-label="Select" title="Select" onClick={() => { setTool('select'); setMode('select') }}>
                ↖
              </button>
              <button
                type="button"
                className={mode === 'hand' || tool === 'hand' ? 'on' : ''}
                aria-label="Hand"
                title="Click through (interact with the page) H"
                onMouseEnter={() => setTip('hand')}
                onMouseLeave={() => setTip(null)}
                onClick={() => {
                  setTool('hand')
                  setMode('hand')
                }}
              >
                ✋
              </button>
              <button
                type="button"
                className={mode === 'comment' ? 'on' : ''}
                aria-label="Comment"
                title="Comment"
                onMouseEnter={() => setTip('comment')}
                onMouseLeave={() => setTip(null)}
                onClick={() => {
                  setMode('comment')
                  setTool('select')
                }}
              >
                💬
              </button>
              <button
                type="button"
                className={tool === 'text' ? 'on' : ''}
                aria-label="Text"
                title="Text T"
                onMouseEnter={() => setTip('text')}
                onMouseLeave={() => setTip(null)}
                onClick={() => {
                  setTool('text')
                  setMode('edit')
                }}
              >
                T
              </button>
              <button type="button" className={mode === 'edit' ? 'on' : ''} aria-label="Edit" title="Edit" onClick={() => setMode('edit')}>
                ✎
              </button>
            </div>
            {tip === 'comment' && mode !== 'comment' ? <div className="cd-tip">Point at elements and tell Hex AI what to change.</div> : null}
            {tip === 'hand' ? <div className="cd-tip">Click through (interact with the page) H</div> : null}
            {tip === 'text' ? <div className="cd-tip">Text T</div> : null}
            <div className="cd-present-wrap">
              <button type="button" className="cd-present" onClick={() => setPresentMenu((v) => !v)}>
                Present ▾
              </button>
              {presentMenu ? (
                <div className="cd-menu">
                  <button type="button" onClick={() => { setPresent(true); setPresentMenu(false); setMode('hand') }}>
                    In this window
                  </button>
                  <button type="button" onClick={() => { setPresent(true); setPresentMenu(false); setMode('hand'); void stageRef.current?.requestFullscreen?.() }}>
                    Fullscreen
                  </button>
                  <button type="button" className="cd-tool-off" disabled title="New window stays chrome — present in this window">
                    New window
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="cd-share"
              onClick={() => {
                const s = designSlug(props.slug)
                if (!s) {
                  setShare('No link')
                  return
                }
                void navigator.clipboard?.writeText(`homeai://design/${s}`)
                setShare('Link copied')
              }}
            >
              Share
            </button>
          </div>

          {editing ? (
            <>
            <div className="cd-mini-tools">
              <button type="button" className="cd-hist" disabled={!props.canUndo} aria-label="Undo" title="Undo" onClick={props.onUndo}>
                ↶
              </button>
              <button type="button" className="cd-hist" disabled={!props.canRedo} aria-label="Redo" title="Redo" onClick={props.onRedo}>
                ↷
              </button>
              {(['select', 'hand', 'text', 'frame', 'rect', 'ellipse', 'line', 'pen'] as const).map((k) => {
                const live = k === 'select' || k === 'hand' || k === 'text'
                return (
                <button
                  key={k}
                  type="button"
                  className={`${tool === k ? 'on' : ''}${live ? '' : ' cd-tool-off'}`.trim()}
                  disabled={!live}
                  aria-label={live ? (k === 'hand' ? 'Hand' : k === 'text' ? 'Text' : k === 'select' ? 'Select' : k) : `${k} stays chrome`}
                  title={
                    live
                      ? k === 'hand'
                        ? 'Click through (interact with the page) H'
                        : k === 'text'
                          ? 'Text T'
                          : 'Select V'
                      : 'Frame, rect, ellipse, line, and pen stay chrome. Hex AI draws from the brief.'
                  }
                  onMouseEnter={() => setTip(k === 'hand' ? 'hand' : k === 'text' ? 'text' : k === 'select' ? null : tip)}
                  onMouseLeave={() => setTip(null)}
                  onClick={() => {
                    if (!live) return
                    setTool(k)
                    if (k === 'hand') setMode('hand')
                    if (k === 'select') setMode('select')
                    if (k === 'text') setMode('edit')
                  }}
                >
                  {k === 'select' ? '↖' : k === 'hand' ? '✋' : k === 'text' ? 'T' : k === 'frame' ? '#' : k === 'rect' ? '▭' : k === 'ellipse' ? '○' : k === 'line' ? '/' : '✎'}
                </button>
                )
              })}
              <span className="cd-zoom">{zoom}%</span>
              <input type="range" min={50} max={150} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
            </div>
            <p className="cd-tool-hint">Frame, rect, ellipse, line, and pen stay chrome. Hex AI draws from the brief.</p>
            </>
          ) : null}

          {props.generating ? <div className="cd-gen">Designing screens… pages update as patches land.</div> : null}

          {mode === 'comment' && props.sel ? (
            <div className="cd-comment-box">
              <textarea value={props.commentText} placeholder="Comment on this element..." onChange={(e) => props.onComment(e.target.value.slice(0, 500))} />
              <button type="button" className="cd-save" onClick={props.onPinComment}>
                Pin
              </button>
            </div>
          ) : null}

          <div className="cd-stage" style={{ zoom: zoom / 100 }}>
            <div className={props.shop || props.doc?.artifact.profile === 'ui.mobile' ? 'cd-device' : 'cd-board'}>
              {props.shop ? (
                <PhoneCanvas
                  doc={props.doc}
                  sel={props.sel}
                  onSel={props.onSel}
                  page={props.page}
                  onPage={props.onPage}
                  interact={interact}
                  shop={shop}
                  setShop={setShop}
                  commentMode={mode === 'comment'}
                  textTool={tool === 'text'}
                  onDraft={props.onDraft}
                  pins={pins}
                />
              ) : (
                <IrCanvas
                  doc={props.doc}
                  sel={props.sel}
                  onSel={props.onSel}
                  page={props.page}
                  interact={interact}
                  commentMode={mode === 'comment'}
                  textTool={tool === 'text'}
                  onDraft={props.onDraft}
                  pins={pins}
                />
              )}
            </div>
          </div>
          {pages.length ? (
            <div className="cd-film" role="tablist" aria-label="Designed screens">
              {pages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  className={props.page === p.id ? 'on' : ''}
                  onClick={() => props.onPage(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="cd-film">
              <HxEmpty compact title="No screens yet" body="Screens appear here as design_patch grows the IR." />
            </div>
          )}
          {share ? <div className="cd-toast">{share}</div> : null}
          {help ? (
            <div className="cd-help">
              <p>Prompt on home, then ↑. The AI patches DesignIR. Watch pages appear. Select, Comment, Text T, or Hand H to click through.</p>
              <p>Quokka Shop is one sample project. A new brief gets its own screens.</p>
              <button type="button" className="cd-text-btn" onClick={() => setHelp(false)}>
                Close
              </button>
            </div>
          ) : null}
          {present ? (
            <button type="button" className="cd-exit-present" onClick={() => { setPresent(false); if (document.fullscreenElement) void document.exitFullscreen() }}>
              Exit present
            </button>
          ) : null}
        </section>
      </div>
    </div>
  )
}

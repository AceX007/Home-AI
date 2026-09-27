import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DesignIR, DesignNode } from '@homeai/core'
import { parseCssDeclarations, styleToCss } from './cssSafe'
import { layerRows, rememberCssDraft, stripActivityText } from '@homeai/runtime/browser'
import { HxEmpty } from '../../layout/HxPage'

export type EditTab = 'simple' | 'pro' | 'code' | 'tweaks'

type Lay = NonNullable<DesignNode['layout']>

const DISPLAY = ['flex', 'block', 'none', 'grid'] as const
const DIRS = ['column', 'row', 'column-reverse', 'row-reverse'] as const

function n(v: unknown, d = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d
}

export default function Inspector(props: {
  tab: EditTab
  onTab: (t: EditTab) => void
  doc: DesignIR | null
  sel: string | null
  onSel: (id: string) => void
  draft: DesignNode | null
  onDraft: (n: DesignNode, id?: string) => void
  dirty: boolean
  onSave: () => void
  onDiscard: () => void
  onExport: (opts?: { scale: 1 | 2; format: 'png' | 'svg' }) => void
  tweak: string
  onTweak: (s: string) => void
  onTweakGo: () => void
  collapsed: Record<string, boolean>
  onToggle: (k: string) => void
  onToggleVisible?: (id: string) => void
  patching?: boolean
  layerQ?: string
}) {
  const { tab, onTab, doc, sel, draft, onDraft, dirty, onSave, onDiscard, onExport } = props
  const node = draft
  const lay: Lay = node?.layout ?? {}
  const style = node?.style ?? {}
  const advanced = useMemo(() => {
    const st = style && typeof style === 'object' ? style : {}
    return Object.keys(st)
      .filter((k) => Object.prototype.hasOwnProperty.call(st, k))
      .filter(
        (k) =>
          k.includes('overflow') ||
          k === 'flex' ||
          k === 'cursor' ||
          k === 'class' ||
          k.startsWith('grid') ||
          k.includes('scrollbar') ||
          k === 'pointer-events' ||
          k === 'object-fit' ||
          k === 'white-space' ||
          k === 'text-overflow' ||
          k === 'box-sizing' ||
          k === 'aspect-ratio' ||
          k === 'backdrop-filter' ||
          k === 'transition' ||
          k === 'animation' ||
          k === 'text-decoration-color'
      )
      .map((k) => [k, st[k as keyof typeof st]] as const)
  }, [style])

  const setLay = (patch: Partial<Lay>) => {
    if (!node || props.patching) return
    onDraft({ ...node, layout: { ...lay, ...patch } })
  }
  const setStyle = (k: string, v: string) => {
    if (!node || props.patching) return
    onDraft({ ...node, style: { ...style, [k]: v } })
  }
  const css = styleToCss(style, node?.attrs)
  const [cssErr, setCssErr] = useState('')
  const [cssDraft, setCssDraft] = useState(css)
  const cssMapRef = useRef<Record<string, string>>(Object.create(null))
  const cssLiveRef = useRef(cssDraft)
  const selRef = useRef(sel)
  cssLiveRef.current = cssDraft
  const [exScale, setExScale] = useState<'1x' | '2x'>('2x')
  const [exFmt, setExFmt] = useState<'PNG' | 'SVG'>('PNG')
  useEffect(() => {
    const { map, css: nextCss } = rememberCssDraft(
      cssMapRef.current,
      selRef.current,
      sel,
      cssLiveRef.current,
      styleToCss(node?.style, node?.attrs)
    )
    cssMapRef.current = map
    selRef.current = sel
    setCssDraft(nextCss)
    setCssErr('')
  }, [sel])

  return (
    <div className="cd-inspect">
      {sel ? <div className="cd-crumb">{sel.split('.').map((p) => p.replace(/[<>]/g, '')).join(' › ')}</div> : null}
      {props.patching ? <div className="cd-lock">agent patching · inspector locked</div> : null}
      {node && (JSON.stringify(style).includes('url(') || (node.id && !/^[\w.-]{1,64}$/.test(node.id))) ? (
        <div className="cd-warn">constraint: no url() · id [w.-] only</div>
      ) : null}
      <div className="cd-edit-bar">
        <span>Edit</span>
        <div>
          <button type="button" className="cd-text-btn" disabled={!dirty} onClick={onDiscard}>
            Discard
          </button>
          <button type="button" className="cd-save" disabled={!dirty} onClick={onSave}>
            Save
          </button>
        </div>
      </div>
      <div className="cd-tabs">
        {(['simple', 'pro', 'code', 'tweaks'] as const).map((k) => (
          <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => onTab(k)}>
            {k === 'simple' ? 'Simple' : k === 'pro' ? 'Pro' : k === 'code' ? 'Code' : 'Tweaks'}
          </button>
        ))}
      </div>

      {tab === 'pro' || tab === 'code' ? (
        <LayerTree doc={doc} sel={sel} onSel={props.onSel} onToggleVisible={props.onToggleVisible} q={props.layerQ} />
      ) : null}

      {tab === 'tweaks' ? (
        <div className="cd-tweaks">
          <p>This design has no tweakable controls yet — describe what you want to adjust and Hex AI will add a tweaks panel when the patch lands.</p>
          <div className="cd-tweak-row">
            <input value={props.tweak} placeholder="Describe a tweak..." onChange={(e) => props.onTweak(e.target.value.slice(0, 500))} />
            <button type="button" className="cd-ideas" onClick={props.onTweakGo}>
              Ideas
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'code' ? (
        node ? (
        <div className="cd-code">
          <textarea
            value={cssDraft}
            spellCheck={false}
            onChange={(e) => {
              const src = e.target.value.slice(0, 4000)
              setCssDraft(src)
              try {
                const { style: st, attrs } = parseCssDeclarations(src)
                setCssErr('')
                if (node) onDraft({ ...node, style: st, attrs: Object.keys(attrs).length ? attrs : node.attrs })
              } catch (err) {
                setCssErr(err instanceof Error ? err.message : 'css')
              }
            }}
          />
          <p className="cd-hint">One declaration per line; @name edits an attribute.</p>
          {cssErr ? <p className="cd-err">{cssErr}</p> : null}
        </div>
        ) : (
          <HxEmpty
            compact
            title="Select a layer"
            body="Code edits one node's allowlisted CSS. Pick a layer on the canvas or in the tree."
          />
        )
      ) : null}

      {tab === 'simple' || tab === 'pro' ? (
        node ? (
        <div className="cd-props">
          <Section title="Appearance" k="app" collapsed={props.collapsed} onToggle={props.onToggle}>
            <label>
              Background
              <select value={style.background ?? 'none'} onChange={(e) => setStyle('background', e.target.value)}>
                <option value="none">None</option>
                <option value="#000000">Black</option>
                <option value="#1a1a1a">Charcoal</option>
                <option value="#32d74b">Accent</option>
              </select>
            </label>
            <div className="cd-row2">
              <label>
                Radius
                <input type="number" min={0} max={48} value={n(lay.radius, Number.parseInt(style['border-radius'] || '0', 10) || 0)} onChange={(e) => setLay({ radius: Number(e.target.value) })} />
                <span>px</span>
              </label>
              <label>
                Overflow
                <select value={style.overflow ?? 'visible'} onChange={(e) => setStyle('overflow', e.target.value)}>
                  <option>visible</option>
                  <option>hidden</option>
                  <option>auto</option>
                </select>
              </label>
            </div>
            <label>
              Opacity
              <input type="number" min={0} max={1} step={0.01} value={n(lay.opacity, Number(style.opacity ?? 1))} onChange={(e) => setLay({ opacity: Number(e.target.value) })} />
            </label>
            <p className="cd-add">
              Add:{' '}
              <button type="button" onClick={() => setStyle('box-sizing', 'border-box')}>
                box-sizing
              </button>
              ·
              <button type="button" onClick={() => setStyle('text-decoration-color', 'rgb(240, 241, 245)')}>
                text-decoration
              </button>
              ·
              <button type="button" onClick={() => setStyle('transition', 'none')}>
                transition
              </button>
              ·
              <button type="button" onClick={() => setStyle('backdrop-filter', 'none')}>
                filter
              </button>
            </p>
          </Section>

          {tab === 'pro' ? (
            <>
              <Section title="Sizing" k="size" collapsed={props.collapsed} onToggle={props.onToggle} extra={<button type="button" className="cd-text-btn" onClick={() => setLay({ widthMode: 'hug', heightMode: 'hug' })}>Reset</button>}>
                <ModeRow
                  label="Width"
                  value={n(lay.width, 334)}
                  mode={lay.widthMode ?? 'fixed'}
                  onVal={(width) => setLay({ width, widthMode: 'fixed' })}
                  onMode={(widthMode) => setLay({ widthMode })}
                />
                <ModeRow
                  label="Height"
                  value={n(lay.height, 748)}
                  mode={lay.heightMode ?? 'fixed'}
                  onVal={(height) => setLay({ height, heightMode: 'fixed' })}
                  onMode={(heightMode) => setLay({ heightMode })}
                />
                <p className="cd-add">
                  <label>
                    Min W
                    <input
                      type="number"
                      min={0}
                      max={4000}
                      value={Number.parseInt(style['min-width'] || '0', 10) || 0}
                      onChange={(e) => setStyle('min-width', `${Math.min(4000, Math.max(0, Number(e.target.value) || 0))}px`)}
                    />
                  </label>
                  <label>
                    Max W
                    <input
                      type="number"
                      min={0}
                      max={4000}
                      value={Number.parseInt(style['max-width'] || '0', 10) || 0}
                      onChange={(e) => setStyle('max-width', `${Math.min(4000, Math.max(0, Number(e.target.value) || 0))}px`)}
                    />
                  </label>
                </p>
              </Section>
              <Section title="Position" k="pos" collapsed={props.collapsed} onToggle={props.onToggle}>
                <Seg
                  value={lay.position ?? 'inline'}
                  opts={[
                    ['inline', 'Inline'],
                    ['absolute', 'Absolute']
                  ]}
                  on={ (position) => setLay({ position: position as Lay['position'] })}
                />
                <p className="cd-add">
                  {lay.position === 'absolute' ? (
                    <span className="cd-row2">
                      <label>
                        X
                        <input type="number" min={-4000} max={4000} value={n(lay.offX)} onChange={(e) => setLay({ offX: Math.min(4000, Math.max(-4000, Number(e.target.value) || 0)) })} />
                      </label>
                      <label>
                        Y
                        <input type="number" min={-4000} max={4000} value={n(lay.offY)} onChange={(e) => setLay({ offY: Math.min(4000, Math.max(-4000, Number(e.target.value) || 0)) })} />
                      </label>
                    </span>
                  ) : (
                    'Offset when Absolute'
                  )}
                </p>
              </Section>
              <Section title="Contents layout" k="flex" collapsed={props.collapsed} onToggle={props.onToggle}>
                <label>
                  Display
                  <select value={style.display ?? 'flex'} onChange={(e) => setStyle('display', e.target.value)}>
                    {DISPLAY.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <div className="cd-icon-row">
                  {DIRS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      title={d}
                      className={(style['flex-direction'] ?? 'column') === d ? 'on' : ''}
                      onClick={() => setStyle('flex-direction', d)}
                    >
                      {d.startsWith('column') ? '↓' : '→'}
                    </button>
                  ))}
                </div>
                <label>
                  Wrap
                  <select value={style['flex-wrap'] ?? 'nowrap'} onChange={(e) => setStyle('flex-wrap', e.target.value)}>
                    <option>nowrap</option>
                    <option>wrap</option>
                  </select>
                </label>
                <p className="cd-lab">Justify</p>
                <div className="cd-icon-row">
                  {['flex-start', 'center', 'flex-end', 'space-between', 'space-around'].map((j) => (
                    <button key={j} type="button" className={(style['justify-content'] ?? 'center') === j ? 'on' : ''} onClick={() => setStyle('justify-content', j)}>
                      ▦
                    </button>
                  ))}
                </div>
                <p className="cd-lab">Align</p>
                <div className="cd-icon-row">
                  {['flex-start', 'center', 'flex-end', 'stretch'].map((j) => (
                    <button key={j} type="button" className={(style['align-items'] ?? 'center') === j ? 'on' : ''} onClick={() => setStyle('align-items', j)}>
                      ▤
                    </button>
                  ))}
                </div>
                <label>
                  Gap
                  <input type="number" min={0} max={80} value={n(lay.gap, Number.parseInt(style.gap || '0', 10) || 0)} onChange={(e) => setLay({ gap: Number(e.target.value) })} />
                </label>
              </Section>
              <Section title="Padding" k="pad" collapsed={props.collapsed} onToggle={props.onToggle}>
                <Seg
                  value={lay.padMode ?? 'xy'}
                  opts={[
                    ['none', 'None'],
                    ['all', 'All'],
                    ['xy', 'X & Y'],
                    ['individual', 'Individual']
                  ]}
                  on={(padMode) => setLay({ padMode: padMode as Lay['padMode'] })}
                />
                {(lay.padMode ?? 'xy') === 'xy' ? (
                  <div className="cd-row2">
                    <label>
                      Vertical
                      <input type="number" min={0} max={4000} value={n(lay.padV)} onChange={(e) => setLay({ padV: Math.min(4000, Math.max(0, Number(e.target.value) || 0)) })} />
                    </label>
                    <label>
                      Horizontal
                      <input type="number" min={0} max={4000} value={n(lay.padH, 28)} onChange={(e) => setLay({ padH: Math.min(4000, Math.max(0, Number(e.target.value) || 0)) })} />
                    </label>
                  </div>
                ) : null}
                {lay.padMode === 'all' ? (
                  <label>
                    All
                    <input type="number" min={0} max={4000} value={n(lay.padT)} onChange={(e) => setLay({ padT: Math.min(4000, Math.max(0, Number(e.target.value) || 0)) })} />
                  </label>
                ) : null}
                {lay.padMode === 'individual' ? (
                  <div className="cd-row2">
                    {(['padT', 'padR', 'padB', 'padL'] as const).map((k) => (
                      <label key={k}>
                        {k.slice(3)}
                        <input type="number" min={0} max={4000} value={n(lay[k])} onChange={(e) => setLay({ [k]: Math.min(4000, Math.max(0, Number(e.target.value) || 0)) })} />
                      </label>
                    ))}
                  </div>
                ) : null}
              </Section>
              <Section title="Margin" k="mar" collapsed={props.collapsed} onToggle={props.onToggle}>
                <Seg
                  value={lay.marginMode ?? 'none'}
                  opts={[
                    ['none', 'None'],
                    ['all', 'All'],
                    ['xy', 'X & Y'],
                    ['individual', 'Individual']
                  ]}
                  on={(marginMode) => setLay({ marginMode: marginMode as Lay['marginMode'] })}
                />
                {lay.marginMode === 'xy' ? (
                  <div className="cd-row2">
                    <label>
                      Vertical
                      <input type="number" min={0} max={4000} value={n(lay.marV)} onChange={(e) => setLay({ marV: Math.min(4000, Math.max(0, Number(e.target.value) || 0)) })} />
                    </label>
                    <label>
                      Horizontal
                      <input type="number" min={0} max={4000} value={n(lay.marH)} onChange={(e) => setLay({ marH: Math.min(4000, Math.max(0, Number(e.target.value) || 0)) })} />
                    </label>
                  </div>
                ) : null}
                {lay.marginMode === 'all' ? (
                  <label>
                    All
                    <input type="number" min={0} max={4000} value={n(lay.marT)} onChange={(e) => setLay({ marT: Math.min(4000, Math.max(0, Number(e.target.value) || 0)) })} />
                  </label>
                ) : null}
                {lay.marginMode === 'individual' ? (
                  <div className="cd-row2">
                    {(['marT', 'marR', 'marB', 'marL'] as const).map((k) => (
                      <label key={k}>
                        {k.slice(3)}
                        <input type="number" min={0} max={4000} value={n(lay[k])} onChange={(e) => setLay({ [k]: Math.min(4000, Math.max(0, Number(e.target.value) || 0)) })} />
                      </label>
                    ))}
                  </div>
                ) : null}
              </Section>
            </>
          ) : null}

          <Section title="Border" k="bor" collapsed={props.collapsed} onToggle={props.onToggle} extra={<button type="button" className="cd-text-btn" onClick={() => setStyle('border', '1px solid #2c2c2c')}>Add border</button>}>
            <div className="cd-row2">
              <label>
                Width
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={Number((style.border || '').match(/^(\d+)/)?.[1] || 0)}
                  onChange={(e) => {
                    const w = Math.min(24, Math.max(0, Number(e.target.value) || 0))
                    const col = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(style['border-color'] || '')
                      ? style['border-color']
                      : '#2c2c2c'
                    setStyle('border', w === 0 ? 'none' : `${w}px solid ${col}`)
                  }}
                />
              </label>
              <label>
                Color
                <input
                  value={style['border-color'] || '#2c2c2c'}
                  onChange={(e) => {
                    const col = e.target.value
                    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(col) || !node) return
                    const w = Number((style.border || '').match(/^(\d+)/)?.[1] || 1)
                    onDraft({
                      ...node,
                      style: { ...style, border: `${Math.min(24, Math.max(1, w))}px solid ${col}`, 'border-color': col }
                    })
                  }}
                />
              </label>
            </div>
          </Section>

          {tab === 'pro' ? (
            <Section title="Advanced" k="adv" collapsed={props.collapsed} onToggle={props.onToggle}>
              {advanced.map(([k, v]) => (
                <div key={k} className="cd-pill-row">
                  <i className="cd-dot" />
                  <span>{k}</span>
                  <code>{v}</code>
                </div>
              ))}
              {node?.attrs?.class ? (
                <div className="cd-pill-row">
                  <i className="cd-dot" />
                  <span>class</span>
                  <code>{node.attrs.class}</code>
                </div>
              ) : null}
            </Section>
          ) : null}

          <Section title="Export selection" k="exp" collapsed={props.collapsed} onToggle={props.onToggle}>
            <div className="cd-export-preview">
              <div className="qs-logo mini">{(doc?.artifact.name || 'D').replace(/[<>]/g, '').slice(0, 1) || 'D'}</div>
              <span>{(doc?.artifact.name || 'Selection').replace(/[<>]/g, '').slice(0, 40)}</span>
            </div>
            <div className="cd-row2">
              <label>
                Format
                <select value={exFmt} onChange={(e) => setExFmt(e.target.value === 'SVG' ? 'SVG' : 'PNG')}>
                  <option>PNG</option>
                  <option>SVG</option>
                </select>
              </label>
              <label>
                Scale
                <select value={exScale} onChange={(e) => setExScale(e.target.value === '1x' ? '1x' : '2x')}>
                  <option>1x</option>
                  <option>2x</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              className="cd-export"
              onClick={() => onExport({ scale: exScale === '1x' ? 1 : 2, format: exFmt === 'SVG' ? 'svg' : 'png' })}
            >
              Export {exFmt}
            </button>
          </Section>

          <Section title="Debug" k="dbg" collapsed={props.collapsed} onToggle={props.onToggle}>
            <pre className="cd-debug">
              {JSON.stringify(
                node
                  ? {
                      tid: node.tid ?? 0,
                      tag: node.tag ?? 'div',
                      parent: node.parent ?? 'div',
                      attrs: node.attrs ?? {},
                      style: css.replace(/\n/g, '')
                    }
                  : {},
                null,
                2
              )}
            </pre>
          </Section>
        </div>
        ) : (
          <HxEmpty
            compact
            title="Select a layer"
            body="Click a node on the canvas or in the Pro tree. Inspector edits stay local."
          />
        )
      ) : null}
    </div>
  )
}

function Section(props: {
  title: string
  k: string
  collapsed: Record<string, boolean>
  onToggle: (k: string) => void
  extra?: ReactNode
  children?: ReactNode
}) {
  const open = !props.collapsed[props.k]
  return (
    <section className="cd-sec">
      <header>
        <button type="button" onClick={() => props.onToggle(props.k)}>
          {open ? '▾' : '▸'} {props.title}
        </button>
        {props.extra}
      </header>
      {open ? props.children : null}
    </section>
  )
}

function Seg({
  value,
  opts,
  on
}: {
  value: string
  opts: Array<[string, string]>
  on: (v: string) => void
}) {
  return (
    <div className="cd-seg">
      {opts.map(([v, lab]) => (
        <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => on(v)}>
          {lab}
        </button>
      ))}
    </div>
  )
}

function ModeRow({
  label,
  value,
  mode,
  onVal,
  onMode
}: {
  label: string
  value: number
  mode: string
  onVal: (n: number) => void
  onMode: (m: Lay['widthMode']) => void
}) {
  return (
    <div className="cd-mode-row">
      <span>{label}</span>
      <input type="number" value={value} onChange={(e) => onVal(Number(e.target.value))} />
      <span>px</span>
      <div className="cd-seg sm">
        {(['hug', 'fixed', 'fill'] as const).map((m) => (
          <button key={m} type="button" className={mode === m ? 'on' : ''} onClick={() => onMode(m)}>
            {m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )
}

function LayerTree({
  doc,
  sel,
  onSel,
  onToggleVisible,
  q
}: {
  doc: DesignIR | null
  sel: string | null
  onSel: (id: string) => void
  onToggleVisible?: (id: string) => void
  q?: string
}) {
  if (!doc || !doc.nodes || typeof doc.nodes !== 'object') {
    return (
      <HxEmpty compact title="No layers yet" body="Screens appear as design_patch lands. Layer names stay text." />
    )
  }
  const rows = layerRows(doc.nodes)
  const needle = String(q || '').trim().toLowerCase()
  const shown = rows.filter(({ id }) => {
    const n = doc.nodes[id]
    if (!n) return false
    const label = stripActivityText(n.text || id, 80)
    if (needle && !label.toLowerCase().includes(needle) && !id.toLowerCase().includes(needle)) return false
    return true
  })
  if (!shown.length) {
    return (
      <HxEmpty
        compact
        title={needle ? 'No layers match' : 'No layers yet'}
        body="Pick a node on the canvas after screens land. The filter stays text, not HTML."
      />
    )
  }
  return (
    <div className="cd-tree">
      {shown.map(({ id, depth }) => {
        const n = doc.nodes[id]
        if (!n) return null
        const label = stripActivityText(n.text || id, 80)
        return (
        <div key={id} className={`cd-tree-row ${sel === id ? 'on' : ''}`} style={{ paddingLeft: 8 + depth * 12 }}>
          <button type="button" className="cd-tree-name" onClick={() => onSel(id)}>
            {label}
          </button>
          {n.type === 'conditional' || n.visible === false ? (
            <button type="button" className="cd-vis" onClick={() => onToggleVisible?.(id)}>
              {n.visible === false ? 'off' : 'on'}
            </button>
          ) : null}
          <code>{n.tag || n.type}</code>
        </div>
        )
      })}
    </div>
  )
}

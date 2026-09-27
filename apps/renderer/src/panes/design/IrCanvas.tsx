import type { CSSProperties, ElementType } from 'react'
import type { DesignIR, DesignLayout, DesignNode } from '@homeai/core'
import { useRef, useState } from 'react'
import { nodeReactStyle } from './cssSafe'
import { layerRows, pinCaption } from '@homeai/runtime/browser'
import SelFrame from './SelFrame'
import { HxEmpty } from '../../layout/HxPage'

const HTML_TAGS = new Set(['div', 'span', 'button', 'p', 'h1', 'h2'])
const NODE_ID = /^[\w.-]{1,80}$/

function tagOf(n: DesignNode): ElementType {
  const t = n.tag
  if (typeof t === 'string' && HTML_TAGS.has(t)) return t as ElementType
  return 'div'
}

function onThisPage(n: DesignNode, page: string, fallback: string): boolean {
  if (typeof n.page === 'string' && n.page) return n.page === page
  return page === fallback
}

function IrNode({
  id,
  nodes,
  interact,
  commentMode,
  onPick
}: {
  id: string
  nodes: Record<string, DesignNode>
  interact: boolean
  commentMode: boolean
  onPick: (id: string) => void
}) {
  const n = nodes[id]
  if (!n || n.visible === false) return null
  const Tag = tagOf(n)
  const kids = Object.keys(nodes).filter((k) => NODE_ID.test(k) && nodes[k]?.parent === id)
  kids.sort((a, b) => (nodes[a].order ?? 0) - (nodes[b].order ?? 0))
  const style = nodeReactStyle(n) as CSSProperties
  return (
    <Tag
      data-nid={id}
      className="cd-ir-node"
      style={style}
      onClick={(e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        if (interact && !commentMode) return
        onPick(id)
      }}
    >
      {typeof n.text === 'string' && n.text ? <span className="cd-ir-text">{n.text}</span> : null}
      {kids.map((k) => (
          <IrNode
            key={k}
            id={k}
            nodes={nodes}
            interact={interact}
            commentMode={commentMode}
            onPick={onPick}
          />
      ))}
    </Tag>
  )
}

export default function IrCanvas(props: {
  doc: DesignIR | null
  sel: string | null
  onSel: (id: string) => void
  page: string
  interact: boolean
  commentMode: boolean
  textTool?: boolean
  onDraft?: (n: DesignNode, id?: string, opts?: { history?: boolean }) => void
  pins?: Array<{ id: string; nodeId: string; text: string; status?: string }>
}) {
  const { doc, sel, onSel, page, interact, commentMode, textTool, onDraft, pins = [] } = props
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [openPin, setOpenPin] = useState<string | null>(null)
  const nodes = doc?.nodes ?? {}
  const pages = (doc?.pages ?? []).slice(0, 16)
  const fallback = pages[0]?.id ?? 'p1'
  const pageNodes: Record<string, DesignNode> = {}
  for (const id of Object.keys(nodes)) {
    if (!NODE_ID.test(id)) continue
    if (!Object.prototype.hasOwnProperty.call(nodes, id)) continue
    const n = nodes[id]
    if (!n || typeof n !== 'object') continue
    if (onThisPage(n, page, fallback)) pageNodes[id] = n
  }
  const rows = layerRows(pageNodes, 64) as Array<{ id: string; depth: number }>
  const roots = rows.filter((r) => r.depth === 0).map((r) => r.id)
  const pick = (id: string) => {
    if (interact && !commentMode) return
    onSel(id)
    const n = nodes[id]
    if (textTool && n && (n.type === 'text' || typeof n.text === 'string')) setEditId(id)
    else setEditId(null)
  }
  const applyLay = (next: DesignLayout, commit: boolean) => {
    if (!sel || !nodes[sel] || !onDraft) return
    onDraft({ ...nodes[sel], layout: next }, sel, { history: commit })
  }
  const applyText = (id: string, text: string) => {
    const n = nodes[id]
    if (!n || !onDraft) return
    onDraft({ ...n, text: text.replace(/[<>]/g, '').slice(0, 500) }, id, { history: false })
  }
  const phone = doc?.artifact?.profile === 'ui.mobile'
  return (
    <div className={phone ? 'cd-ir-phone' : 'cd-ir-board'} ref={hostRef}>
      {roots.length === 0 ? (
        <HxEmpty
          compact
          title="Canvas is empty"
          body="No nodes on this page yet. The agent adds screens with design_patch."
        />
      ) : (
        roots.map((id) => (
          <IrNode
            key={id}
            id={id}
            nodes={pageNodes}
            interact={interact}
            commentMode={commentMode}
            onPick={pick}
          />
        ))
      )}
      <SelFrame
        hostRef={hostRef}
        sel={sel}
        interact={interact}
        tick={doc}
        layout={sel ? nodes[sel]?.layout : undefined}
        onResize={applyLay}
      />
      {editId && nodes[editId] && !interact ? (
        <input
          className="qs-inline-edit"
          value={nodes[editId]?.text ?? ''}
          maxLength={500}
          onChange={(e) => applyText(editId, e.target.value)}
          onBlur={() => setEditId(null)}
          autoFocus
        />
      ) : null}
      {pins.map((p, i) => (
        <button
          key={p.id}
          type="button"
          className={`cd-pin ${openPin === p.id ? 'on' : ''} ${p.status === 'needs-re-anchor' ? 'loose' : ''}`}
          title={pinCaption(p)}
          onClick={() => {
            setOpenPin((cur) => (cur === p.id ? null : p.id))
            if (NODE_ID.test(p.nodeId) && p.status !== 'needs-re-anchor') onSel(p.nodeId)
          }}
        >
          {i + 1}
        </button>
      ))}
      {openPin ? (
        <div className="cd-pin-pop">{pinCaption(pins.find((x) => x.id === openPin))}</div>
      ) : null}
    </div>
  )
}

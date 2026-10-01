import { useState } from 'react'
import Editor from '@monaco-editor/react'
import type { MapNode } from '@homeai/core'
import { HxEmpty, HxSideHead } from '../layout/HxPage'
import { useWorkbench } from '../store/useWorkbench'
import { languageFor } from '../lib/monaco'

function nodePath(n: MapNode): string | null {
  const p = (n.payload || '').trim()
  if (n.kind === 'file' && p) return p
  if (p.startsWith('/') && p.includes('.')) return p
  return null
}

function pos(i: number): { x: number; y: number } {
  return { x: 24 + (i % 5) * 200, y: 24 + Math.floor(i / 5) * 90 }
}

export default function MapsPane({ compact, listOnly }: { compact?: boolean; listOnly?: boolean }) {
  const w = useWorkbench()
  const map = w.map
  const [peek, setPeek] = useState<{ path: string; content: string } | null>(null)
  const [selected, setSelected] = useState('')

  const openNode = async (n: MapNode) => {
    setSelected(n.id)
    const p = nodePath(n)
    if (!p) return
    try {
      const content = await window.homeai.read(p)
      setPeek({ path: p, content })
    } catch {
      await w.openFile(p, { keepActivity: true })
    }
  }

  if (listOnly) {
    return (
      <>
        <HxSideHead title="Maps" hint="Sessions land here after kernel runs. Pin a file from Agents to grow edges." />
        <div className="side-list">
          {map.nodes.length === 0 ? (
            <HxEmpty compact title="No map nodes yet" body="Sessions land here after kernel runs. Pin a file from Agents to grow edges." />
          ) : (
            map.nodes.map((n) => (
              <button key={n.id} type="button" className="note-row" onClick={() => void openNode(n)}>
                <strong>{n.title}</strong>
                <small>{n.kind}</small>
              </button>
            ))
          )}
        </div>
      </>
    )
  }

  const canvas = (
      <div className="map-canvas">
        <svg className="map-edges" aria-hidden>
          {map.edges.map((e, i) => {
            const a = map.nodes.findIndex((n) => n.id === e.src)
            const b = map.nodes.findIndex((n) => n.id === e.dst)
            if (a < 0 || b < 0) return null
            const pa = pos(a)
            const pb = pos(b)
            return (
              <line
                key={`${e.src}-${e.dst}-${i}`}
                x1={pa.x + 90}
                y1={pa.y + 22}
                x2={pb.x + 90}
                y2={pb.y + 22}
                stroke="#3c3c3c"
                strokeWidth="1"
              />
            )
          })}
        </svg>
        {map.nodes.map((n, i) => (
          <button
            key={n.id}
            type="button"
            className={`map-node ${nodePath(n) ? 'has-file' : ''} ${selected === n.id ? 'on' : ''}`}
            style={{ left: pos(i).x, top: pos(i).y }}
            title={n.payload}
            onClick={() => void openNode(n)}
          >
            <div className="map-kind">{n.kind}</div>
            {n.title}
          </button>
        ))}
        {map.nodes.length === 0 && (
          <HxEmpty
            compact={compact}
            title="No map yet"
            body="Sessions land here after kernel runs. Edges appear as you link discoveries to files."
          />
        )}
        {peek ? (
          <div className="map-code-card">
            <div className="map-code-head">
              <button type="button" className="ghost tiny" onClick={() => void w.openFile(peek.path)}>
                {peek.path.split('/').pop()}
              </button>
              <span className="spacer" />
              <button type="button" className="icon-btn" onClick={() => setPeek(null)}>
                ×
              </button>
            </div>
            <Editor
              theme="vs-dark"
              path={peek.path}
              language={languageFor(peek.path)}
              value={peek.content}
              height={220}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 12,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false
              }}
            />
          </div>
        ) : null}
      </div>
  )

  if (compact) {
    return <div className="maps-wrap compact">{canvas}</div>
  }
  return <div className="maps-wrap">{canvas}</div>
}

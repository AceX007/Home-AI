import { useState } from 'react'
import { HxEmpty, HxSideHead } from '../layout/HxPage'
import { useWorkbench } from '../store/useWorkbench'
import type { RagHit } from '@homeai/core'
import { stripActivityText, takeGrepQuery, takeHitRel } from '@homeai/runtime/browser'

type GrepHit = { path: string; line: number; text: string }
type Tab = 'memory' | 'workspace'

export default function SearchPane() {
  const w = useWorkbench()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<Tab>('memory')
  const [hits, setHits] = useState<RagHit[]>([])
  const [grep, setGrep] = useState<GrepHit[]>([])
  const [busy, setBusy] = useState(false)
  const [didRun, setDidRun] = useState(false)

  const openRel = (path: string) => {
    const jailed = takeHitRel(path, w.boot?.root)
    if (!jailed) return
    void w.openFile(`${w.boot?.root}/${jailed}`)
  }

  const go = async () => {
    const query = takeGrepQuery(q)
    if (!query) {
      setHits([])
      setGrep([])
      return
    }
    setBusy(true)
    setDidRun(true)
    try {
      if (tab === 'memory') {
        const res = (await window.homeai.ragSearch(query)) as RagHit[]
        setHits(Array.isArray(res) ? res.slice(0, 40) : [])
        setGrep([])
      } else {
        const rows = await window.homeai.workspaceGrep(query)
        setGrep(Array.isArray(rows) ? rows : [])
        setHits([])
      }
    } catch {
      setHits([])
      setGrep([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <HxSideHead
        title="Search"
        hint="Memory is RAG, notes, and skills. Workspace greps files with ignore rules."
      />
      <div className="form">
        <div className="sess-pills">
          <button type="button" className={tab === 'memory' ? 'on' : ''} onClick={() => setTab('memory')}>
            Memory
          </button>
          <button type="button" className={tab === 'workspace' ? 'on' : ''} onClick={() => setTab('workspace')}>
            Workspace
          </button>
        </div>
        <input
          placeholder={tab === 'memory' ? 'Search RAG, notes, skills…' : 'Grep the workspace (ignore-honoring)'}
          value={q}
          onChange={(e) => setQ(e.target.value.replace(/[<>]/g, '').slice(0, 80))}
          onKeyDown={(e) => e.key === 'Enter' && void go()}
        />
        <button className="ghost" disabled={busy} onClick={() => void go()}>
          {busy ? '…' : 'Search'}
        </button>
      </div>
      <div className="notes-list">
        {!didRun ? (
          <HxEmpty
            compact
            title="Search this workspace"
            body="Memory searches RAG, notes, and skills. Workspace greps files. Hits are text — click a row to open the jailed path."
          />
        ) : null}
        {didRun && !busy && tab === 'memory' && hits.length === 0 ? (
          <HxEmpty compact title="No memory hits" body="Try another phrase, or switch to Workspace grep." />
        ) : null}
        {didRun && !busy && tab === 'workspace' && grep.length === 0 ? (
          <HxEmpty compact title="No grep hits" body="Ignore rules still apply. Paths outside the workspace never appear." />
        ) : null}
        {tab === 'memory'
          ? hits.map((h, i) => {
              const path = stripActivityText(h.path, 240)
              const snippet = stripActivityText(h.snippet, 200)
              const symbol = stripActivityText(h.symbol || '', 80)
              return (
                <div key={`${path}-${i}`} className="note-row" onClick={() => openRel(h.path)}>
                  <strong>
                    {path}
                    {symbol ? `#${symbol}` : ''}
                  </strong>
                  <small>{snippet}</small>
                </div>
              )
            })
          : grep.map((h, i) => (
              <div key={`${h.path}-${h.line}-${i}`} className="note-row" onClick={() => openRel(h.path)}>
                <strong>
                  {h.path}:{h.line}
                </strong>
                <small>{h.text}</small>
              </div>
            ))}
      </div>
    </>
  )
}

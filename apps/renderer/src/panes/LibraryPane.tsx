import { useMemo, useState } from 'react'
import { HxEmpty, HxPage } from '../layout/HxPage'
import { useWorkbench } from '../store/useWorkbench'
import { LIBRARY_FILES, parseLibraryStatus, type LibraryTab } from '../lib/libraryStatus'

const tabs: Array<{ id: LibraryTab; label: string }> = [
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'features', label: 'Features' },
  { id: 'tests', label: 'Tests' },
  { id: 'edges', label: 'Edges' },
  { id: 'tasks', label: 'Tasks' }
]

function Meter({ label, a, b }: { label: string; a: number; b: number }) {
  const pct = b ? Math.round((a / b) * 100) : 0
  return (
    <div className="lib-meter" title={`${a} / ${b}`}>
      <span>{label}</span>
      <span className="lib-meter-track">
        <span className="lib-meter-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="lib-meter-n">
        {a}/{b}
      </span>
    </div>
  )
}

function MdBody({ text }: { text: string }) {
  if (!text.trim()) {
    return (
      <HxEmpty
        compact
        title="No file yet"
        body="Ask the agent to run skill repo-library. That writes ROADMAP, TESTS, EDGES, and STATUS."
      />
    )
  }
  return <pre className="lib-md">{text}</pre>
}

export default function LibraryPane() {
  const w = useWorkbench()
  const [tab, setTab] = useState<LibraryTab>('roadmap')
  const meters = useMemo(() => parseLibraryStatus(w.libraryStatus), [w.libraryStatus])
  const root = w.boot?.workspace
  const file = tab === 'tasks' ? null : LIBRARY_FILES[tab]
  const body = file ? (w.libraryDocs[file] ?? '') : ''

  const open = (name: string) => {
    if (!root) return
    void w.openFile(`${root}/RAG/library/${name}`)
  }

  return (
    <HxPage
      title="Library"
      lead="Roadmap, tests, and edges for this repo. Meters come from STATUS.md, not invented counts."
      actions={
        file ? (
          <button type="button" className="ghost" onClick={() => open(file)}>
            Open in editor
          </button>
        ) : (
          <button type="button" className="ghost" onClick={() => w.setActivity('board')}>
            Open board
          </button>
        )
      }
    >
    <div className="lib-wrap">
      {!w.libraryStatus.trim() ? (
        <HxEmpty
          title="No ROADMAP yet"
          body="Ask the agent to run skill repo-library. The pane reads RAG/library/STATUS.md through existing homeai.read."
        />
      ) : (
        <>
          <div className="lib-status">
            <strong>{meters.phase || 'Phase ?'}</strong>
            <span className="lib-updated">{meters.updated}</span>
            <span className="lib-pill">Features {meters.features}</span>
            <Meter label="Tests" a={meters.testsDone} b={meters.testsRequired} />
            <Meter label="Edges" a={meters.edgesTested} b={meters.edgesTracked} />
          </div>
          <div className="lib-tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={tab === t.id ? 'on' : ''}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="lib-body">
            {tab === 'tasks' ? (
              <div className="lib-tasks">
                <p className="lib-hint">Live kanban is taskboards/default.json. Roadmap is the product brain.</p>
                {(w.board?.cards ?? []).length === 0 ? (
                  <HxEmpty compact title="No board cards" body="Open Board from the activity bar and add a card. Tasks tab mirrors the live kanban." />
                ) : null}
                {(w.board?.cards ?? []).map((c) => (
                  <div key={c.id} className="card dense-card">
                    <strong>{c.title}</strong>
                    <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>{c.column}</div>
                    {c.body ? <div style={{ fontSize: 12, marginTop: 6 }}>{c.body}</div> : null}
                  </div>
                ))}
              </div>
            ) : (
              <MdBody text={body} />
            )}
          </div>
        </>
      )}
    </div>
    </HxPage>
  )
}

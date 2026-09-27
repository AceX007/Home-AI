import { useState } from 'react'
import type { TaskCard } from '@homeai/core'
import { HxPage } from '../layout/HxPage'
import { useWorkbench } from '../store/useWorkbench'

const cols: TaskCard['column'][] = ['backlog', 'doing', 'review', 'done']

export default function TaskboardPane() {
  const w = useWorkbench()
  const [title, setTitle] = useState('')

  const move = async (card: TaskCard, column: TaskCard['column']) => {
    await window.homeai.boardUpsert({ id: card.id, title: card.title, column, body: card.body })
    await w.refreshGrounds()
  }

  return (
    <HxPage
      title="Board"
      lead="Cards live in taskboards/default.json. Yes moves forward, No moves back. Columns are backlog → doing → review → done."
      actions={
        <>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="new card" />
          <button
            type="button"
            className="ghost"
            onClick={async () => {
              if (!title.trim()) return
              await window.homeai.boardUpsert({ title: title.trim(), column: 'backlog' })
              setTitle('')
              await w.refreshGrounds()
            }}
          >
            Add
          </button>
        </>
      }
    >
      <div className="kanban">
        {cols.map((col) => (
          <div key={col} className="col">
            <h3>{col}</h3>
              {w.board?.cards.filter((c) => c.column === col).length === 0 ? (
              <p className="empty-inline">
                {col === 'backlog' ? 'Add a card above. Columns are backlog → doing → review → done.' : 'Drop a card here from another column.'}
              </p>
            ) : null}
            {w.board?.cards
              .filter((c) => c.column === col)
              .map((card) => (
                <div key={card.id} className="card dense-card">
                  <strong>{card.title}</strong>
                  {card.body && <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>{card.body}</div>}
                  <div className="yn-bar">
                    <button
                      type="button"
                      className="yn yes"
                      onClick={() =>
                        void move(
                          card,
                          col === 'backlog' ? 'doing' : col === 'doing' ? 'review' : col === 'review' ? 'done' : 'done'
                        )
                      }
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className="yn no"
                      onClick={() =>
                        void move(
                          card,
                          col === 'done' ? 'review' : col === 'review' ? 'doing' : col === 'doing' ? 'backlog' : 'backlog'
                        )
                      }
                    >
                      No
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    {cols
                      .filter((c) => c !== col)
                      .map((c) => (
                        <button key={c} className="ghost" onClick={() => void move(card, c)}>
                          {c}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </HxPage>
  )
}

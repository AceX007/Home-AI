import { useEffect, useState } from 'react'
import { stripActivityText } from '@homeai/runtime/browser'
import { HxEmpty } from './HxPage'
import { useWorkbench } from '../store/useWorkbench'

function fileRows(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string' || !item.trim()) continue
    out.push(item)
  }
  return out
}

export default function QuickOpen({ initialQuery = '' }: { initialQuery?: string }) {
  const w = useWorkbench()
  const [q, setQ] = useState(() => stripActivityText(initialQuery, 80))
  const [hits, setHits] = useState<string[]>([])
  const [i, setI] = useState(0)

  useEffect(() => {
    void window.homeai.quickOpen(q).then((h) => {
      setHits(fileRows(h))
      setI(0)
    })
  }, [q])

  const pick = async (rel: string) => {
    const abs = rel.startsWith('/') ? rel : `${w.boot?.workspace}/${rel}`
    await w.openFile(abs)
    useWorkbench.setState({ quickOpen: false })
  }

  const filtered = Boolean(q.trim())

  return (
    <div className="palette-back" onMouseDown={() => useWorkbench.setState({ quickOpen: false })}>
      <div
        className="palette"
        role="dialog"
        aria-label="Quick open"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="palette-head">
          <p className="hx-kicker">Hex AI</p>
          <p className="palette-lead">
            {filtered
              ? 'Matching files'
              : 'Type a file name. Paths stay text, not HTML. Arrow keys move. Enter opens.'}
          </p>
        </header>
        <input
          autoFocus
          aria-label="Filter files"
          placeholder="Go to file…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') useWorkbench.setState({ quickOpen: false })
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setI((n) => Math.min(n + 1, Math.max(0, hits.length - 1)))
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setI((n) => Math.max(n - 1, 0))
            }
            if (e.key === 'Enter' && hits[i]) void pick(hits[i])
          }}
        />
        {hits.length === 0 ? (
          <HxEmpty
            compact
            title={filtered ? 'No matching files' : 'No files yet'}
            body={
              filtered
                ? 'Nothing in this workspace matches that filter. Paths are not HTML.'
                : 'Open a folder, then type a basename to jump. Extra-root and secrets stay jailed in main.'
            }
          />
        ) : (
          <div className="palette-list" role="listbox" aria-label="Files">
            {hits.map((h, idx) => {
              const base = stripActivityText(h.split('/').pop() || h, 80)
              const rel = stripActivityText(h, 160)
              return (
                <div
                  key={h}
                  className={`hit ${idx === i ? 'on' : ''}`}
                  role="option"
                  aria-selected={idx === i}
                  onMouseEnter={() => setI(idx)}
                  onClick={() => void pick(h)}
                >
                  <span>{base}</span>
                  <kbd>{rel}</kbd>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

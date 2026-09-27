import { useEffect, useMemo, useState } from 'react'
import { takeBufferOutline } from '@homeai/runtime/browser'
import { HxEmpty } from './HxPage'
import { useWorkbench } from '../store/useWorkbench'
import type { TsSymbol } from '@homeai/ts-intel'

export default function GotoSymbol() {
  const w = useWorkbench()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const [scope, setScope] = useState<'document' | 'workspace'>('document')
  const [workspaceHits, setWorkspaceHits] = useState<TsSymbol[]>([])
  const tab = w.tabs.find((t) => t.path === w.activePath)
  const hits = useMemo(() => {
    if (scope === 'workspace') {
      return workspaceHits.map((row) => ({ path: row.path, line: row.startLine, label: row.name, kind: row.kind }))
    }
    const indexed = w.activePath ? w.documentSymbols[w.activePath] || [] : []
    if (indexed.length) {
      const needle = q.trim().toLowerCase()
      return indexed
        .filter((row) => !needle || row.name.toLowerCase().includes(needle))
        .map((row) => ({ path: row.path, line: row.startLine, label: row.name, kind: row.kind }))
    }
    return takeBufferOutline(tab?.content || '', q).map((row) => ({
      path: w.activePath || '',
      line: row.line,
      label: row.label,
      kind: 'text'
    }))
  }, [scope, workspaceHits, w.activePath, w.documentSymbols, tab?.content, q])
  const filtered = Boolean(q.trim())

  useEffect(() => {
    if (scope !== 'workspace') return
    const timer = setTimeout(() => {
      void window.homeai.tsWorkspaceSymbols(q).then(setWorkspaceHits).catch(() => setWorkspaceHits([]))
    }, 120)
    return () => {
      clearTimeout(timer)
      void window.homeai.tsCancel()
    }
  }, [scope, q])

  const pick = async (target: { path: string; line: number }) => {
    if (!target.path || target.line < 1) return
    await w.openFile(target.path)
    useWorkbench.setState({
      outlineOpen: false,
      outlineJump: { path: target.path, line: target.line }
    })
  }

  return (
    <div className="palette-back" onMouseDown={() => useWorkbench.setState({ outlineOpen: false })}>
      <div
        className="palette"
        role="dialog"
        aria-label="Go to symbol"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="palette-head">
          <p className="hx-kicker">Hex AI</p>
          <p className="palette-lead">
            {filtered
              ? `Matching ${scope} symbols`
              : scope === 'workspace'
                ? 'Project-aware symbols from the TypeScript index. Arrow keys move. Enter jumps.'
                : 'Project-aware symbols from the open file. Arrow keys move. Enter jumps.'}
          </p>
          <button
            type="button"
            className="ghost tiny"
            aria-pressed={scope === 'workspace'}
            onClick={() => {
              setScope((value) => value === 'document' ? 'workspace' : 'document')
              setI(0)
            }}
          >
            {scope === 'document' ? 'Search workspace' : 'Search document'}
          </button>
        </header>
        <input
          autoFocus
          aria-label="Filter symbols"
          placeholder="Go to symbol…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setI(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') useWorkbench.setState({ outlineOpen: false })
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
            title={filtered ? 'No matching symbols' : 'No symbols in this buffer'}
            body={
              filtered
                ? 'Nothing in the open file matches that filter. Labels are text, not HTML.'
                : scope === 'workspace'
                  ? 'Open a TypeScript or JavaScript file first so the project index can populate. Ctrl+Shift+O, then Search workspace.'
                  : 'Open a file, then Ctrl+Shift+O. This scan stays in the current tab.'
            }
          />
        ) : (
          <div className="palette-list" role="listbox" aria-label="Symbols">
            {hits.map((h, idx) => (
              <div
                key={`${h.path}-${h.line}-${h.label}`}
                className={`hit ${idx === i ? 'on' : ''}`}
                role="option"
                aria-selected={idx === i}
                onMouseEnter={() => setI(idx)}
                onClick={() => void pick(h)}
              >
                <span>{h.label.replace(/[<>]/g, '')} <small>{String(h.kind).replace(/[<>]/g, '')}</small></span>
                <kbd>{scope === 'workspace' ? `${h.path.split('/').pop()}:` : ''}L{h.line}</kbd>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

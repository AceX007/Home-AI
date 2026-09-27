import { useEffect, useState } from 'react'
import type { GitFileStatus } from '@homeai/core'
import { useWorkbench } from '../store/useWorkbench'

function hunkCounts(diff: string): Map<string, number> {
  const map = new Map<string, number>()
  let cur = ''
  for (const line of diff.split('\n')) {
    const h = /^diff --git a\/(.+) b\/(.+)$/.exec(line)
    if (h) {
      cur = h[2]
      if (!map.has(cur)) map.set(cur, 0)
      continue
    }
    if (!cur) continue
    if ((line.startsWith('+') || line.startsWith('-')) && !line.startsWith('+++') && !line.startsWith('---')) {
      map.set(cur, (map.get(cur) ?? 0) + 1)
    }
  }
  return map
}

function abs(root: string, rel: string): string | null {
  const n = rel.replace(/\\/g, '/').replace(/[<>]/g, '')
  if (!n || n.includes('..')) return null
  if (n.startsWith('/')) {
    const base = root.replace(/\/$/, '')
    if (n === base || n.startsWith(`${base}/`)) return n
    return null
  }
  return `${root.replace(/\/$/, '')}/${n}`
}

export default function GitDensity() {
  const w = useWorkbench()
  const [diff, setDiff] = useState('')
  const root = w.boot?.workspace ?? w.treePath

  useEffect(() => {
    void window.homeai.gitDiff(false).then(setDiff).catch(() => setDiff(''))
  }, [w.gitFiles])

  const files = w.gitFiles
  const trending = files.filter((f) => !f.xy.includes('?')).slice(0, 8)
  const fresh = files.filter((f) => f.xy.includes('?')).slice(0, 8)
  const counts = hunkCounts(diff)
  const movers = [...files]
    .map((f) => ({ f, n: counts.get(f.path.replace(/\\/g, '/')) ?? counts.get(f.path.split('/').pop() ?? '') ?? 0 }))
    .sort((a, b) => b.n - a.n)
    .filter((x) => x.n > 0)
    .slice(0, 6)

  if (!files.length) return null

  const row = (f: GitFileStatus, extra?: string) => (
    <div key={f.path + (extra ?? '')} className="git-dense-row">
      <button type="button" className="git-dense-open" onClick={() => {
        const path = abs(root, f.path)
        if (!path) return
        void w.openFile(path)
        const hit = w.pending.find((p) => p.path.endsWith(f.path) || p.path === path)
        useWorkbench.setState({
          reviewOpen: Boolean(hit) || w.pending.length > 0,
          activePath: hit?.path || path
        })
      }}>
        <span className="git-letter git-m">{f.xy.trim() || 'M'}</span>
        <span className="file-name">{f.path.split('/').pop()}</span>
        {extra ? <span className="muted">{extra}</span> : null}
      </button>
      {f.staged ? (
        <button
          type="button"
          className="ghost git-dense-act"
          onClick={async () => {
            try {
              await window.homeai.gitUnstage([f.path])
              await w.refreshGit()
            } catch {
              /* ignore */
            }
          }}
        >
          Unstage
        </button>
      ) : (
        <button
          type="button"
          className="ghost git-dense-act"
          onClick={async () => {
            try {
              await window.homeai.gitAdd([f.path])
              await w.refreshGit()
            } catch {
              /* ignore */
            }
          }}
        >
          Stage
        </button>
      )}
    </div>
  )

  return (
    <div className="git-dense">
      {trending.length > 0 && (
        <section>
          <h4>Changed</h4>
          {trending.map((f) => row(f))}
        </section>
      )}
      {fresh.length > 0 && (
        <section>
          <h4>Untracked</h4>
          {fresh.map((f) => row(f))}
        </section>
      )}
      {movers.length > 0 && (
        <section>
          <h4>Most hunks</h4>
          {movers.map(({ f, n }) => row(f, `${n} hunks`))}
        </section>
      )}
    </div>
  )
}

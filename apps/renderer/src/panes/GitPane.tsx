import { useEffect, useState } from 'react'
import GitDensity from './GitDensity'
import { HxEmpty, HxSideHead } from '../layout/HxPage'
import { useWorkbench } from '../store/useWorkbench'
import type { GitSnapshot } from '@homeai/core'

export default function GitPane() {
  const w = useWorkbench()
  const [snap, setSnap] = useState<GitSnapshot | null>(null)
  const [diff, setDiff] = useState('')
  const [log, setLog] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [wt, setWt] = useState('')
  const [wtName, setWtName] = useState('')
  const [pullBusy, setPullBusy] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pullNote, setPullNote] = useState('')

  const refresh = async () => {
    setErr('')
    try {
      const [s, d, l, wts] = await Promise.all([
        window.homeai.gitStatus() as Promise<GitSnapshot>,
        window.homeai.gitDiff(false),
        window.homeai.gitLog(),
        window.homeai.gitWorktreeList().catch(() => '')
      ])
      setSnap(s)
      setDiff(d)
      setLog(l)
      setWt(wts)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void refresh()
  }, [w.pending.length, w.gitFiles])

  return (
    <>
      <HxSideHead
        title="Source control"
        hint="Stage, commit, then pull ff-only or push the current upstream."
        actions={
          <button type="button" className="ghost" onClick={() => void refresh()}>
            Refresh
          </button>
        }
      />
    <div className="hx-form hx-fill git-side">
      {err && <div className="warn-banner">{err}</div>}
      {pullNote ? <pre className="git-pre">{pullNote}</pre> : null}
      <p className="hx-hint">
        {snap?.aheadBehind || snap?.branch || 'no git'} · {snap?.files.length ?? 0} files
      </p>
      {snap && snap.files.length === 0 ? (
        <HxEmpty
          compact
          title="Working tree clean"
          body="Nothing to stage. Pull ff-only or push the current upstream when the branch is ahead."
        />
      ) : null}
      <GitDensity />
      <label>Commit message</label>
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} />
      <div className="hx-row">
        <button
          type="button"
          className="ghost"
          onClick={async () => {
            try {
              const paths = (snap?.files ?? []).map((f) => f.path)
              if (paths.length) await window.homeai.gitAdd(paths)
              await refresh()
              await w.refreshGit()
            } catch (e) {
              setErr(e instanceof Error ? e.message : String(e))
            }
          }}
        >
          Stage all
        </button>
        <button
          className="ghost"
          onClick={async () => {
            try {
              const paths = (snap?.files ?? []).filter((f) => f.staged).map((f) => f.path)
              if (paths.length) await window.homeai.gitUnstage(paths)
              await refresh()
              await w.refreshGit()
            } catch (e) {
              setErr(e instanceof Error ? e.message : String(e))
            }
          }}
        >
          Unstage all
        </button>
        <button
          className="send"
          onClick={async () => {
            try {
              await window.homeai.gitCommit(msg)
              setMsg('')
              await refresh()
            } catch (e) {
              setErr(e instanceof Error ? e.message : String(e))
            }
          }}
        >
          Commit
        </button>
        <button
          className="ghost"
          onClick={async () => {
            useWorkbench.setState({ chatOpen: true })
            try {
              const res = await window.homeai.agentReview('quick')
              useWorkbench.setState({ reviewText: res.text || '', chatOpen: true })
            } catch (e) {
              setErr(e instanceof Error ? e.message : String(e))
            }
          }}
        >
          Agent review
        </button>
        <button
          className="ghost"
          disabled={pullBusy}
          title="git pull --ff-only (current upstream only)"
          onClick={async () => {
            setPullBusy(true)
            try {
              const out = await window.homeai.gitPull()
              setPullNote(String(out || '').slice(0, 400))
              setErr('')
              await refresh()
              await w.refreshGit()
            } catch (e) {
              setErr(e instanceof Error ? e.message : String(e))
            } finally {
              setPullBusy(false)
            }
          }}
        >
          {pullBusy ? 'Pull…' : 'Pull ff-only'}
        </button>
        <button
          className="ghost"
          disabled={pushBusy}
          title="git push to the current upstream only"
          onClick={async () => {
            setPushBusy(true)
            try {
              const out = await window.homeai.gitPush()
              setPullNote(String(out || '').slice(0, 400))
              setErr('')
              await refresh()
              await w.refreshGit()
            } catch (e) {
              setErr(e instanceof Error ? e.message : String(e))
            } finally {
              setPushBusy(false)
            }
          }}
        >
          {pushBusy ? 'Push…' : 'Push upstream'}
        </button>
      </div>
      <label>Worktrees</label>
      <pre className="git-pre">{wt || '(none)'}</pre>
      <div className="hx-row">
        <input value={wtName} onChange={(e) => setWtName(e.target.value)} placeholder="worktree name" />
        <button
          className="ghost"
          onClick={async () => {
            if (!wtName.trim()) return
            try {
              await window.homeai.gitWorktreeAdd(wtName.trim())
              setWtName('')
              await refresh()
            } catch (e) {
              setErr(e instanceof Error ? e.message : String(e))
            }
          }}
        >
          Add worktree
        </button>
      </div>
      <label>Log</label>
      <pre className="git-pre">{log}</pre>
      <label>Diff</label>
      <pre className="git-pre">{diff || '(clean)'}</pre>
    </div>
    </>
  )
}

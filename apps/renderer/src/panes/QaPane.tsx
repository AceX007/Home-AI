import { useMemo, useState } from 'react'
import { HxEmpty, HxPage, HxSideHead } from '../layout/HxPage'
import { useWorkbench, type LogItem } from '../store/useWorkbench'
import { lastForgeStep, splitWorkflowPhases, stripActivityText, workflowPhaseLine, redactDebugText } from '@homeai/runtime/browser'

function lastUserText(log: LogItem[]): string | undefined {
  for (let i = log.length - 1; i >= 0; i--) {
    const item = log[i]
    if (item.kind === 'user') return item.text
  }
  return undefined
}

function lastErrorText(log: LogItem[]): string {
  for (let i = log.length - 1; i >= 0; i--) {
    const item = log[i]
    if (item.kind === 'error') return redactDebugText(item.text, 400)
  }
  return ''
}

export default function QaPane({ listOnly }: { listOnly?: boolean }) {
  const w = useWorkbench()
  const [notes, setNotes] = useState('')
  const [copied, setCopied] = useState(false)
  const lanes = splitWorkflowPhases(w.workflow)
  const phaseLine = stripActivityText(workflowPhaseLine(w.workflow), 120)
  const step = lastForgeStep(w.log as Array<{ kind: string; text?: string }>) || (w.busy ? 'running' : 'idle')
  const err = lastErrorText(w.log)
  const trace = redactDebugText(w.lastTrace, 2000) || 'No kernel trace yet. Run an agent, then this pane shows the last forge dump.'
  const pulse = w.kernelPulse

  const snapshot = useMemo(() => {
    const lines = [
      `run ${stripActivityText(w.runId || 'none', 80)}`,
      `busy ${w.busy ? 'yes' : 'no'}`,
      `mode ${stripActivityText(w.agentMode, 24)}`,
      `mind ${stripActivityText(w.provider, 24)}`,
      `step ${stripActivityText(String(step), 40)}`,
      `llama ${stripActivityText(pulse?.llama || 'off', 24)}`,
      `keys ${stripActivityText(pulse?.keys || 'none', 40)}`,
      `mcp ${pulse?.mcp ?? 0}`,
      `live ${pulse?.live ?? 0}`,
      phaseLine ? `phases ${phaseLine}` : '',
      w.workflow.id ? `workflow ${stripActivityText(w.workflow.id, 80)} ${w.workflow.status}` : '',
      err ? `error ${err}` : '',
      `pending ${w.pending.length}`,
      `qa ${w.qa.length}`
    ].filter(Boolean)
    return lines.join('\n')
  }, [w.runId, w.busy, w.agentMode, w.provider, step, pulse, phaseLine, w.workflow, err, w.pending.length, w.qa.length])

  const save = async (verdict: 'pass' | 'fail' | 'pending') => {
    await window.homeai.qaAdd({
      id: `qa_${Date.now()}`,
      prompt: lastUserText(w.log) ?? '(no prompt)',
      verdict,
      notes,
      trace: w.lastTrace,
      createdAt: Date.now()
    })
    await w.refreshGrounds()
    setNotes('')
  }

  const copySnap = async () => {
    try {
      await navigator.clipboard?.writeText(snapshot)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  if (listOnly) {
    return (
      <>
        <HxSideHead
          title="Debug"
          hint="Last forge and pass/fail history. Open for kernel pulse and trace."
          actions={
            <button type="button" className="ghost" onClick={() => w.setActivity('qa')}>
              Open
            </button>
          }
        />
        <div className="side-list">
          <button type="button" className="note-row" onClick={() => w.setActivity('qa')}>
            <strong>{w.busy ? 'Live run' : w.runId ? 'Last run' : 'Idle'}</strong>
            <small>{phaseLine || stripActivityText(String(step), 48)}</small>
          </button>
          {w.qa.length === 0 ? (
            <HxEmpty compact title="No verdicts yet" body="Mark pass/fail after a kernel run. History lands here." />
          ) : (
            w.qa.slice(0, 24).map((q) => (
              <div key={q.id} className={`qa-card ${q.verdict}`}>
                <strong>
                  {q.verdict} · {stripActivityText(q.prompt, 60)}
                </strong>
                {q.notes ? <small>{stripActivityText(q.notes, 80)}</small> : null}
              </div>
            ))
          )}
        </div>
      </>
    )
  }

  return (
    <HxPage
      title="Debug"
      lead="Kernel pulse, last forge, and pass/fail history. Tokens come from SSE usage, not text length."
      actions={
        <>
          <button type="button" className="ghost" onClick={() => void copySnap()}>
            {copied ? 'Copied' : 'Copy snapshot'}
          </button>
          {w.runId ? (
            <button type="button" className="ghost" onClick={() => w.stop()}>
              Stop
            </button>
          ) : null}
        </>
      }
    >
    <div className="debug-wrap">
      <div className="debug-grid">
        <section className="card debug-card">
          <strong>Kernel</strong>
          <p className="debug-meta">
            llama {pulse?.llama || 'off'} · keys {pulse?.keys || 'none'} · MCP {pulse?.mcp ?? 0} · live {pulse?.live ?? 0}
          </p>
          <p className="debug-meta">
            {w.agentMode} · {w.provider === 'local' ? 'local 2B' : w.provider}
            {pulse?.llamaErr ? ` · ${redactDebugText(pulse.llamaErr, 120)}` : ''}
          </p>
          <div className="debug-actions">
            <button type="button" className="ghost tiny" onClick={() => void window.homeai.llmStart().then(() => w.load())}>
              Load 2B
            </button>
            <button type="button" className="ghost tiny" onClick={() => w.setActivity('settings')}>
              Settings
            </button>
          </div>
        </section>
        <section className="card debug-card">
          <strong>Run</strong>
          {w.runId || w.busy ? (
            <>
              <p className="debug-meta">
                {stripActivityText(w.runId || '', 80) || 'no id'} · {w.busy ? 'busy' : w.workflow.status || 'idle'}
              </p>
              <p className="debug-meta">step {stripActivityText(String(step), 40)}</p>
              <p className="debug-meta">{phaseLine || 'Trust — · Hunt — · Verify — · Critic —'}</p>
              <p className="debug-meta">
                Trust {lanes.trust.length} · Hunt {lanes.hunt.length} · Verify {lanes.verify.length} · Critic {lanes.critic.length}
                {w.workflow.tokens ? ` · tokens ${stripActivityText(w.workflow.tokens, 16)}` : ''}
              </p>
            </>
          ) : (
            <p className="empty-inline">No live forge. Send a task from Agents — this card follows Trust / Hunt / Verify / Critic.</p>
          )}
        </section>
        <section className="card debug-card">
          <strong>Ports</strong>
          {w.ports.length ? (
            w.ports.map((p) => (
              <p key={`${p.name}-${p.port}`} className="debug-meta">
                {stripActivityText(p.name, 24)} · {p.port}
              </p>
            ))
          ) : (
            <p className="empty-inline">No kernel ports yet.</p>
          )}
        </section>
        <section className="card debug-card">
          <strong>Pending writes</strong>
          {w.pending.length ? (
            w.pending.slice(0, 8).map((p) => (
              <p key={p.path} className="debug-meta">
                {stripActivityText(p.path.split('/').pop() || p.path, 60)}
              </p>
            ))
          ) : (
            <p className="empty-inline">Working tree clean from the agent&apos;s view.</p>
          )}
        </section>
      </div>
      {err ? <div className="warn-banner">{err}</div> : null}
      <div className="debug-trace">
        <h3 className="hx-section">Last kernel trace</h3>
        <pre>{trace}</pre>
      </div>
      <div className="form debug-qa">
        <textarea placeholder="What did you verify?" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="ghost" onClick={() => void save('pass')}>
            Pass
          </button>
          <button type="button" className="ghost" onClick={() => void save('fail')}>
            Fail
          </button>
          <button type="button" className="ghost" onClick={() => void save('pending')}>
            Pending
          </button>
        </div>
      </div>
      <div className="debug-hist">
        <h3 className="hx-section">QA history</h3>
        {w.qa.length === 0 ? (
          <HxEmpty compact title="No verdicts yet" body="Pass / fail keeps the skill loop honest." />
        ) : (
          w.qa.map((q) => (
            <div key={q.id} className={`qa-card ${q.verdict}`}>
              <div className="pf-bar" data-verdict={q.verdict}>
                <span className="pf-pass" />
                <span className="pf-fail" />
              </div>
              <strong>
                {q.verdict} · {stripActivityText(q.prompt, 80)}
              </strong>
              {q.notes ? <small>{stripActivityText(q.notes, 160)}</small> : null}
            </div>
          ))
        )}
      </div>
    </div>
    </HxPage>
  )
}

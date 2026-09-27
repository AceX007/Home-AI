import { useState, type RefObject } from 'react'
import { Check, Square, X } from 'lucide-react'
import {
  emptyWorkflow,
  FORGE_STEPS,
  formatDuration,
  splitWorkflowPhases,
  stripActivityText,
  toolCallName,
  workflowPips,
  workflowTokenLabel
} from '@homeai/runtime/browser'
import { HxEmpty } from '../layout/HxPage'
import { useWorkbench } from '../store/useWorkbench'

type CloudJob = { id: string; status: string; name: string; summary?: string }

function jobTone(status: string): 'ok' | 'err' | 'run' | 'wait' {
  const s = status.toLowerCase()
  if (/fail|error|cancel/.test(s)) return 'err'
  if (/done|complete|finish|success/.test(s)) return 'ok'
  if (/run|progress|active|creat/.test(s)) return 'run'
  return 'wait'
}

function statusLabel(status: string): string {
  if (status === 'done') return 'Done'
  if (status === 'error') return 'Error'
  if (status === 'stopped') return 'Stopped'
  return 'Running'
}

export function BackgroundTasks({
  wide,
  now,
  phase,
  phaseIdx,
  runMs,
  logRef,
  jobs,
  jobsOpen,
  jobsBusy,
  jobsErr,
  onWide,
  onClose,
  onToggleJobs,
  onRefreshJobs,
  onOpenJob
}: {
  wide: boolean
  now: number
  phase: string
  phaseIdx: number
  runMs: number
  logRef: RefObject<HTMLDivElement | null>
  jobs: CloudJob[]
  jobsOpen: boolean
  jobsBusy: boolean
  jobsErr: string
  onWide: () => void
  onClose: () => void
  onToggleJobs: () => void
  onRefreshJobs: () => void
  onOpenJob: (id: string) => void
}) {
  const w = useWorkbench()
  const wf = w.workflow
  const llm = w.boot?.llm
  const lanes = splitWorkflowPhases(wf)
  const [openLane, setOpenLane] = useState<Record<string, boolean>>({ trust: true, hunt: true, verify: true, critic: true })
  const tokenLabel = workflowTokenLabel(wf)
  const elapsed =
    wf.status === 'running' && (w.busy || w.waitingShell)
      ? formatDuration(runMs || Math.max(0, now - (wf.started || now)))
      : wf.started
        ? formatDuration((wf.ended || now) - wf.started)
        : formatDuration(runMs)
  const showCard = Boolean(wf.id)
  const canStop = Boolean(w.runId) && wf.status === 'running'
  const desc = stripActivityText(wf.description || w.goal, 160)
  const agentN = wf.agents.length

  const scrollTo = (name: string) => {
    const n = toolCallName(name)
    if (!n) return
    useWorkbench.getState().revealTool(n)
    const el = logRef.current
    if (!el) return
    const hit = el.querySelector(`[data-tool="${n}"]`)
    hit?.scrollIntoView({ block: 'nearest' })
  }

  const Lane = ({
    title,
    keyName,
    rows,
    skipped
  }: {
    title: string
    keyName: 'trust' | 'hunt' | 'verify' | 'critic'
    rows: Array<{
      id: string
      name: string
      status: string
      started: number
      ended: number
      tokens: string
      model: string
    }>
    skipped?: boolean
  }) => {
    const opened = openLane[keyName] !== false
    const doneN = rows.filter((a) => a.status === 'done').length
    const total = skipped && rows.length === 0 ? 0 : rows.length
    const frac = skipped && total === 0 ? 'skipped' : `${doneN}/${Math.max(total, 0)}`
    return (
      <div className="bg-lane">
        <button
          type="button"
          className="bg-lane-head"
          onClick={() => setOpenLane((m) => ({ ...m, [keyName]: !opened }))}
        >
          <span className={`caret ${opened ? 'open' : ''}`}>›</span>
          <h4>
            {title} {frac}
          </h4>
        </button>
        {rows.length ? (
          <div className="bg-pips">
            {workflowPips(rows).map((k, i) => (
              <span key={`${title}-${i}`} className={k} />
            ))}
          </div>
        ) : null}
        {opened ? (
          rows.length ? (
            <div className="bg-agent-table">
              <span className="bg-agent-head">Agent</span>
              <span className="bg-agent-head">Model</span>
              <span className="bg-agent-head">Tokens</span>
              <span className="bg-agent-head">Time</span>
              {rows.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`bg-agent-row ${a.status}`}
                  onClick={() => scrollTo(a.name)}
                >
                  <span className="bg-agent-name">
                    {a.status === 'done' ? <Check size={12} /> : null}
                    {a.name}
                  </span>
                  <span>{stripActivityText(a.model || wf.model, 24)}</span>
                  <span>{a.tokens || '—'}</span>
                  <span>
                    {a.ended
                      ? formatDuration(a.ended - a.started)
                      : a.status === 'running'
                        ? formatDuration(now - a.started)
                        : '—'}
                  </span>
                </button>
              ))}
            </div>
          ) : skipped ? (
            <div className="muted">Critic skipped</div>
          ) : null
        ) : null}
      </div>
    )
  }

  return (
    <aside className="agents-bg">
      <div className="bg-head">
        <span>Background tasks</span>
        <span className="bg-head-btns">
          <button type="button" className="icon-btn" title="Expand" onClick={onWide}>
            {wide ? '▣' : '▢'}
          </button>
          <button type="button" className="icon-btn" title="Close" onClick={onClose}>
            <X size={14} />
          </button>
        </span>
      </div>
      <button
        type="button"
        className={`bg-row ${llm?.running ? 'on' : ''}`}
        onClick={() => useWorkbench.setState({ llamaOpen: true })}
      >
        <b>Local 2B</b>
        <span>{llm?.running ? 'running' : w.kernelPulse?.llamaErr ? 'error' : 'idle'}</span>
      </button>
      {!showCard ? (
        <HxEmpty compact title="No forge yet" body="Send a task from Chat and Cowork. Trust, Hunt, Verify, and Critic land here." />
      ) : null}
      {showCard ? (
        <div className="bg-run-card">
          <div className={`bg-run-status ${wf.status}`}>{statusLabel(wf.status)}</div>
          <div className="bg-run-head">
            <b className="bg-run-id">{wf.id}</b>
            {canStop ? (
              <button type="button" className="icon-btn" title="Stop" onClick={() => w.stop()}>
                <Square size={11} fill="currentColor" />
              </button>
            ) : null}
          </div>
          <span>
            Workflow {elapsed} · {agentN} agents
            {tokenLabel ? ` · ${tokenLabel}` : ''}
          </span>
          {desc ? <div className="bg-run-desc">{desc}</div> : null}
        </div>
      ) : null}
      <div className="bg-phase">
        <div className="bg-phase-lab">
          Forge {phase || 'idle'} · {phaseIdx + 1}/{FORGE_STEPS.length}
          {w.busy ? ` · ${formatDuration(runMs)}` : ''}
          {agentN ? ` · ${agentN} tools` : ''}
          {w.ring ? ` · ${w.ring.total} tok` : ''}
        </div>
        <div className="bg-phase-bar">
          <span style={{ width: `${((phaseIdx + (w.busy ? 1 : 0)) / FORGE_STEPS.length) * 100}%` }} />
        </div>
        <div className="bg-steps">
          {FORGE_STEPS.map((s) => (
            <span key={s} className={s === phase ? 'on' : ''}>
              {s}
            </span>
          ))}
        </div>
      </div>
      {w.ring ? (
        <div className="bg-row">
          <b>Context</b>
          <span>
            {w.ring.total} / {w.ring.cap}
          </span>
        </div>
      ) : null}
      {wf.fleet ? (
        <div className="bg-row">
          <b>Fleet</b>
          <span>{stripActivityText(wf.fleet, 80)}</span>
        </div>
      ) : null}
      {w.queue.map((q, i) => (
        <div key={`q-${i}`} className="bg-row wait">
          <b>queued</b>
          <span>{stripActivityText(q, 40)}</span>
        </div>
      ))}
      <div className="bg-lanes">
        <Lane title="Trust" keyName="trust" rows={lanes.trust} />
        <Lane title="Hunt" keyName="hunt" rows={lanes.hunt} />
        <Lane title="Verify" keyName="verify" rows={lanes.verify} />
        <Lane title="Critic" keyName="critic" rows={lanes.critic} skipped={wf.criticSkipped} />
      </div>
      {w.ptyCount > 0 ? (
        <div className="bg-row on">
          <b>Terminals</b>
          <span>{w.ptyCount} live</span>
        </div>
      ) : null}
      <div className="bg-jobs-head">
        <button type="button" className="ghost tiny" onClick={onToggleJobs}>
          Cloud jobs{jobs.length ? ` (${jobs.length})` : ''}
        </button>
        <button type="button" className="ghost tiny" disabled={jobsBusy} onClick={onRefreshJobs}>
          {jobsBusy ? '…' : 'Refresh'}
        </button>
      </div>
      {jobsOpen ? (
        <div className="bg-jobs">
          {jobsErr ? <div className="muted">{jobsErr}</div> : null}
          {!jobsErr && jobs.length === 0 ? (
            <div className="muted">Cloud jobs need a Cursor key in Settings.</div>
          ) : null}
          {jobs.map((j) => (
            <button key={j.id} type="button" className="cloud-job" onClick={() => onOpenJob(j.id)}>
              <b className={jobTone(j.status)}>{j.status}</b> {j.name}
            </button>
          ))}
        </div>
      ) : null}
      {wf.agents.length > 0 ? (
        <button
          type="button"
          className="ghost tiny bg-clear"
          onClick={() => useWorkbench.setState({ subagents: [], workflow: emptyWorkflow() })}
        >
          Clear tool list
        </button>
      ) : null}
    </aside>
  )
}

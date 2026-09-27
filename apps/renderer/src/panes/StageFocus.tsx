import {
  countRunningTasks,
  stripActivityText,
  workflowForgeStep
} from '@homeai/runtime/browser'
import { useWorkbench } from '../store/useWorkbench'

/** Focus regime ticker. Wait/approval open Stage so Trust is not invisible. */
export function FocusTicker() {
  const w = useWorkbench()
  const phase = workflowForgeStep(w.log, w.workflow)
  const last = [...w.subagents].reverse().find((a) => a.status === 'running') ?? w.subagents[w.subagents.length - 1]
  const n = countRunningTasks({
    busy: w.busy,
    waitingShell: w.waitingShell,
    subRunning: w.subagents.filter((a) => a.status === 'running').length,
    cloudRunning: 0,
    ptyCount: 0,
    queueLen: w.queue.length
  })
  const hold = Boolean(w.waitingShell || w.approval)
  return (
    <button
      type="button"
      className={`agents-ticker ${hold ? 'hold' : ''}`}
      title={hold ? 'Open Stage — shell or tool waiting' : 'Open Agents Stage'}
      onClick={() =>
        useWorkbench.setState({
          layoutMode: 'stage',
          chatOpen: true,
          termOpen: w.waitingShell ? true : w.termOpen,
          termPanel: w.waitingShell ? 'shells' : w.termPanel
        })
      }
    >
      <span className={hold ? 'live-pill wait' : w.busy ? 'live-pill' : ''}>{hold ? 'Hold' : w.busy ? 'Live' : 'Idle'}</span>
      <span>Forge {phase || 'idle'}</span>
      {n > 0 ? <span className="run-badge tight">{n}</span> : null}
      {w.approval ? <span>Allow {stripActivityText(w.approval.tool, 24)}</span> : null}
      {last && !hold ? <span>{stripActivityText(last.name, 32)}</span> : null}
    </button>
  )
}

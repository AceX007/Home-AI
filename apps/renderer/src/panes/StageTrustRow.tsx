import { forgeIsFault, lastForgeError, stripActivityText, lastAutoReviewLine } from '@homeai/runtime/browser'
import { useWorkbench } from '../store/useWorkbench'

/** Sticky wait + Allow/Deny + Trust counts. Lives under the live rail so Focus cannot hide it once Stage is open. */
export function StageTrustRow() {
  const w = useWorkbench()
  const fault = forgeIsFault(w.log)
  const err = fault ? lastForgeError(w.log) : ''
  const ar = lastAutoReviewLine(w.log)
  const trust = ar ? 'Local 2B · Auto-review · no Landlock' : 'Local 2B · Ask · no Landlock'
  return (
    <>
      {w.waitingShell ? (
        <button
          type="button"
          className="wait-banner"
          onClick={() => useWorkbench.setState({ termOpen: true, termPanel: 'shells' })}
        >
          Shell waiting for approval — open Agent shells
        </button>
      ) : null}
      {w.approval && w.runId ? (
        <div className="ask-box trust-ask">
          <strong>Allow {stripActivityText(w.approval.tool, 40)}?</strong>
          <pre className="git-pre">{stripActivityText(w.approval.detail, 400)}</pre>
          <div className="trust-ask-btns">
            <button
              className="send"
              onClick={() => {
                window.homeai.approveAgent(w.runId!, true)
                useWorkbench.setState({ approval: undefined, allowCount: useWorkbench.getState().allowCount + 1 })
              }}
            >
              Allow
            </button>
            <button
              className="ghost tiny"
              onClick={() => {
                window.homeai.approveAgent(w.runId!, false)
                useWorkbench.setState({ approval: undefined, denyCount: useWorkbench.getState().denyCount + 1 })
              }}
            >
              Deny
            </button>
          </div>
        </div>
      ) : null}
      {err ? <div className="forge-err">Think stays implementing · {err}</div> : null}
      {w.waitingShell || w.approval || err || w.allowCount > 0 || w.denyCount > 0 ? (
        <button type="button" className="trust-chip row" onClick={() => w.setActivity('settings')}>
          {trust} · allow {w.allowCount} · deny {w.denyCount}
        </button>
      ) : null}
      {ar ? <span className="auto-review-line">{ar}</span> : null}
    </>
  )
}

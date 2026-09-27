import { useState } from 'react'
import { useWorkbench } from '../store/useWorkbench'
import { HxEmpty } from '../layout/HxPage'

function plain(value: unknown) {
  return String(value ?? '')
    .replace(/[<>]/g, '')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .slice(0, 200)
}

export default function RuntimeDebugPane() {
  const session = useWorkbench((s) => s.debugSession)
  const breakpoints = useWorkbench((s) => s.debugBreakpoints)
  const watchExpr = useWorkbench((s) => s.watchExpr)
  const evalExpr = useWorkbench((s) => s.evalExpr)
  const [watchOut, setWatchOut] = useState('')

  const openFrame = async (path: string, line: number) => {
    await useWorkbench.getState().openFile(path)
    useWorkbench.setState({ outlineJump: { path, line } })
  }

  const startActive = async () => {
    const path = useWorkbench.getState().activePath
    if (!path) return
    const snap = await window.homeai.debugStart({ path })
    useWorkbench.setState({ debugSession: snap, termPanel: 'runtime', termOpen: true })
  }

  const debugTest = async () => {
    const hit = session.testFailure
    if (!hit) return
    await window.homeai.debugBreakpoint({ path: hit.path, line: hit.line, enabled: true })
    const snap = await window.homeai.debugStart({ path: hit.path })
    useWorkbench.setState({ debugSession: snap, termPanel: 'runtime', termOpen: true })
    await openFrame(hit.path, hit.line)
  }

  return (
    <div>
      <div className="runtime-toolbar">
        <button type="button" className="ghost tiny" aria-label="Continue" onClick={() => void window.homeai.debugContinue({ kind: 'continue' }).then((snap) => useWorkbench.setState({ debugSession: snap }))}>
          Continue
        </button>
        <button type="button" className="ghost tiny" aria-label="Step over" onClick={() => void window.homeai.debugContinue({ kind: 'stepOver' }).then((snap) => useWorkbench.setState({ debugSession: snap }))}>
          Step
        </button>
        <button type="button" className="ghost tiny" aria-label="Stop debug session" onClick={() => void window.homeai.debugStop().then((snap) => useWorkbench.setState({ debugSession: snap }))}>
          Stop
        </button>
        <button type="button" className="ghost tiny" aria-label="Start debug on active file" onClick={() => void startActive()}>
          Start
        </button>
      </div>
      <div className="panel-line">{plain(`${session.status}${session.path ? ` · ${session.path}` : ''}${session.port ? ` · 127.0.0.1:${session.port}` : ''}`) || 'idle'}</div>
      {session.testFailure ? (
        <button type="button" className="ghost tiny" aria-label="Debug this test" onClick={() => void debugTest()}>
          Debug this test
        </button>
      ) : null}
      {session.frames.length ? (
        session.frames.map((frame, i) => (
          <button
            type="button"
            key={`${frame.path}:${frame.line}:${i}`}
            className="panel-line problem-row"
            onClick={() => void openFrame(frame.path, frame.line)}
          >
            {plain(`${frame.name} · ${frame.path}:${frame.line}`)}
          </button>
        ))
      ) : (
        <HxEmpty compact title="No stack" body="Start a jailed Node Inspector session, then pause on a breakpoint." />
      )}
      {session.locals.map((row) => (
        <div key={row.name} className="panel-line">
          {plain(`${row.name} = ${row.value}`)}
        </div>
      ))}
      {breakpoints.map((bp) => (
        <div key={`${bp.path}:${bp.line}`} className="panel-line">
          {plain(`${bp.path}:${bp.line}`)}
        </div>
      ))}
      <div className="runtime-eval">
        <input
          aria-label="Watch expression"
          value={watchExpr}
          onChange={(e) => useWorkbench.setState({ watchExpr: e.target.value.replace(/[<>]/g, '').slice(0, 80) })}
          placeholder="watch"
        />
        <button
          type="button"
          className="ghost tiny"
          aria-label="Run watch"
          onClick={async () => {
            try {
              setWatchOut(plain(await window.homeai.debugEvaluate({ expression: watchExpr })))
            } catch (err) {
              setWatchOut(plain(err instanceof Error ? err.message : 'watch failed'))
            }
          }}
        >
          Watch
        </button>
        {watchOut ? <span className="panel-line">{watchOut}</span> : null}
      </div>
      <div className="runtime-eval">
        <input
          aria-label="Evaluate expression"
          value={evalExpr}
          onChange={(e) => useWorkbench.setState({ evalExpr: e.target.value.replace(/[<>]/g, '').slice(0, 80) })}
          placeholder="evaluate"
          onKeyDown={async (e) => {
            if (e.key !== 'Enter') return
            try {
              const value = await window.homeai.debugEvaluate({ expression: evalExpr })
              useWorkbench.setState((s) => ({
                debugSession: {
                  ...s.debugSession,
                  console: [...s.debugSession.console, plain(value)].slice(-40)
                }
              }))
            } catch (err) {
              useWorkbench.setState((s) => ({
                debugSession: {
                  ...s.debugSession,
                  console: [...s.debugSession.console, plain(err instanceof Error ? err.message : 'eval failed')].slice(-40)
                }
              }))
            }
          }}
        />
      </div>
      {session.console.map((line, i) => (
        <div key={i} className="panel-line">
          {plain(line)}
        </div>
      ))}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useWorkbench, workspaceRel } from '../store/useWorkbench'
import { redactDebugText, stripActivityText, workflowPhaseLine } from '@homeai/runtime/browser'
import { HxEmpty } from '../layout/HxPage'
import RuntimeDebugPane from './RuntimeDebugPane'

type Sess = { id: number; name: string }

function activateByKey(e: { key: string; preventDefault: () => void }, run: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    run()
  }
}

export default function TerminalPane() {
  const host = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const activeRef = useRef(0)
  const started = useRef(false)
  const [sessions, setSessions] = useState<Sess[]>([])
  const [active, setActive] = useState(0)
  const panel = useWorkbench((s) => s.termPanel)
  const qaChecks = useWorkbench((s) => s.qa)
  const diagnostics = useWorkbench((s) => s.diagnostics)
  const testFailure = useWorkbench((s) => s.debugSession.testFailure)
  const workspace = useWorkbench((s) => s.boot?.workspace)
  const problems = diagnostics
  const log = useWorkbench((s) => s.log)
  const lastTrace = useWorkbench((s) => s.lastTrace)
  const ports = useWorkbench((s) => s.ports)
  const spawnReq = useWorkbench((s) => s.ptySpawn)
  const workflow = useWorkbench((s) => s.workflow)

  const outLines = log
    .filter((row) => row.kind === 'status' || row.kind === 'shell' || row.kind === 'error' || row.kind === 'tool')
    .slice(-80)
    .map((row) => String(row.text || '').replace(/[<>]/g, '').replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 200))
    .filter(Boolean)

  const spawn = async () => {
    const term = termRef.current
    if (!term) return
    const id = await window.homeai.ptyCreate(term.cols, term.rows)
    setSessions((s) => {
      const name = s.length === 0 ? 'bash' : `bash ${s.length + 1}`
      const next = [...s, { id, name }]
      useWorkbench.setState({ ptyCount: next.length, termOpen: true })
      return next
    })
    activeRef.current = id
    setActive(id)
  }

  const focus = async (id: number) => {
    activeRef.current = id
    setActive(id)
    const term = termRef.current
    if (!term) return
    const buf = await window.homeai.ptyTranscript(id)
    term.reset()
    term.write(buf)
  }

  useEffect(() => {
    if (!host.current || started.current) return
    if (!window.homeai?.onPtyData) return
    started.current = true
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, IBM Plex Mono, ui-monospace, monospace',
      fontSize: 12,
      theme: {
        background: '#141414',
        foreground: '#cccccc',
        cursor: '#3ecf8e',
        selectionBackground: '#264f78',
        black: '#1e1e1e',
        red: '#f48771',
        green: '#3ecf8e',
        yellow: '#dcb67a',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#cccccc'
      }
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host.current)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    const unsub = window.homeai.onPtyData((pid, data) => {
      if (pid === activeRef.current) term.write(data)
    })
    const unsubExit = window.homeai.onPtyExit
      ? window.homeai.onPtyExit((pid, code) => {
          if (pid === activeRef.current) term.writeln(`\r\n[exit ${Number(code) || 0}]`)
        })
      : () => {}
    term.onData((d) => {
      const id = activeRef.current
      if (id) window.homeai.ptyWrite(id, d)
    })
    const ro = new ResizeObserver(() => {
      fit.fit()
      const id = activeRef.current
      if (id) window.homeai.ptyResize(id, term.cols, term.rows)
    })
    if (host.current) ro.observe(host.current)

    void window.homeai
      .ptyCreate(term.cols, term.rows)
      .then((id) => {
        activeRef.current = id
        setActive(id)
        setSessions([{ id, name: 'bash' }])
        useWorkbench.setState({ ptyCount: 1 })
      })
      .catch((err) => {
        term.writeln(String(err))
        term.writeln('Kernel still runs. Rebuild native modules: npx electron-builder install-app-deps')
      })

    return () => {
      unsub()
      unsubExit()
      term.dispose()
    }
  }, [])

  useEffect(() => {
    if (!spawnReq) return
    void spawn()
  }, [spawnReq])

  return (
    <>
      <div className="term-tabs" role="tablist" aria-label="Bottom panels">
        <button
          type="button"
          className={`term-tab ${panel === 'problems' ? 'on' : ''}`}
          role="tab"
          aria-selected={panel === 'problems'}
          tabIndex={0}
          onClick={() => useWorkbench.getState().setActivity('qa', { termPanel: 'problems', termOpen: true })}
          onKeyDown={(e) => activateByKey(e, () => useWorkbench.getState().setActivity('qa', { termPanel: 'problems', termOpen: true }))}
        >
          Checks{problems.length + qaChecks.length ? ` (${problems.length + qaChecks.length})` : ''}
        </button>
        <button
          type="button"
          className={`term-tab ${panel === 'output' ? 'on' : ''}`}
          role="tab"
          aria-selected={panel === 'output'}
          onClick={() => useWorkbench.setState({ termPanel: 'output' })}
          onKeyDown={(e) => activateByKey(e, () => useWorkbench.setState({ termPanel: 'output' }))}
        >
          Kernel log
        </button>
        <button
          type="button"
          className={`term-tab ${panel === 'debug' ? 'on' : ''}`}
          role="tab"
          aria-selected={panel === 'debug'}
          onClick={() => useWorkbench.getState().setActivity('qa', { termOpen: true, termPanel: 'debug' })}
          onKeyDown={(e) => activateByKey(e, () => useWorkbench.getState().setActivity('qa', { termOpen: true, termPanel: 'debug' }))}
        >
          Workflow
        </button>
        <button
          type="button"
          className={`term-tab ${panel === 'runtime' ? 'on' : ''}`}
          role="tab"
          aria-selected={panel === 'runtime'}
          onClick={() => useWorkbench.setState({ termOpen: true, termPanel: 'runtime' })}
          onKeyDown={(e) => activateByKey(e, () => useWorkbench.setState({ termOpen: true, termPanel: 'runtime' }))}
        >
          Runtime
        </button>
        <button
          type="button"
          className={`term-tab ${panel === 'terminal' ? 'on' : ''}`}
          role="tab"
          aria-selected={panel === 'terminal'}
          onClick={() => useWorkbench.setState({ termPanel: 'terminal' })}
          onKeyDown={(e) => activateByKey(e, () => useWorkbench.setState({ termPanel: 'terminal' }))}
        >
          Terminal
        </button>
        <button
          type="button"
          className={`term-tab ${panel === 'ports' ? 'on' : ''}`}
          role="tab"
          aria-selected={panel === 'ports'}
          onClick={() => useWorkbench.setState({ termPanel: 'ports' })}
          onKeyDown={(e) => activateByKey(e, () => useWorkbench.setState({ termPanel: 'ports' }))}
        >
          Ports
        </button>
        <button
          type="button"
          className={`term-tab ${panel === 'shells' ? 'on' : ''}`}
          role="tab"
          aria-selected={panel === 'shells'}
          onClick={() => useWorkbench.setState({ termPanel: 'shells' })}
          onKeyDown={(e) => activateByKey(e, () => useWorkbench.setState({ termPanel: 'shells' }))}
        >
          Agent shells
        </button>
        <span className="spacer" />
        {sessions.map((s) => (
          <button
            type="button"
            key={s.id}
            className={`term-sess ${s.id === active && panel === 'terminal' ? 'on' : ''}`}
            onClick={() => {
              useWorkbench.setState({ termPanel: 'terminal' })
              void focus(s.id)
            }}
            onKeyDown={(e) =>
              activateByKey(e, () => {
                useWorkbench.setState({ termPanel: 'terminal' })
                void focus(s.id)
              })
            }
          >
            {s.name}
          </button>
        ))}
        <button
          type="button"
          className="term-new"
          title="New Terminal"
          aria-label="New Terminal"
          onClick={() => {
            useWorkbench.setState({ termOpen: true, termPanel: 'terminal' })
            void spawn()
          }}
        >
          <Plus size={12} />
        </button>
      </div>
      <div ref={host} style={{ flex: 1, minHeight: 0, padding: '0 8px 8px', display: panel === 'terminal' ? 'block' : 'none' }} />
      {panel !== 'terminal' && (
        <div className="panel-body" role="tabpanel" aria-label={panel === 'problems' ? 'Checks' : panel === 'runtime' ? 'Runtime' : panel === 'debug' ? 'Workflow' : 'Kernel panel'}>
          {panel === 'problems' ? (
            diagnostics.length || qaChecks.length ? (
              <>
                {diagnostics.length ? <div className="panel-line"><strong>Compiler diagnostics</strong></div> : null}
                {diagnostics.map((row) => (
                  <button
                    type="button"
                    key={`${row.path}:${row.startLine}:${row.startColumn}:${row.code}`}
                    className="panel-line problem-row"
                    onClick={async () => {
                      await useWorkbench.getState().openFile(row.path)
                      useWorkbench.setState({ outlineJump: { path: row.path, line: row.startLine } })
                    }}
                  >
                    {`${row.severity} TS${row.code} · ${(workspace && workspaceRel(workspace, row.path)) || row.path.split('/').pop()}:${row.startLine}:${row.startColumn} · ${row.message.replace(/[<>]/g, '').slice(0, 180)}`}
                  </button>
                ))}
                {qaChecks.length ? (
                  <>
                    <div className="panel-line"><strong>QA records</strong></div>
                    <div role="list" aria-label="QA records">
                      {qaChecks.map((q, i) => (
                        <div key={i} className="panel-line" role="listitem">
                          {`${q.verdict} · ${String(q.prompt || q.notes || 'item').replace(/[<>]/g, '').slice(0, 140)}`}
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
                {testFailure ? (
                  <button
                    type="button"
                    className="ghost tiny"
                    aria-label="Debug this test"
                    onClick={async () => {
                      useWorkbench.setState({ termPanel: 'runtime', termOpen: true })
                      await window.homeai.debugBreakpoint({ path: testFailure.path, line: testFailure.line, enabled: true })
                      const snap = await window.homeai.debugStart({ path: testFailure.path })
                      useWorkbench.setState({ debugSession: snap })
                      await useWorkbench.getState().openFile(testFailure.path)
                      useWorkbench.setState({ outlineJump: { path: testFailure.path, line: testFailure.line } })
                    }}
                  >
                    Debug this test
                  </button>
                ) : null}
              </>
            ) : (
              <HxEmpty compact title="No problems" body="TypeScript diagnostics and QA records appear here." />
            )
          ) : null}
          {panel === 'output' ? (
            outLines.length ? (
              outLines.map((line, i) => (
                <div key={i} className="panel-line">
                  {line}
                </div>
              ))
            ) : (
              <HxEmpty compact title="No kernel output" body="Status, shell, tool, and error lines appear here while a job runs." />
            )
          ) : null}
          {panel === 'debug' ? (
            <div>
              <div className="panel-line">
                {stripActivityText(workflowPhaseLine(workflow), 120) ||
                  'Trust 0/0 · Hunt 0/0 · Verify 0/0 · Critic 0/0'}
              </div>
              <button type="button" className="ghost tiny" onClick={() => useWorkbench.getState().setActivity('qa')}>
                Open Debug pane
              </button>
              <div className="panel-line">
                {redactDebugText(lastTrace, 800) || 'No debug trace. Run an agent, then open Debug for kernel lanes.'}
              </div>
            </div>
          ) : null}
          {panel === 'runtime' ? <RuntimeDebugPane /> : null}
          {panel === 'ports' ? (
            ports.length ? (
              ports.map((p) => (
                <div key={p.name} className="panel-line">
                  {p.name} · 127.0.0.1:{p.port}
                </div>
              ))
            ) : (
              <HxEmpty compact title="No kernel ports" body="Listening kernel ports (llama, coder) show here. Vite is not a kernel port." />
            )
          ) : null}
          {panel === 'shells' ? (
            log.filter((row) => row.kind === 'shell' || row.kind === 'wait').length ? (
              log
                .filter((row) => row.kind === 'shell' || row.kind === 'wait')
                .slice(-40)
                .map((row) => (
                  <div key={row.id} className="panel-line">
                    {String(('caption' in row && row.caption) || row.text || '')
                      .replace(/[<>]/g, '')
                      .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
                      .slice(0, 200)}
                  </div>
                ))
            ) : (
              <HxEmpty compact title="No agent shells" body="Agent shell waits land here. Click a wait in the feed." />
            )
          ) : null}
        </div>
      )}
    </>
  )
}

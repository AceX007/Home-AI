import { useEffect, useRef, useState } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import * as monaco from 'monaco-editor'
import { useWorkbench, workspaceRel } from '../store/useWorkbench'
import { stripActivityText, takeCrumbPrefix } from '@homeai/runtime/browser'
import { languageFor } from '../lib/monaco'
import type { FileChange } from '@homeai/core'
import PlanDoc, { isPlanPath } from './PlanDoc'
import MapsPane from './MapsPane'
import { HxEmpty } from '../layout/HxPage'
import { bindTsModel, ensureTsLanguageProviders } from '../lib/tsLanguage'

let tabProvider: monaco.IDisposable | undefined
let infillTimer: ReturnType<typeof setTimeout> | undefined
let infillGen = 0

function ensureTabProvider() {
  if (tabProvider) return
  tabProvider = monaco.languages.registerInlineCompletionsProvider('*', {
    provideInlineCompletions: (model, position, _ctx, token) => {
      const gen = ++infillGen
      const prefix = model.getValueInRange({
        startLineNumber: Math.max(1, position.lineNumber - 40),
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      })
      const suffix = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 20),
        endColumn: model.getLineMaxColumn(Math.min(model.getLineCount(), position.lineNumber + 20))
      })
      return new Promise((resolve) => {
        if (infillTimer) clearTimeout(infillTimer)
        infillTimer = setTimeout(async () => {
          if (token.isCancellationRequested || gen !== infillGen) {
            resolve({ items: [] })
            return
          }
          try {
            const insert = await window.homeai.infill({ prefix, suffix })
            if (token.isCancellationRequested || gen !== infillGen || !insert.trim()) {
              resolve({ items: [] })
              return
            }
            resolve({
              items: [
                {
                  insertText: insert,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                  }
                }
              ]
            })
          } catch {
            resolve({ items: [] })
          }
        }, 380)
      })
    },
    freeInlineCompletions: () => undefined
  })
}

export default function EditorPane({ bindPath, chrome = true }: { bindPath?: string; chrome?: boolean }) {
  const w = useWorkbench()
  const path = bindPath || w.activePath
  const tab = w.tabs.find((t) => t.path === path)
  const potato = w.boot?.probe.visualTier === 'potato'
  const pending = w.pending.find((p) => p.path === path)
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const gitDeco = useRef<MonacoEditor.IEditorDecorationsCollection | null>(null)
  const bpDeco = useRef<MonacoEditor.IEditorDecorationsCollection | null>(null)
  const gitLines = useRef<{ added: number[]; removed: number[] }>({ added: [], removed: [] })
  const tsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const tsVersion = useRef(0)
  const [inlineHint, setInlineHint] = useState('')
  const [inlineBusy, setInlineBusy] = useState(false)
  const [planView, setPlanView] = useState<'note' | 'both' | 'canvas'>('note')
  const crumbs = path && w.boot?.workspace
    ? (workspaceRel(w.boot.workspace, path) || '')
        .split('/')
        .map((p) => stripActivityText(p, 40))
        .filter((p) => p && !p.includes('..'))
        .slice(0, 12)
    : []
  const rel = path && w.boot?.workspace ? workspaceRel(w.boot.workspace, path) : null

  const refreshTs = (model: MonacoEditor.ITextModel, modelPath: string, delay = 180) => {
    const language = languageFor(modelPath)
    if (language !== 'typescript' && language !== 'javascript') return
    if (tsTimer.current) clearTimeout(tsTimer.current)
    const version = ++tsVersion.current
    tsTimer.current = setTimeout(async () => {
      const text = model.getValue()
      try {
        await window.homeai.tsSync(modelPath, text, version)
        const [diagnostics, symbols] = await Promise.all([
          window.homeai.tsDiagnostics({ path: modelPath, text }),
          window.homeai.tsSymbols({ path: modelPath, text })
        ])
        if (version !== tsVersion.current || model.isDisposed()) return
        monaco.editor.setModelMarkers(
          model,
          'hex-typescript',
          diagnostics.map((row) => ({
            startLineNumber: row.startLine,
            startColumn: row.startColumn,
            endLineNumber: row.endLine,
            endColumn: row.endColumn,
            message: `TS${row.code}: ${row.message}`,
            code: String(row.code),
            severity: row.severity === 'error'
              ? monaco.MarkerSeverity.Error
              : row.severity === 'warning'
                ? monaco.MarkerSeverity.Warning
                : row.severity === 'hint'
                  ? monaco.MarkerSeverity.Hint
                  : monaco.MarkerSeverity.Info
          }))
        )
        useWorkbench.setState((state) => ({
          diagnostics: [...state.diagnostics.filter((row) => row.path !== modelPath), ...diagnostics],
          documentSymbols: { ...state.documentSymbols, [modelPath]: symbols }
        }))
      } catch {
        if (!model.isDisposed()) monaco.editor.setModelMarkers(model, 'hex-typescript', [])
      }
    }, delay)
  }

  const applyGutters = (ed: MonacoEditor.IStandaloneCodeEditor, modelPath: string) => {
    gitDeco.current ??= ed.createDecorationsCollection()
    bpDeco.current ??= ed.createDecorationsCollection()
    gitDeco.current.set([
      ...gitLines.current.added.map((line) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: { glyphMarginClassName: 'git-gutter-add', stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges }
      })),
      ...gitLines.current.removed.map((line) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: { glyphMarginClassName: 'git-gutter-del', stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges }
      }))
    ])
    const bps = useWorkbench.getState().debugBreakpoints.filter((row) => row.path === modelPath)
    bpDeco.current.set(
      bps.map((row) => ({
        range: new monaco.Range(row.line, 1, row.line, 1),
        options: { glyphMarginClassName: 'debug-bp', stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges }
      }))
    )
  }

  const toggleBreakpoint = async (modelPath: string, line: number) => {
    const current = useWorkbench.getState().debugBreakpoints
    const on = current.some((row) => row.path === modelPath && row.line === line)
    const next = on
      ? current.filter((row) => !(row.path === modelPath && row.line === line))
      : [...current, { path: modelPath, line }]
    useWorkbench.setState({ debugBreakpoints: next })
    await window.homeai.debugBreakpoint({ path: modelPath, line, enabled: !on })
    const ed = editorRef.current
    if (ed) applyGutters(ed, modelPath)
  }

  useEffect(() => {
    const jump = w.outlineJump
    if (!jump || !editorRef.current || !path) return
    if (jump.path !== path) return
    const line = Math.max(1, jump.line)
    editorRef.current.revealLineInCenter(line)
    editorRef.current.setPosition({ lineNumber: line, column: 1 })
    editorRef.current.focus()
    useWorkbench.setState({ outlineJump: undefined })
  }, [w.outlineJump, path])

  useEffect(() => {
    const ed = editorRef.current
    if (!ed || !path) return
    void window.homeai.gitLines(path).then((lines) => {
      gitLines.current = lines
      applyGutters(ed, path)
    })
    applyGutters(ed, path)
  }, [path, w.debugBreakpoints])

  const goCrumb = (i: number) => {
    if (!rel || !w.boot?.workspace) return
    const prefix = takeCrumbPrefix(rel, i)
    if (!prefix || prefix.includes('..')) return
    useWorkbench.setState({ treeFocus: prefix })
    w.setActivity('files')
  }

  const onMount = (ed: MonacoEditor.IStandaloneCodeEditor) => {
    editorRef.current = ed
    const model = ed.getModel()
    const modelPath = bindPath || useWorkbench.getState().activePath
    if (model && modelPath) {
      ensureTsLanguageProviders()
      bindTsModel(model, modelPath)
      refreshTs(model, modelPath, 0)
    }
    ed.onDidChangeCursorPosition((e) => {
      const p = bindPath || useWorkbench.getState().activePath
      if (!p) return
      useWorkbench.setState({
        cursorPos: { line: e.position.lineNumber, col: e.position.column, lang: languageFor(p) }
      })
    })
    ed.onDidChangeCursorSelection(() => {
      const model = ed.getModel()
      const sel = ed.getSelection()
      const p = bindPath || useWorkbench.getState().activePath
      if (!model || !sel || !p) return
      const text = model.getValueInRange(sel)
      useWorkbench.setState({ selection: { path: p, text } })
    })
    ensureTabProvider()
    ed.addCommand(monaco.KeyCode.Escape, () => {
      ed.trigger('keyboard', 'editor.action.inlineSuggest.hide', null)
      ed.trigger('keyboard', 'hideSuggestWidget', null)
    })
    ed.addCommand(monaco.KeyCode.F9, () => {
      const p = bindPath || useWorkbench.getState().activePath
      const pos = ed.getPosition()
      if (p && pos) void toggleBreakpoint(p, pos.lineNumber)
    })
    const hunkLines = () => [...new Set([...gitLines.current.added, ...gitLines.current.removed])].sort((a, b) => a - b)
    const jumpHunk = (dir: 1 | -1) => {
      const pos = ed.getPosition()
      const lines = hunkLines()
      if (!lines.length) return
      const here = pos?.lineNumber || 0
      const next = dir === 1
        ? lines.find((line) => line > here) || lines[0]
        : [...lines].reverse().find((line) => line < here) || lines[lines.length - 1]
      ed.revealLineInCenter(next)
      ed.setPosition({ lineNumber: next, column: 1 })
    }
    ed.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.F3, () => jumpHunk(1))
    ed.addCommand(monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.F3, () => jumpHunk(-1))
    ed.onMouseDown((e) => {
      if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return
      const p = bindPath || useWorkbench.getState().activePath
      const line = e.target.position?.lineNumber
      if (p && line) void toggleBreakpoint(p, line)
    })
    if (model && modelPath) {
      void window.homeai.gitLines(modelPath).then((lines) => {
        gitLines.current = lines
        applyGutters(ed, modelPath)
      })
    }
  }

  useEffect(() => () => {
    if (tsTimer.current) clearTimeout(tsTimer.current)
  }, [])

  const runInline = async () => {
    if (!path || !inlineHint.trim()) return
    setInlineBusy(true)
    try {
      const selected = w.selection?.path === path ? w.selection.text : ''
      const res = (await window.homeai.inlineEdit({
        path,
        selected,
        instruction: inlineHint,
        provider: w.provider
      })) as { change: FileChange }
      useWorkbench.setState({
        inlineOpen: false,
        pending: [...w.pending.filter((p) => p.path !== res.change.path), res.change]
      })
      const content = await window.homeai.read(path)
      w.setContent(path, content)
      useWorkbench.setState({
        tabs: useWorkbench.getState().tabs.map((t) => (t.path === path ? { ...t, content, dirty: false } : t))
      })
    } finally {
      setInlineBusy(false)
    }
  }

  const keep = async (path: string) => {
    await window.homeai.acceptChange(path)
    await w.refreshPending()
  }
  const undo = async (path: string) => {
    await window.homeai.rejectChange(path)
    await w.refreshPending()
    const content = await window.homeai.read(path)
    useWorkbench.setState({
      tabs: useWorkbench.getState().tabs.map((t) => (t.path === path ? { ...t, content, dirty: false } : t)),
      activePath: path
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {chrome && w.pending.length > 0 && (
        <div className="review-bar">
          <span>
            {w.pending.length} file{w.pending.length === 1 ? '' : 's'} changed
          </span>
          <button
            className="ghost"
            onClick={async () => {
              await window.homeai.acceptAll()
              await w.refreshPending()
            }}
          >
            Keep all
          </button>
          <button
            className="ghost"
            onClick={async () => {
              const paths = (await window.homeai.undoAll()) as string[]
              await w.refreshPending()
              for (const p of paths) {
                try {
                  const content = await window.homeai.read(p)
                  useWorkbench.setState({
                    tabs: useWorkbench.getState().tabs.map((t) => (t.path === p ? { ...t, content, dirty: false } : t))
                  })
                } catch {
                  /* gone */
                }
              }
            }}
          >
            Undo all
          </button>
        </div>
      )}
      {chrome && pending && path && (
        <div className="review-bar slim">
          <span>Review {pending.path.split('/').pop()}</span>
          <button className="ghost" onClick={() => void keep(pending.path)}>
            Keep
          </button>
          <button className="ghost" onClick={() => void undo(pending.path)}>
            Undo
          </button>
        </div>
      )}
      {chrome && crumbs.length > 0 && !isPlanPath(path || '') ? (
        <nav className="editor-crumbs" aria-label="Path">
          {crumbs.map((c, i) => (
            <span key={`${i}-${c}`}>
              {i > 0 ? <span className="crumb-sep">/</span> : null}
              {i === crumbs.length - 1 ? (
                <span className="on">{c}</span>
              ) : (
                <button type="button" onClick={() => goCrumb(i)}>
                  {c}
                </button>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      {chrome && w.inlineOpen && !bindPath && (
        <div className="inline-k">
          <input
            autoFocus
            aria-label="Edit selection"
            placeholder="Edit selection… (Ctrl+K) — e.g. make this async, add types"
            value={inlineHint}
            onChange={(e) => setInlineHint(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runInline()
              if (e.key === 'Escape') useWorkbench.setState({ inlineOpen: false })
            }}
          />
          <button type="button" className="send" disabled={inlineBusy} onClick={() => void runInline()}>
            {inlineBusy ? '…' : 'Edit'}
          </button>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab && pending ? (
          <DiffEditor
            theme="vs-dark"
            language={languageFor(tab.path)}
            original={pending.before}
            modified={pending.after}
            options={{
              readOnly: true,
              renderSideBySide: !potato,
              minimap: { enabled: false },
              fontSize: 13,
              automaticLayout: true
            }}
          />
        ) : tab && isPlanPath(tab.path) ? (
          <div className={`plan-stage ${planView}`}>
            <div className="plan-view-bar">
              {(['note', 'both', 'canvas'] as const).map((v) => (
                <button key={v} type="button" className={planView === v ? 'on' : ''} onClick={() => setPlanView(v)}>
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <div className="plan-split">
              {planView !== 'canvas' ? <PlanDoc path={tab.path} content={tab.content} /> : null}
              {planView !== 'note' ? <MapsPane compact /> : null}
            </div>
          </div>
        ) : tab ? (
          <Editor
            theme="vs-dark"
            path={tab.path}
            language={languageFor(tab.path)}
            value={tab.content}
            onMount={onMount}
            onChange={(v) => {
              w.setContent(tab.path, v ?? '')
              const model = editorRef.current?.getModel()
              if (model) refreshTs(model, tab.path)
            }}
            options={{
              fontFamily: 'JetBrains Mono, IBM Plex Mono, ui-monospace, monospace',
              fontSize: 13,
              minimap: { enabled: !potato },
              smoothScrolling: !potato,
              cursorBlinking: potato ? 'solid' : 'smooth',
              padding: { top: 12 },
              wordWrap: 'on',
              automaticLayout: true,
              inlineSuggest: { enabled: true },
              tabCompletion: 'off',
              glyphMargin: true
            }}
          />
        ) : (
          <HxEmpty
            title="No file open"
            body="Pick a file in the explorer, or stay in Chat and Cowork and type a task. Ctrl+P jumps to a file."
          />
        )}
      </div>
    </div>
  )
}

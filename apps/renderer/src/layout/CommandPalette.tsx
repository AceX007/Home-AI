import { useEffect, useMemo, useState } from 'react'
import { HxEmpty } from './HxPage'
import { useWorkbench } from '../store/useWorkbench'

export default function CommandPalette({ onTick }: { onTick: () => void }) {
  const w = useWorkbench()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)

  const llama = w.kernelPulse?.llama || 'off'
  const pending = w.kernelPulse?.pending ?? w.pending.length
  const commands = useMemo(
    () => [
      { id: 'layout', section: 'Layout', kbd: 'Ctrl+.', label: `Cycle layout · ${w.layoutMode}`, run: () => w.cycleLayoutMode() },
      { id: 'layout-dock', section: 'Layout', kbd: '', label: 'Layout · Dock', run: () => useWorkbench.setState({ layoutMode: 'dock', chatOpen: true }) },
      { id: 'layout-stage', section: 'Layout', kbd: '', label: 'Layout · Stage', run: () => useWorkbench.setState({ layoutMode: 'stage', chatOpen: true }) },
      { id: 'layout-focus', section: 'Layout', kbd: '', label: 'Layout · Focus (Code)', run: () => useWorkbench.setState({ layoutMode: 'focus', chatOpen: true }) },
      { id: 'density', section: 'Layout', kbd: '', label: `Density · ${w.density}`, run: () => w.cycleDensity() },
      { id: 'new-chat', section: 'Agents', kbd: '', label: 'New chat', run: () => { w.newChat(); useWorkbench.setState({ chatOpen: true }) } },
      { id: 'chat', section: 'Agents', kbd: 'Ctrl+L', label: 'Toggle kernel chat', run: () => useWorkbench.setState({ chatOpen: !w.chatOpen }) },
      { id: 'mode', section: 'Agents', kbd: 'Shift+Tab', label: 'Cycle mode', run: () => w.cycleMode() },
      { id: 'think', section: 'Agents', kbd: '', label: w.thinkHint === 'ready' ? 'Think ready — Implement' : w.thinkHint ? `Think · ${w.thinkHint}` : 'Think mode — local 2B researches, then Implement', run: () => useWorkbench.setState({ agentMode: 'think', chatOpen: true }) },
      { id: 'halt', section: 'Agents', kbd: 'Ctrl+Shift+Q', label: 'Halt running job', run: () => w.stop() },
      { id: 'stage', section: 'Agents', kbd: '', label: 'Open Stage', run: () => useWorkbench.setState({ layoutMode: 'stage', chatOpen: true }) },
      { id: 'skills', section: 'Agents', kbd: '', label: 'Skills', run: () => w.setActivity('mods') },
      { id: 'tools', section: 'Agents', kbd: '', label: 'Tools / MCP', run: () => w.setActivity('mods') },
      { id: 'trust', section: 'Trust', kbd: '', label: `Trust cockpit · ${pending} pending`, run: () => w.setActivity('settings') },
      { id: 'review', section: 'Trust', kbd: '', label: 'Agent review (quick)', run: async () => {
          useWorkbench.setState({ chatOpen: true })
          try {
            const res = await window.homeai.agentReview('quick')
            useWorkbench.setState({ reviewText: res.text || '', chatOpen: true })
          } catch (err) {
            useWorkbench.setState({
              reviewText: err instanceof Error ? err.message : String(err),
              chatOpen: true
            })
          }
        } },
      { id: 'accept-all', section: 'Trust', kbd: '', label: 'Keep all pending diffs', run: async () => {
          await window.homeai.acceptAll()
          await w.refreshPending()
        } },
      { id: 'llm', section: 'Kernel', kbd: 'Ctrl+Shift+L', label: `Load local 2B · llama ${llama}`, run: async () => {
          await window.homeai.llmStart()
          await w.load()
        } },
      { id: 'unload', section: 'Kernel', kbd: '', label: 'Unload local model', run: async () => {
          await window.homeai.llmStop()
          await w.load()
        } },
      { id: 'kernel', section: 'Kernel', kbd: '', label: 'Kernel pulse / Settings', run: () => w.setActivity('settings') },
      { id: 'mind-local', section: 'Kernel', kbd: '', label: 'Mind: local 2B', run: async () => {
          await window.homeai.profileSet({ defaultProvider: 'local' })
          useWorkbench.setState({ provider: 'local' })
        } },
      { id: 'mind-cloud', section: 'Kernel', kbd: '', label: 'Mind: cloud (OpenRouter)', run: async () => {
          await window.homeai.profileSet({ defaultProvider: 'openrouter' })
          useWorkbench.setState({ provider: 'openrouter' })
        } },
      { id: 'mind-cursor', section: 'Kernel', kbd: '', label: 'Mind: Cursor Cloud Agents', run: async () => {
          await window.homeai.profileSet({ defaultProvider: 'cursor' })
          useWorkbench.setState({ provider: 'cursor' })
        } },
      { id: 'files', section: 'Files', kbd: 'Ctrl+1', label: 'Files', run: () => w.setActivity('files') },
      { id: 'search', section: 'Files', kbd: 'Ctrl+2', label: 'Search RAG + workspace', run: () => w.setActivity('search') },
      { id: 'git', section: 'Files', kbd: 'Ctrl+3', label: `Source control${w.gitDirty.size ? ` · ${w.gitDirty.size}` : ''}`, run: () => w.setActivity('git') },
      { id: 'goto', section: 'Files', kbd: 'Ctrl+P', label: 'Go to file', run: () => useWorkbench.setState({ quickOpen: true }) },
      { id: 'goto-symbol', section: 'Files', kbd: 'Ctrl+Shift+O', label: 'Go to symbol in buffer', run: () => useWorkbench.setState({ outlineOpen: true, palette: false, quickOpen: false }) },
      { id: 'inline', section: 'Files', kbd: 'Ctrl+K', label: 'Inline edit', run: () => { useWorkbench.setState({ inlineOpen: true }); w.setActivity('files') } },
      { id: 'split', section: 'Files', kbd: 'Ctrl+\\', label: 'Split editor', run: () => {
          const st = useWorkbench.getState()
          const next = st.split === 'off' ? 'side' : st.split === 'side' ? 'below' : 'off'
          useWorkbench.setState({
            split: next,
            splitPath: next === 'off' ? undefined : st.splitPath || st.tabs.find((t) => t.path !== st.activePath)?.path || st.activePath
          })
          useWorkbench.getState().setActivity('files')
        } },
      { id: 'save', section: 'Files', kbd: 'Ctrl+S', label: 'Save file', run: () => w.save() },
      { id: 'folder', section: 'Files', kbd: '', label: 'Open folder…', run: async () => {
          await window.homeai.openFolder()
          await w.load()
        } },
      { id: 'term', section: 'Files', kbd: 'Ctrl+`', label: 'Toggle terminal', run: () => useWorkbench.setState({ termOpen: !w.termOpen }) },
      { id: 'notes', section: 'Files', kbd: '', label: 'Notes ground', run: () => w.setActivity('notes') },
      { id: 'board', section: 'Files', kbd: '', label: 'Taskboard', run: () => w.setActivity('board') },
      { id: 'design', section: 'Files', kbd: '', label: 'Code / Design', run: () => w.setActivity('design') },
      { id: 'library', section: 'Files', kbd: '', label: 'Repo library', run: () => w.setActivity('library') },
      { id: 'qa', section: 'Files', kbd: '', label: 'Debug', run: () => w.setActivity('qa') },
      { id: 'web', section: 'Files', kbd: '', label: 'Live the web', run: () => w.setActivity('browser') },
      { id: 'maps', section: 'Files', kbd: '', label: 'Conversation maps', run: () => w.setActivity('maps') },
      { id: 'telegram', section: 'Files', kbd: '', label: 'Telegram session', run: () => w.setActivity('telegram') },
      { id: 'fleet', section: 'Files', kbd: '', label: 'Fleet runtimes', run: () => w.setActivity('fleet') },
      { id: 'settings', section: 'Files', kbd: '', label: 'Settings & API keys', run: () => w.setActivity('settings') },
      { id: 'problems', section: 'Files', kbd: '', label: 'Checks panel', run: () => w.setActivity('qa', { termOpen: true, termPanel: 'problems' }) },
      { id: 'output', section: 'Files', kbd: '', label: 'Kernel log', run: () => useWorkbench.setState({ termOpen: true, termPanel: 'output' }) },
      { id: 'ports', section: 'Files', kbd: '', label: 'Ports panel', run: () => useWorkbench.setState({ termOpen: true, termPanel: 'ports' }) },
      { id: 'runtime', section: 'Files', kbd: '', label: 'Runtime debug', run: () => useWorkbench.setState({ termOpen: true, termPanel: 'runtime' }) }
    ],
    [w, llama, pending]
  )

  const hits = commands.filter(
    (c) => c.label.toLowerCase().includes(q.toLowerCase()) || c.id.toLowerCase().includes(q.toLowerCase())
  )

  useEffect(() => {
    setI(0)
  }, [q])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useWorkbench.setState({ palette: false })
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setI((n) => Math.min(n + 1, Math.max(0, hits.length - 1)))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setI((n) => Math.max(n - 1, 0))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const hit = hits[i]
        if (!hit) return
        void hit.run()
        useWorkbench.setState({ palette: false })
        onTick()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hits, i, onTick])

  const filtered = Boolean(q.trim())

  return (
    <div className="palette-back" onMouseDown={() => useWorkbench.setState({ palette: false })}>
      <div
        className="palette"
        role="dialog"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="palette-head">
          <p className="hx-kicker">Hex AI</p>
          <p className="palette-lead">
            {filtered
              ? 'Matching commands'
              : 'Type to filter commands, grounds, and kernel actions. Arrow keys move. Enter runs.'}
          </p>
        </header>
        <input
          autoFocus
          aria-label="Filter commands"
          placeholder="Command, ground, or kernel action…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {hits.length === 0 ? (
          <HxEmpty
            compact
            title={filtered ? 'No matching commands' : 'Type a command'}
            body="Nothing in Layout, Agents, Trust, Kernel, or Files matches that filter. The query stays text, not HTML."
          />
        ) : (
          <div className="palette-list" role="listbox" aria-label="Commands">
            {hits.map((c, idx) => (
              <div key={c.id}>
                {idx === 0 || hits[idx - 1].section !== c.section ? (
                  <div className="palette-sec">{c.section}</div>
                ) : null}
                <div
                  className={`hit ${idx === i ? 'on' : ''}`}
                  role="option"
                  aria-selected={idx === i}
                  onMouseEnter={() => setI(idx)}
                  onClick={() => {
                    void c.run()
                    useWorkbench.setState({ palette: false })
                    onTick()
                  }}
                >
                  <span>{c.label}</span>
                  {c.kbd ? <kbd>{c.kbd}</kbd> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

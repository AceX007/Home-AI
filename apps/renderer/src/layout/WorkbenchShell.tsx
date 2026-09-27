import { useEffect, useMemo, useState } from 'react'
import {
  BookMarked,
  Bug,
  Files,
  GitBranch,
  Globe,
  LayoutDashboard,
  Map,
  Puzzle,
  Search,
  Settings,
  Smartphone,
  Layers,
  Square,
  StickyNote,
  Frame
} from 'lucide-react'
import { persistWorkbenchLayout, useWorkbench, type Activity } from '../store/useWorkbench'
import {
  activityLabel,
  isEditorActivity,
  isListActivity,
  isPageActivity,
  isStudioActivity,
  sidebarKind,
  takeChatPx,
  takeEditorColumn,
  takeSlots
} from '@homeai/runtime/browser'
import PaneErrorBoundary from './PaneErrorBoundary'
import FileTreePane from '../panes/FileTreePane'
import SearchPane from '../panes/SearchPane'
import EditorPane from '../panes/EditorPane'
import ChatPane from '../panes/ChatPane'
import { FocusTicker } from '../panes/StageFocus'
import TerminalPane from '../panes/TerminalPane'
import NotesPane from '../panes/NotesPane'
import TaskboardPane from '../panes/TaskboardPane'
import LibraryPane from '../panes/LibraryPane'
import QaPane from '../panes/QaPane'
import BrowserPane from '../panes/BrowserPane'
import MapsPane from '../panes/MapsPane'
import SettingsPane from '../panes/SettingsPane'
import TelegramPane from '../panes/TelegramPane'
import FleetPane from '../panes/FleetPane'
import ModsPane from '../panes/ModsPane'
import GitPane from '../panes/GitPane'
import DesignPane from '../panes/DesignPane'
import CommandPalette from './CommandPalette'
import QuickOpen from './QuickOpen'
import GotoSymbol from './GotoSymbol'

const items: Array<{ id: Activity; icon: typeof Files; label: string }> = [
  { id: 'files', icon: Files, label: activityLabel('files') },
  { id: 'search', icon: Search, label: activityLabel('search') },
  { id: 'git', icon: GitBranch, label: activityLabel('git') },
  { id: 'qa', icon: Bug, label: activityLabel('qa') },
  { id: 'browser', icon: Globe, label: activityLabel('browser') },
  { id: 'mods', icon: Puzzle, label: activityLabel('mods') }
]

const moreItems: Array<{ id: Activity; icon: typeof Files; label: string }> = [
  { id: 'notes', icon: StickyNote, label: activityLabel('notes') },
  { id: 'maps', icon: Map, label: activityLabel('maps') },
  { id: 'design', icon: Frame, label: activityLabel('design') },
  { id: 'board', icon: LayoutDashboard, label: activityLabel('board') },
  { id: 'library', icon: BookMarked, label: activityLabel('library') },
  { id: 'telegram', icon: Smartphone, label: activityLabel('telegram') },
  { id: 'fleet', icon: Layers, label: activityLabel('fleet') },
  { id: 'settings', icon: Settings, label: activityLabel('settings') }
]

function ActivitySide({ activity }: { activity: Activity }) {
  const kind = sidebarKind(activity)
  if (kind === 'search') return <SearchPane />
  if (kind === 'git') return <GitPane />
  if (kind === 'notes') return <NotesPane listOnly />
  if (kind === 'debug') return <QaPane listOnly />
  if (kind === 'skills') return <ModsPane listOnly />
  if (kind === 'maps') return <MapsPane listOnly />
  if (kind === 'none') return null
  return <FileTreePane />
}

function activateByKey(e: { key: string; preventDefault: () => void }, run: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    run()
  }
}

export default function WorkbenchShell() {
  const w = useWorkbench()
  const [tick, setTick] = useState(0)
  const [q, setQ] = useState('')
  const [menu, setMenu] = useState<string | null>(null)
  const [about, setAbout] = useState(false)
  const [diag, setDiag] = useState('')

  const drag = (kind: 'side' | 'chat' | 'term', e: React.MouseEvent) => {
    e.preventDefault()
    const start = kind === 'term' ? e.clientY : e.clientX
    const st = useWorkbench.getState()
    const startVal = kind === 'side' ? st.sidebarW : kind === 'chat' ? st.chatW : st.termH
    const move = (ev: MouseEvent) => {
      if (kind === 'side') {
        useWorkbench.setState({ sidebarW: Math.min(480, Math.max(160, startVal + (ev.clientX - start))) })
      } else if (kind === 'chat') {
        const hi = useWorkbench.getState().layoutMode === 'stage' ? 2400 : 720
        useWorkbench.setState({ chatW: Math.min(hi, Math.max(280, startVal - (ev.clientX - start))) })
      } else {
        useWorkbench.setState({ termH: Math.min(420, Math.max(72, startVal - (ev.clientY - start))) })
      }
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const menus: Record<string, Array<{ label: string; run: () => void }>> = {
    File: [
      { label: 'Open Folder…', run: () => void window.homeai.openFolder().then(() => w.load()) },
      { label: 'Save', run: () => void w.save() },
      { label: 'Close Tab', run: () => w.activePath && w.closeTab(w.activePath) }
    ],
    Edit: [{ label: 'Inline Edit (Ctrl+K)', run: () => { useWorkbench.setState({ inlineOpen: true }); useWorkbench.getState().setActivity('files') } }],
    Selection: [{ label: 'Command Palette', run: () => useWorkbench.setState({ palette: true }) }],
    View: [
      { label: 'Toggle Agents', run: () => useWorkbench.setState({ chatOpen: !useWorkbench.getState().chatOpen }) },
      {
        label: 'New chat',
        run: () => {
          useWorkbench.getState().newChat()
          useWorkbench.setState({ chatOpen: true })
        }
      },
      { label: 'Cycle layout Dock/Stage/Focus (Ctrl+.)', run: () => useWorkbench.getState().cycleLayoutMode() },
      {
        label: 'Agents Stage',
        run: () => useWorkbench.setState({ layoutMode: 'stage', chatOpen: true })
      },
      { label: 'Toggle Terminal', run: () => useWorkbench.setState({ termOpen: !useWorkbench.getState().termOpen }) },
      { label: 'Repo library', run: () => useWorkbench.getState().setActivity('library') },
      { label: 'Telegram session', run: () => useWorkbench.getState().setActivity('telegram') },
      { label: 'Fleet runtimes', run: () => useWorkbench.getState().setActivity('fleet') },
      { label: 'Notes', run: () => useWorkbench.getState().setActivity('notes') },
      { label: 'Maps', run: () => useWorkbench.getState().setActivity('maps') },
      {
        label: 'Split editor',
        run: () => {
          const st = useWorkbench.getState()
          const next = st.split === 'off' ? 'side' : st.split === 'side' ? 'below' : 'off'
          useWorkbench.setState({
            split: next,
            splitPath: next === 'off' ? undefined : st.splitPath || st.tabs.find((t) => t.path !== st.activePath)?.path || st.activePath
          })
        }
      },
      { label: 'Code / Design', run: () => useWorkbench.getState().setActivity('design') },
      { label: 'Cycle Provider (Ctrl+/)', run: () => useWorkbench.getState().cycleProvider() },
      { label: 'Command Palette', run: () => useWorkbench.setState({ palette: true }) }
    ],
    Go: [
      { label: 'Quick Open', run: () => useWorkbench.setState({ quickOpen: true }) },
      {
        label: 'New chat',
        run: () => {
          useWorkbench.getState().newChat()
          useWorkbench.setState({ chatOpen: true })
        }
      },
      { label: 'Skills', run: () => useWorkbench.getState().setActivity('mods') },
      { label: 'Tools / MCP', run: () => useWorkbench.getState().setActivity('mods') }
    ],
    Run: [
      {
        label: 'Focus Agent',
        run: () => {
          useWorkbench.setState({ chatOpen: true })
          requestAnimationFrame(() => document.getElementById('composer-input')?.focus())
        }
      },
      { label: 'Debug', run: () => useWorkbench.getState().setActivity('qa') },
      {
        label: 'Agents Stage',
        run: () => useWorkbench.setState({ layoutMode: 'stage', chatOpen: true })
      }
    ],
    Terminal: [
      { label: 'Toggle Terminal', run: () => useWorkbench.setState({ termOpen: !useWorkbench.getState().termOpen }) },
      {
        label: 'New Terminal',
        run: () => useWorkbench.setState({ termOpen: true, termPanel: 'terminal', ptySpawn: Date.now() })
      }
    ],
    Help: [
      { label: 'Open AGENTS.md', run: () => { const root = useWorkbench.getState().boot?.workspace; if (root) void w.openFile(`${root}/AGENTS.md`) } },
      { label: 'About Hex AI', run: () => setAbout(true) }
    ]
  }

  useEffect(() => {
    document.title = 'Hex AI Workbench'
    void w.load()
  }, [])

  useEffect(() => {
    if (!w.layoutReady) return
    const t = window.setTimeout(() => persistWorkbenchLayout(), 400)
    return () => window.clearTimeout(t)
  }, [w.layoutReady, w.activity, w.chatOpen, w.termOpen, w.sidebarW, w.chatW, w.termH, w.termPanel, w.split, w.splitPath, w.activePath, w.tabs, w.layoutMode, w.density, w.cowork, w.pinnedChats])

  useEffect(() => {
    const tickPulse = async () => {
      try {
        const [pulse, ports] = await Promise.all([window.homeai.kernelPulse(), window.homeai.workbenchPorts()])
        useWorkbench.setState({ kernelPulse: pulse as typeof w.kernelPulse, ports, telegramOnline: Boolean((pulse as { telegram?: boolean }).telegram) })
      } catch {
        /* offline */
      }
    }
    void tickPulse()
    const t = window.setInterval(() => void tickPulse(), 4000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey
      if (meta && e.shiftKey && e.key.toLowerCase() === 'q') {
        e.preventDefault()
        useWorkbench.getState().stop()
        return
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        useWorkbench.setState({
          outlineOpen: !useWorkbench.getState().outlineOpen,
          palette: false,
          quickOpen: false
        })
        return
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        useWorkbench.setState({ palette: !useWorkbench.getState().palette, quickOpen: false })
        return
      }
      if (meta && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        useWorkbench.setState({ quickOpen: !useWorkbench.getState().quickOpen, palette: false })
        return
      }
      if (meta && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useWorkbench.setState({ inlineOpen: !useWorkbench.getState().inlineOpen })
        useWorkbench.getState().setActivity('files')
        return
      }
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void w.save()
      }
      if (meta && e.key === '`') {
        e.preventDefault()
        useWorkbench.setState({ termOpen: !useWorkbench.getState().termOpen })
      }
      if (meta && !e.shiftKey && (e.key === '/' || e.code === 'Slash')) {
        e.preventDefault()
        useWorkbench.getState().cycleProvider()
        return
      }
      if (meta && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        useWorkbench.setState({ chatOpen: !useWorkbench.getState().chatOpen })
      }
      if (meta && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        useWorkbench.setState({ chatOpen: true })
        requestAnimationFrame(() => document.getElementById('composer-input')?.focus())
      }
      if (e.key === 'Tab' && e.shiftKey && !meta) {
        e.preventDefault()
        useWorkbench.getState().cycleMode()
      }
      if (meta && e.key === '.') {
        e.preventDefault()
        useWorkbench.getState().cycleLayoutMode()
      }
      if (meta && e.key === '\\') {
        e.preventDefault()
        const st = useWorkbench.getState()
        const next = st.split === 'off' ? 'side' : st.split === 'side' ? 'below' : 'off'
        useWorkbench.setState({
          split: next,
          splitPath: next === 'off' ? undefined : st.splitPath || st.tabs.find((t) => t.path !== st.activePath)?.path || st.activePath
        })
        useWorkbench.getState().setActivity('files')
      }
      if (meta && !e.shiftKey && e.key === '1') {
        e.preventDefault()
        useWorkbench.getState().setActivity('files')
      }
      if (meta && !e.shiftKey && e.key === '2') {
        e.preventDefault()
        useWorkbench.getState().setActivity('search')
      }
      if (meta && !e.shiftKey && e.key === '3') {
        e.preventDefault()
        useWorkbench.getState().setActivity('git')
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        void window.homeai.llmStart().then(() => useWorkbench.getState().load())
      }
      if (e.key === 'Escape') {
        useWorkbench.setState({ palette: false, quickOpen: false, outlineOpen: false, inlineOpen: false, modeMenu: false })
        setMenu(null)
        setAbout(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [w])

  const wsName = (w.boot?.workspace ?? '').split('/').filter(Boolean).pop() ?? 'Hex AI'
  const pct = w.stats.tools ? Math.round((w.stats.reads / Math.max(1, w.stats.tools)) * 100) : 0
  const diagnosticErrors = w.diagnostics.filter((row) => row.severity === 'error').length
  const diagnosticWarnings = w.diagnostics.filter((row) => row.severity === 'warning').length
  const problems = diagnosticErrors + diagnosticWarnings + w.qa.length
  const tabCap = 8
  const overflowTabs = w.tabs.length > tabCap ? w.tabs.slice(0, w.tabs.length - tabCap) : []
  let shownTabs = w.tabs.slice(Math.max(0, w.tabs.length - tabCap))
  if (overflowTabs.some((t) => t.path === w.activePath)) {
    const hit = overflowTabs.find((t) => t.path === w.activePath)
    if (hit) shownTabs = [hit, ...shownTabs.filter((t) => t.path !== hit.path)].slice(0, tabCap)
  }

  const center = useMemo(() => {
    if (w.activity === 'browser') return <BrowserPane />
    switch (w.activity) {
      case 'notes':
        return <NotesPane />
      case 'board':
        return <TaskboardPane />
      case 'library':
        return <LibraryPane />
      case 'qa':
        return <QaPane />
      case 'maps':
        return <MapsPane />
      case 'mods':
        return <ModsPane />
      case 'settings':
        return <SettingsPane />
      case 'telegram':
        return <TelegramPane />
      case 'fleet':
        return <FleetPane />
      case 'design':
        return <DesignPane />
      default:
        return <EditorPane />
    }
  }, [w.activity, tick])

  const page = isPageActivity(w.activity) && !isStudioActivity(w.activity)
  const listSide = isListActivity(w.activity)
  const slots = takeSlots({
    cowork: w.cowork,
    activity: w.activity,
    tabCount: w.tabs.length,
    activePath: w.activePath,
    chatOpen: w.chatOpen,
    layoutMode: w.layoutMode
  })
  const editorCol = takeEditorColumn({
    cowork: w.cowork,
    activity: w.activity,
    tabCount: w.tabs.length,
    activePath: w.activePath,
    chatOpen: w.chatOpen
  })
  const sidePx = w.layoutMode === 'stage' && !listSide && !page ? 36 : w.sidebarW
  const chatPx = takeChatPx({ activity: w.activity, layoutMode: w.layoutMode, chatW: w.chatW })

  return (
    <div
      className="workbench"
      data-chat={w.chatOpen && w.layoutMode !== 'focus' ? 'on' : w.chatOpen ? 'ticker' : 'off'}
      data-sidebar="on"
      data-term={w.termOpen ? 'on' : 'off'}
      data-studio={isStudioActivity(w.activity) ? 'on' : 'off'}
      data-page={isPageActivity(w.activity) && !isStudioActivity(w.activity) ? 'on' : 'off'}
      data-list={isListActivity(w.activity) ? 'on' : 'off'}
      data-activity={w.activity}
      data-layout={w.layoutMode}
      data-density={w.density}
      data-editor={editorCol}
      data-sessions={slots.sessionsRail}
      style={
        {
          ['--sidebar' as string]: `${sidePx}px`,
          ['--chat' as string]: `${chatPx}px`,
          ['--term' as string]: `${w.termH}px`
        } as React.CSSProperties
      }
    >
      <header className="titlebar">
        <nav className="menubar">
          {Object.keys(menus).map((m) => (
            <div key={m} className="menu-wrap">
              <button
                type="button"
                className={menu === m ? 'on' : ''}
                onClick={() => setMenu(menu === m ? null : m)}
              >
                {m}
              </button>
              {menu === m && (
                <div className="menu-drop">
                  {menus[m].map((it) => (
                    <button
                      key={it.label}
                      type="button"
                      onClick={() => {
                        it.run()
                        setMenu(null)
                      }}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="title-search">
          <span className="title-brand">Hex AI</span>
          <input
            value={q}
            placeholder="Hex AI"
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => useWorkbench.setState({ quickOpen: true })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') useWorkbench.setState({ quickOpen: true })
            }}
          />
        </div>
        <div className="title-right">
          <div className="title-pulse">
            <button
              type="button"
              title="Mode"
              onClick={() => useWorkbench.setState({ chatOpen: true, modeMenu: true })}
            >
              {w.agentMode} · {w.provider === 'local' ? '2B' : w.provider}
            </button>
            <button
              type="button"
              className={w.kernelPulse?.llama === 'on' ? 'ok' : w.kernelPulse?.llama === 'missing' ? 'warn' : ''}
              title="Local 2B health"
              onClick={() => useWorkbench.setState({ llamaOpen: !useWorkbench.getState().llamaOpen })}
            >
              llama {w.kernelPulse?.llama || 'off'}
            </button>
            <button type="button" title="Keys" onClick={() => w.setActivity('settings')}>
              keys {w.kernelPulse?.keys || 'none'}
            </button>
            <button
              type="button"
              className={w.telegramOnline || w.kernelPulse?.telegram ? 'ok' : ''}
              title="Telegram session"
              onClick={() => w.setActivity('telegram')}
            >
              {w.busy ? (w.jobSource === 'telegram' ? 'TG live' : 'busy') : w.kernelPulse?.live ? `TG ${w.kernelPulse.live}` : 'idle'}
            </button>
          </div>
          {w.llamaOpen ? (
            <div className="llama-pop">
              <p className="hx-kicker">Hex AI</p>
              <div className="llama-pop-h">Local 2B</div>
              <div className="llama-pop-row">
                {w.kernelPulse?.gpu || w.boot?.probe.gpuName || 'gpu'} · {w.kernelPulse?.vramMb || w.boot?.probe.vramMb || 0}MB
              </div>
              <div className="llama-pop-row">
                ngl {w.kernelPulse?.ngl || w.boot?.probe.nGpuLayers || 0} · ctx {w.kernelPulse?.ctx || w.boot?.probe.contextSize || 0}
              </div>
              {w.kernelPulse?.llamaErr ? <div className="llama-pop-err">{w.kernelPulse.llamaErr}</div> : null}
              <div className="llama-pop-act">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => void window.homeai.llmStart().then(() => w.load())}
                >
                  Load
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => void window.homeai.llmStop().then(() => w.load())}
                >
                  Unload
                </button>
              </div>
            </div>
          ) : null}
          <div className="win-btns">
            <button type="button" onClick={() => void window.homeai.winMin()} aria-label="Minimize">
              <Square size={8} />
            </button>
            <button type="button" onClick={() => void window.homeai.winMax()} aria-label="Maximize">
              <Square size={10} />
            </button>
            <button type="button" className="win-close" onClick={() => void window.homeai.winClose()} aria-label="Close">
              ×
            </button>
          </div>
        </div>
      </header>

      {about ? (
        <div className="about-pop hx-card" role="dialog" aria-label="About Hex AI">
          <p className="hx-kicker">Hex AI</p>
          <h2>Hex AI Workbench</h2>
          <p>0.1.0 · local 2B default · cloud optional · no Landlock</p>
          <p>Folder {wsName} stays the workspace name. Chrome is Hex AI.</p>
          <p>Help → Open AGENTS.md for kernel law. Crash dumps stay off unless you opt in locally.</p>
          {diag ? <p className="hx-hint">{diag}</p> : null}
          <div className="hx-row">
            <button type="button" className="ghost" onClick={() => setAbout(false)}>
              Close
            </button>
            <button type="button" className="ghost" onClick={() => { setAbout(false); w.setActivity('settings') }}>
              Settings
            </button>
            <button
              type="button"
              className="ghost"
              onClick={async () => {
                const d = await window.homeai.diagnostics()
                const text = JSON.stringify(d)
                await navigator.clipboard.writeText(text)
                setDiag('Diagnostics copied (no secrets, no paths).')
              }}
            >
              Copy diagnostics
            </button>
            <button
              type="button"
              className="ghost"
              onClick={async () => {
                await window.homeai.crashSet('local')
                setDiag('Crash dumps save locally. Still no upload.')
              }}
            >
              Local crash dumps
            </button>
            <button
              type="button"
              className="ghost"
              onClick={async () => {
                const u = await window.homeai.updateCheck()
                setDiag(u.update ? `Update ${u.version}` : 'No update (GitHub Releases).')
              }}
            >
              Check updates
            </button>
          </div>
        </div>
      ) : null}

      {w.layoutMode === 'focus' && w.chatOpen ? <FocusTicker /> : null}

      <div className="body">
        <nav className="activity" aria-label="Activity bar">
          {items.map((it) => {
            const Icon = it.icon
            const badge =
              it.id === 'git' && w.gitDirty.size
                ? w.gitDirty.size
                : it.id === 'qa' && problems
                  ? problems
                  : 0
            return (
              <button
                key={it.id}
                type="button"
                className={w.activity === it.id ? 'active' : ''}
                title={it.label}
                aria-label={it.label}
                aria-pressed={w.activity === it.id}
                onClick={() => w.setActivity(it.id)}
              >
                <Icon size={22} />
                {badge ? <span className="act-badge">{badge > 99 ? '99' : badge}</span> : null}
              </button>
            )
          })}
          <div className="grow" />
          {moreItems.map((it) => {
            const Icon = it.icon
            return (
              <button
                key={it.id}
                type="button"
                className={w.activity === it.id ? 'active' : ''}
                title={it.label}
                aria-label={it.label}
                aria-pressed={w.activity === it.id}
                onClick={() => w.setActivity(it.id)}
              >
                <Icon size={20} />
                {it.id === 'telegram' && (w.kernelPulse?.live || w.telegramOnline) ? (
                  <span className="act-badge live" />
                ) : null}
              </button>
            )
          })}
        </nav>

        <aside className="sidebar">
          <ActivitySide activity={w.activity} />
        </aside>
        <div className="vsplit" onMouseDown={(e) => drag('side', e)} />

        <section className="center">
          {w.boot?.warning && <div className="warn-banner">{w.boot.warning}</div>}
          {w.bootError && <div className="warn-banner">{w.bootError}</div>}
          <div className="tabs">
            {isEditorActivity(w.activity) ? (
              <>
                {shownTabs.map((t) => (
                  <button
                    key={t.path}
                    type="button"
                    className={`tab ${t.path === w.activePath ? 'active' : ''}`}
                    onClick={() => {
                      useWorkbench.setState({ activePath: t.path })
                      w.setActivity('files')
                    }}
                    onAuxClick={(e) => {
                      if (e.button === 1) {
                        e.preventDefault()
                        w.closeTab(t.path)
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      useWorkbench.setState({
                        split: 'side',
                        splitPath: t.path
                      })
                      w.setActivity('files')
                    }}
                  >
                    {t.path.split('/').pop()}
                    {w.pending.some((p) => p.path === t.path) ? ' ●' : t.dirty ? ' ·' : ''}
                    <span
                      className="tab-x"
                      onClick={(e) => {
                        e.stopPropagation()
                        w.closeTab(t.path)
                      }}
                    >
                      ×
                    </span>
                  </button>
                ))}
                {overflowTabs.length ? (
                  <details className="tab-more">
                    <summary>{overflowTabs.length} more</summary>
                    <div className="tab-more-list">
                      {overflowTabs.map((t) => (
                        <button
                          key={t.path}
                          type="button"
                          onClick={() => {
                            useWorkbench.setState({ activePath: t.path })
                            w.setActivity('files')
                          }}
                        >
                          {t.path.split('/').pop()}
                        </button>
                      ))}
                    </div>
                  </details>
                ) : null}
                <button
                  type="button"
                  className={`tab ${w.activity === 'browser' ? 'active' : ''}`}
                  onClick={() => w.setActivity('browser')}
                >
                  Browser
                </button>
              </>
            ) : (
              <div className="tab active pane-tab">{activityLabel(w.activity)}</div>
            )}
          </div>
          <div className="center-main">
            <div className={`center-stage ${w.split !== 'off' && w.activity === 'files' ? `split-${w.split}` : ''}`}>
              <PaneErrorBoundary key={w.activity} label={activityLabel(w.activity)}>
                {center}
              </PaneErrorBoundary>
              {w.split !== 'off' && w.splitPath && w.activity === 'files' ? (
                <EditorPane bindPath={w.splitPath} chrome={false} />
              ) : null}
            </div>
            <div className="hsplit" onMouseDown={(e) => drag('term', e)} />
            <div className="term">
              <TerminalPane />
            </div>
          </div>
        </section>

        {w.chatOpen && w.layoutMode !== 'focus' && !isStudioActivity(w.activity) ? (
          <div className="vsplit" onMouseDown={(e) => drag('chat', e)} />
        ) : (
          <div className="chat-gap" />
        )}
        <aside className="chatdock">{w.layoutMode === 'focus' ? null : <ChatPane />}</aside>
      </div>

      <footer className="status">
        <span
          className="git-item stat-click"
          role="button"
          tabIndex={0}
          onClick={() => w.setActivity('git')}
          onKeyDown={(e) => activateByKey(e, () => w.setActivity('git'))}
        >
          {w.boot?.gitBranch ? `⎇ ${w.boot.gitBranch}${w.gitDirty.size ? '*' : ''}` : '⎇ main'}
        </span>
        <span className="stat-click" role="button" tabIndex={0} onClick={() => w.setActivity('files')} onKeyDown={(e) => activateByKey(e, () => w.setActivity('files'))}>
          {wsName}
        </span>
        <span
          className="stat-click"
          role="button"
          tabIndex={0}
          onClick={() => w.setActivity('qa', { termOpen: true, termPanel: 'problems' })}
          onKeyDown={(e) => activateByKey(e, () => w.setActivity('qa', { termOpen: true, termPanel: 'problems' }))}
        >
          {diagnosticErrors || diagnosticWarnings || w.qa.length
            ? `${diagnosticErrors} errors · ${diagnosticWarnings} warnings${w.qa.length ? ` · ${w.qa.length} checks` : ''}`
            : 'No problems'}
        </span>
        <span className="spacer" />
        <span className="stat-right">
          Ln {w.cursorPos.line}, Col {w.cursorPos.col} · {w.cursorPos.lang}
        </span>
        <span
          className="stat-right stat-click"
          role="button"
          tabIndex={0}
          onClick={() => useWorkbench.setState({ chatOpen: true, layoutMode: w.layoutMode === 'focus' ? 'stage' : w.layoutMode })}
          onKeyDown={(e) => activateByKey(e, () => useWorkbench.setState({ chatOpen: true, layoutMode: w.layoutMode === 'focus' ? 'stage' : w.layoutMode }))}
        >
          {w.stats.tools ? `Agent ${w.stats.reads}/${w.stats.tools} (${pct}%)` : 'Agent idle'}
        </span>
        <span className="stat-right stat-click" role="button" tabIndex={0} onClick={() => w.setActivity('mods')} onKeyDown={(e) => activateByKey(e, () => w.setActivity('mods'))}>
          MCP {w.kernelPulse?.mcp ?? 0}
        </span>
      </footer>

      {w.palette && <CommandPalette onTick={() => setTick((n) => n + 1)} />}
      {w.quickOpen && <QuickOpen />}
      {w.outlineOpen && <GotoSymbol />}
    </div>
  )
}

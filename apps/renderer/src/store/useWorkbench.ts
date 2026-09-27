import { create } from 'zustand'
import type {
  AgentMode,
  ConversationThread,
  HomeProfile,
  ApprovalPrompt,
  AskUserPrompt,
  CheckpointMeta,
  ContextRing,
  FileChange,
  FileEntry,
  GitFileStatus,
  ForgeStep,
  HardwareProbe,
  LlmStatus,
  MapEdge,
  MapNode,
  ModManifest,
  NoteDoc,
  ProviderId,
  ProviderStatus,
  QaRecord,
  RuleCard,
  SkillCard,
  StreamChunk,
  TaskBoard,
  VisualTier
} from '@homeai/core'
import { AGENT_MODES } from '@homeai/core'
import { sessionTitle, toolCallName, takeWorkflow, emptyWorkflow, workflowToSubagents, takeWorkflowModel, desktopOwnsAgentChunk, centerViewForActivity, thinkRelFromOpen } from '@homeai/runtime/browser'
import type { WorkflowDto } from '@homeai/runtime/browser'
import type { TsDiagnostic, TsSymbol, TsTextEdit } from '@homeai/ts-intel'
import type { DebugSnapshot } from '@homeai/debug'

export const PROVIDERS: ProviderId[] = ['local', 'openrouter', 'openai', 'cursor']

export type ThreadSource = 'desktop' | 'telegram' | 'both'
export type EditorSplit = 'off' | 'side' | 'below'
export type BottomTab = 'problems' | 'output' | 'debug' | 'runtime' | 'terminal' | 'ports' | 'shells'
export type LayoutMode = 'dock' | 'stage' | 'focus'
export type ConversationDensity = 'compact' | 'comfortable' | 'spacious'

export interface ChromePulse {
  llama: 'on' | 'off' | 'missing'
  keys: string
  cursor: string
  mode: string
  mind: string
  telegram: boolean
  glass: boolean
  mcp: number
  pending: number
  live: number
  busy: boolean
  gpu?: string
  vramMb?: number
  ngl?: number
  ctx?: number
  llamaErr?: string
}

export function workspaceRel(root: string, abs: string): string | null {
  const w = root.replace(/\\/g, '/').replace(/\/$/, '')
  const a = abs.replace(/\\/g, '/')
  if (!w || !a.startsWith(`${w}/`)) return null
  const rel = a.slice(w.length + 1)
  if (!rel || rel.includes('..')) return null
  return rel
}

export type Activity =
  | 'files'
  | 'search'
  | 'git'
  | 'notes'
  | 'board'
  | 'library'
  | 'qa'
  | 'browser'
  | 'maps'
  | 'mods'
  | 'settings'
  | 'telegram'
  | 'design'
  | 'fleet'

export type LogItem =
  | { id: string; kind: 'user' | 'assistant' | 'status' | 'error' | 'edit' | 'thought' | 'tool' | 'wait'; text: string; tool?: string }
  | { id: string; kind: 'shell'; text: string; caption?: string; tool?: string }
  | { id: string; kind: 'step'; step: ForgeStep }
  | { id: string; kind: 'diff'; text: string; path: string; before: string; after: string }
  | { id: string; kind: 'checkpoint'; text: string; cpId: string; files: string[] }

export interface SubAgentRow {
  id: string
  name: string
  started: number
  ended?: number
  tokens: string
  status: 'running' | 'done' | 'error'
  hint: string
  lane?: 'hunt' | 'verify' | 'critic'
  model?: string
}

export const LAYOUT_CYCLE: LayoutMode[] = ['dock', 'stage', 'focus']

export interface AgentStats {
  reads: number
  writes: number
  tools: number
}

export interface BootInfo {
  root: string
  workspace: string
  model: string | null
  probe: HardwareProbe
  llm: LlmStatus
  providers: ProviderStatus[]
  mods: ModManifest[]
  ragStats: { documents: number; lastIngest?: number }
  gitBranch?: string
  warning?: string
  goal?: string
  profile?: HomeProfile
  threads?: Array<{ id: string; title: string; updatedAt: number; source?: ThreadSource }>
  activeThreadId?: string
  telegram?: { configured: boolean; online: boolean; peers: number[]; pairing: { exp: number } | null }
  packaged?: boolean
  onboard?: boolean
  modelMissing?: boolean
}

interface Tab {
  path: string
  content: string
  dirty: boolean
}

interface State {
  boot?: BootInfo
  activity: Activity
  chatOpen: boolean
  termOpen: boolean
  palette: boolean
  quickOpen: boolean
  outlineOpen: boolean
  outlineJump?: { path: string; line: number }
  treeFocus?: string
  inlineOpen: boolean
  agentMode: AgentMode
  runId?: string
  pending: FileChange[]
  selection?: { path: string; text: string }
  sidebarW: number
  chatW: number
  layoutMode: LayoutMode
  cowork: boolean
  density: ConversationDensity
  llamaOpen: boolean
  thinkHint: string
  pinnedChats: string[]
  denyCount: number
  allowCount: number
  termH: number
  tabs: Tab[]
  activePath?: string
  tree: FileEntry[]
  treePath: string
  log: LogItem[]
  busy: boolean
  provider: ProviderId
  notes: NoteDoc[]
  board?: TaskBoard
  libraryStatus: string
  libraryDocs: Record<string, string>
  qa: QaRecord[]
  map: { nodes: MapNode[]; edges: MapEdge[] }
  skills: SkillCard[]
  rules: RuleCard[]
  mods: ModManifest[]
  lastTrace: string
  searchHits: Array<{ path: string; snippet: string }>
  bootError?: string
  notePath?: string
  noteBody: string
  queue: string[]
  ring?: ContextRing
  question?: AskUserPrompt
  approval?: ApprovalPrompt
  checkpoints: CheckpointMeta[]
  goal: string
  customSkill: string
  gitDirty: Set<string>
  gitFiles: GitFileStatus[]
  diagnostics: TsDiagnostic[]
  documentSymbols: Record<string, TsSymbol[]>
  renamePreview: TsTextEdit[]
  debugSession: DebugSnapshot
  debugBreakpoints: Array<{ path: string; line: number }>
  watchExpr: string
  evalExpr: string
  reviewOpen: boolean
  reviewText: string
  ptyCount: number
  ptySpawn: number
  subagents: SubAgentRow[]
  workflow: WorkflowDto
  stats: AgentStats
  centerView: 'editor' | 'browser'
  chats: Array<{ id: string; title: string; log: LogItem[]; source?: ThreadSource; archived?: boolean }>
  activeChat: string
  modeMenu: boolean
  termPanel: BottomTab
  waitingShell: boolean
  waitingUntil: number
  thoughtAt: number
  jobSource?: 'telegram' | 'desktop'
  focusTool?: string
  telegramOnline: boolean
  cursorPos: { line: number; col: number; lang: string }
  split: EditorSplit
  splitPath?: string
  kernelPulse?: ChromePulse
  ports: Array<{ name: string; port: number }>
  layoutReady: boolean
  setActivity: (a: Activity, extra?: Record<string, unknown>) => void
  selectChat: (id: string) => void
  newChat: () => void
  renameChat: (id: string, title: string) => void
  archiveChat: (id: string) => void
  openAgent: (title: string) => void
  closeChat: (id: string) => void
  closeTab: (path: string) => void
  keepFile: (path: string) => Promise<void>
  undoFile: (path: string) => Promise<void>
  refreshGit: () => Promise<void>
  load: () => Promise<void>
  openFile: (path: string, opts?: { keepActivity?: boolean }) => Promise<void>
  setContent: (path: string, content: string) => void
  save: () => Promise<void>
  run: (task: string, opts?: { thinkPath?: string; provider?: ProviderId; needsTools?: boolean }) => void
  implementThink: (path?: string) => Promise<void>
  enqueue: (task: string) => void
  steer: (task: string) => void
  cycleMode: () => void
  cycleProvider: () => void
  cycleLayoutMode: () => void
  cycleDensity: () => void
  pinSkill: (name: string) => Promise<void>
  clearSkill: () => Promise<void>
  stop: () => void
  revealTool: (name: string) => void
  refreshPending: () => Promise<void>
  refreshGrounds: () => Promise<void>
}

function prettyTool(raw: string, name: string, ok: boolean): string {
  const file = raw.match(/[\w./-]+\.\w{1,8}/)?.[0]?.split('/').pop()
  const labels: Record<string, string> = {
    fs_read: file ? `Read ${file}` : 'Read',
    grep: file ? `Grepped ${file}` : 'Grepped',
    glob: 'Glob',
    explore: 'Explored',
    rag_search: 'Searched RAG',
    library_pack: 'Library pack',
    git_pack: 'Git pack',
    plan_write: 'Wrote think doc',
    browser_extract: 'Captured page',
    fs_write: file ? `Wrote ${file}` : 'Wrote',
    fs_edit: file ? `Edited ${file}` : 'Edited',
    str_replace: file ? `Edited ${file}` : 'Edited',
    test_run: 'Ran tests',
    terminal_run: 'Ran command'
  }
  return `${ok ? '' : 'failed '}${labels[name] ?? name}`
}

function nid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function foldWorkflow(chunk: StreamChunk, extra: { runId?: string; task?: string } = {}) {
  const s = useWorkbench.getState()
  const wf = takeWorkflow(s.workflow, chunk, {
    runId: extra.runId || s.runId,
    task: extra.task || s.goal,
    goal: s.goal,
    model: takeWorkflowModel(s.provider),
    now: Date.now()
  })
  useWorkbench.setState({ workflow: wf, subagents: workflowToSubagents(wf) })
}

function appendForgeStep(step: ForgeStep) {
  const now = Date.now()
  const prev = useWorkbench.getState().thoughtAt
  const sec = prev ? Math.max(1, Math.round((now - prev) / 1000)) : 1
  const label =
    step === 'verify' || step === 'remember'
      ? `Thought ${sec}s`
      : sec <= 1
        ? 'Thought briefly'
        : `Thought ${sec}s`
  useWorkbench.setState({
    log: [
      ...useWorkbench.getState().log,
      { id: nid(), kind: 'thought', text: label },
      { id: nid(), kind: 'step', step }
    ],
    thoughtAt: now
  })
}

function appendToolRun(name: string) {
  const n = toolCallName(name)
  if (!n) return
  useWorkbench.setState({
    log: [...useWorkbench.getState().log, { id: nid(), kind: 'tool', text: `run ${n}`, tool: n }]
  })
}

function applyForeignChunk(rid: string, chunk: StreamChunk) {
  const state = useWorkbench.getState()
  if (desktopOwnsAgentChunk(state.runId, rid, state.jobSource)) return
  if (chunk.type === 'status' && chunk.text === 'surface=telegram') {
    useWorkbench.setState({
      busy: true,
      runId: rid,
      jobSource: 'telegram',
      chatOpen: true,
      thoughtAt: Date.now(),
      workflow: emptyWorkflow(),
      subagents: []
    })
  }
  foldWorkflow(chunk, { runId: rid })
  if (chunk.type === 'step' && chunk.step) appendForgeStep(chunk.step)
  if (chunk.type === 'tool_call' && chunk.toolCall) appendToolRun(chunk.toolCall.name)
  if (chunk.type === 'text' && chunk.text) {
    const log = [...useWorkbench.getState().log]
    const last = log[log.length - 1]
    if (last && last.kind === 'assistant') log[log.length - 1] = { ...last, text: last.text + chunk.text }
    else log.push({ id: nid(), kind: 'assistant', text: chunk.text })
    useWorkbench.setState({ log })
  }
  if (chunk.type === 'status' && chunk.text && chunk.text !== 'surface=telegram') {
    useWorkbench.setState({ log: [...useWorkbench.getState().log, { id: nid(), kind: 'status', text: chunk.text }] })
  }
  if (chunk.type === 'approval' && chunk.approval) useWorkbench.setState({ approval: chunk.approval })
  if (chunk.type === 'question' && chunk.question) useWorkbench.setState({ question: chunk.question })
  if (chunk.type === 'done' || chunk.type === 'error') {
    if (chunk.type === 'error') {
      useWorkbench.setState({
        log: [...useWorkbench.getState().log, { id: nid(), kind: 'error', text: chunk.error ?? 'error' }]
      })
    }
    useWorkbench.setState({ busy: false, runId: undefined, jobSource: undefined, approval: undefined, question: undefined })
  }
}

let foreignBound = false
function bindForeignChunks() {
  if (foreignBound || typeof window === 'undefined' || !window.homeai) return
  foreignBound = true
  window.homeai.onAgentChunk((rid, raw) => applyForeignChunk(rid, raw as StreamChunk))
  if (window.homeai.onDebugEvent) {
    window.homeai.onDebugEvent((snap) => useWorkbench.setState({ debugSession: snap }))
  }
}

export const useWorkbench = create<State>((set, get) => ({
  activity: 'files',
  chatOpen: true,
  termOpen: true,
  palette: false,
  quickOpen: false,
  outlineOpen: false,
  inlineOpen: false,
  agentMode: 'agent',
  pending: [],
  sidebarW: 248,
  chatW: 520,
  layoutMode: 'dock',
  cowork: true,
  density: 'comfortable',
  llamaOpen: false,
  thinkHint: '',
  pinnedChats: [],
  denyCount: 0,
  allowCount: 0,
  termH: 168,
  tabs: [],
  tree: [],
  treePath: '',
  log: [],
  busy: false,
  provider: 'local',
  notes: [],
  board: undefined,
  libraryStatus: '',
  libraryDocs: {},
  qa: [],
  map: { nodes: [], edges: [] },
  skills: [],
  rules: [],
  mods: [],
  lastTrace: '',
  searchHits: [],
  noteBody: '',
  queue: [],
  checkpoints: [],
  goal: '',
  customSkill: '',
  gitDirty: new Set(),
  gitFiles: [],
  diagnostics: [],
  documentSymbols: {},
  renamePreview: [],
  debugSession: { status: 'idle', path: null, port: null, frames: [], locals: [], watches: [], console: [], testFailure: null },
  debugBreakpoints: [],
  watchExpr: '',
  evalExpr: '',
  reviewOpen: false,
  reviewText: '',
  ptyCount: 0,
  ptySpawn: 0,
  subagents: [],
  workflow: emptyWorkflow(),
  stats: { reads: 0, writes: 0, tools: 0 },
  centerView: 'editor',
  chats: [{ id: 'chat-1', title: 'New agent', log: [] }],
  activeChat: 'chat-1',
  modeMenu: false,
  termPanel: 'terminal',
  waitingShell: false,
  waitingUntil: 0,
  thoughtAt: 0,
  jobSource: undefined,
  telegramOnline: false,
  cursorPos: { line: 1, col: 1, lang: 'text' },
  split: 'off',
  kernelPulse: undefined,
  ports: [],
  layoutReady: false,

  setActivity: (activity, extra) => {
    const centerView = centerViewForActivity(activity)
    const patch: Record<string, unknown> = {}
    if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
      const allow = ['termOpen', 'termPanel', 'inlineOpen', 'chatOpen', 'reviewOpen'] as const
      for (const k of allow) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) patch[k] = extra[k]
      }
    }
    set({ ...patch, activity, centerView } as Partial<State>)
    if (activity === 'browser') return
    try {
      void window.homeai?.browserHide?.()
    } catch {
      /* no BrowserView */
    }
  },

  selectChat: (id) => {
    const cur = get().activeChat
    if (cur === id) return
    const chats = get().chats.map((c) => (c.id === cur ? { ...c, log: get().log } : c))
    const next = chats.find((c) => c.id === id)
    set({ chats, activeChat: id, log: next?.log ?? [] })
    void window.homeai.threadSelect(id)
    if (!next?.log?.length) {
      void window.homeai.threadGet(id).then((raw) => {
        const th = raw as ConversationThread | null
        if (!th) return
        const log = th.turns.map((t, i) => ({
          id: `${th.id}_${i}`,
          kind: (t.role === 'user' ? 'user' : t.role === 'assistant' ? 'assistant' : 'status') as LogItem['kind'],
          text: t.text
        })) as LogItem[]
        const chats2 = get().chats.map((c) =>
          c.id === id ? { ...c, title: th.title, log, source: th.source || c.source } : c
        )
        if (get().activeChat === id) set({ chats: chats2, log })
        else set({ chats: chats2 })
      })
    }
  },

  newChat: () => {
    void window.homeai.threadCreate('New agent').then((raw) => {
      const th = raw as ConversationThread
      const chats = get().chats.map((c) => (c.id === get().activeChat ? { ...c, log: get().log } : c))
      set({
        chats: [...chats, { id: th.id, title: th.title || 'New agent', log: [], source: 'desktop' }],
        activeChat: th.id,
        log: [],
        busy: false,
        runId: undefined,
        waitingShell: false,
        waitingUntil: 0
      })
    })
  },

  renameChat: (id, title) => {
    const t = sessionTitle(title)
    set({
      chats: get().chats.map((c) => (c.id === id ? { ...c, title: t } : c))
    })
    void window.homeai.threadRename(id, t)
  },

  archiveChat: (id) => {
    const chats = get().chats.map((c) => (c.id === id ? { ...c, archived: true } : c))
    const live = chats.filter((c) => !c.archived)
    if (!live.length) {
      set({ chats })
      get().newChat()
      return
    }
    const activeChat = get().activeChat === id ? live[live.length - 1].id : get().activeChat
    const log = chats.find((c) => c.id === activeChat)?.log ?? get().log
    set({ chats, activeChat, log })
  },

  openAgent: (title) => {
    const hit = get().chats.find((c) => c.title === title)
    if (hit) {
      get().selectChat(hit.id)
      return
    }
    get().newChat()
    set({
      chats: get().chats.map((c) => (c.id === get().activeChat ? { ...c, title } : c))
    })
  },

  closeTab: (path) => {
    const tabs = get().tabs.filter((t) => t.path !== path)
    const activePath = get().activePath === path ? tabs[tabs.length - 1]?.path : get().activePath
    const splitPath = get().splitPath === path ? undefined : get().splitPath
    void window.homeai.tsClose(path)
    const documentSymbols = { ...get().documentSymbols }
    delete documentSymbols[path]
    set({
      tabs,
      activePath,
      splitPath,
      diagnostics: get().diagnostics.filter((row) => row.path !== path),
      documentSymbols,
      split: splitPath ? get().split : 'off',
      centerView: 'editor',
      activity: 'files'
    })
  },

  closeChat: (id) => {
    const chats = get().chats.map((c) => (c.id === get().activeChat ? { ...c, log: get().log } : c))
    const next = chats.filter((c) => c.id !== id)
    if (!next.length) {
      const nidChat = `chat-${nid()}`
      set({ chats: [{ id: nidChat, title: 'New agent', log: [] }], activeChat: nidChat, log: [], busy: false })
      return
    }
    const activeChat = get().activeChat === id ? next[next.length - 1].id : get().activeChat
    const log = next.find((c) => c.id === activeChat)?.log ?? []
    set({ chats: next, activeChat, log })
  },

  keepFile: async (path) => {
    await window.homeai.acceptChange(path)
    await get().refreshPending()
    await get().refreshGit()
    await get().refreshGrounds()
  },

  undoFile: async (path) => {
    await window.homeai.rejectChange(path)
    await get().refreshPending()
    try {
      const content = await window.homeai.read(path)
      set({
        tabs: get().tabs.map((t) => (t.path === path ? { ...t, content, dirty: false } : t))
      })
    } catch {
      /* gone */
    }
    await get().refreshGit()
  },

  refreshGit: async () => {
    try {
      const snap = (await window.homeai.gitStatus()) as { files?: GitFileStatus[]; branch?: string }
      const files = snap.files ?? []
      const boot = get().boot
      set({
        gitFiles: files,
        gitDirty: new Set(files.map((f) => f.path.replace(/\\/g, '/'))),
        boot: boot ? { ...boot, gitBranch: snap.branch ?? boot.gitBranch } : boot
      })
    } catch {
      /* no git */
    }
  },

  load: async () => {
    try {
      bindForeignChunks()
      const boot = (await window.homeai.boot()) as unknown as BootInfo
      const tree = (await window.homeai.list(boot.workspace)) as FileEntry[]
      const knowledge = (await window.homeai.mods()) as { mods: ModManifest[]; skills: SkillCard[]; rules: RuleCard[] }
      set({
        boot,
        tree,
        treePath: boot.workspace,
        mods: knowledge.mods,
        skills: knowledge.skills,
        rules: knowledge.rules ?? [],
        provider: (boot.profile?.defaultProvider as ProviderId) || 'local',
        goal: boot.goal ?? boot.profile?.standingGoal ?? '',
        customSkill: boot.profile?.pinnedSkill ?? '',
        agentMode: boot.profile?.defaultMode ?? 'agent',
        telegramOnline: Boolean(boot.telegram?.online || boot.telegram?.configured)
      })
      if (boot.threads?.length) {
        const active = boot.activeThreadId || boot.threads[0].id
        const chats = boot.threads.map((t) => ({
          id: t.id,
          title: t.title,
          log: [] as LogItem[],
          source: t.source
        }))
        let log: LogItem[] = []
        try {
          const th = (await window.homeai.threadGet(active)) as ConversationThread | null
          if (th) {
            log = th.turns.map((t, i) => ({
              id: `${th.id}_${i}`,
              kind: (t.role === 'user' ? 'user' : t.role === 'assistant' ? 'assistant' : 'status') as 'user' | 'assistant' | 'status',
              text: t.text
            }))
            const hit = chats.find((c) => c.id === active)
            if (hit) hit.log = log
          }
        } catch {
          /* first run */
        }
        set({ chats, activeChat: active, log })
      }
      document.documentElement.dataset.tier = boot.probe.visualTier
      document.getElementById('root')?.setAttribute('data-tier', boot.probe.visualTier)
      await get().refreshGrounds()
      await get().refreshGit()
      let restored = false
      let wantActivity: Activity | undefined
      try {
        const layout = (await window.homeai.layoutGet()) as {
          activity?: Activity
          chatOpen?: boolean
          termOpen?: boolean
          sidebarW?: number
          chatW?: number
          termH?: number
          termPanel?: BottomTab
          split?: EditorSplit
          layoutMode?: LayoutMode
          density?: ConversationDensity
          pinnedChats?: string[]
          cowork?: boolean
          tabs?: string[]
          active?: string | null
          splitPath?: string | null
        }
        wantActivity = layout.activity
        const mode: LayoutMode =
          layout.layoutMode === 'stage' || layout.layoutMode === 'focus' || layout.layoutMode === 'dock'
            ? layout.layoutMode
            : 'dock'
        const dens: ConversationDensity =
          layout.density === 'compact' || layout.density === 'spacious' || layout.density === 'comfortable'
            ? layout.density
            : 'comfortable'
        set({
          chatOpen: layout.chatOpen !== false,
          termOpen: layout.termOpen !== false,
          sidebarW: layout.sidebarW ?? get().sidebarW,
          chatW: layout.chatW ?? get().chatW,
          termH: layout.termH ?? get().termH,
          termPanel: layout.termPanel === 'shells' ? 'shells' : layout.termPanel ?? 'terminal',
          split: layout.split === 'side' || layout.split === 'below' ? layout.split : 'off',
          layoutMode: mode,
          density: dens,
          cowork: layout.cowork !== false,
            pinnedChats: Array.isArray(layout.pinnedChats)
              ? layout.pinnedChats.filter((id) => typeof id === 'string' && /^(chat[_-][\w.-]{1,64})$/.test(id) && !id.includes('..')).slice(0, 24)
            : []
        })
        const ws = boot.workspace
        for (const rel of layout.tabs ?? []) {
          try {
            await get().openFile(`${ws}/${rel}`, { keepActivity: true })
            restored = true
          } catch {
            /* gone */
          }
        }
        if (layout.active) {
          const abs = `${ws}/${layout.active}`
          if (get().tabs.some((t) => t.path === abs)) {
            set({ activePath: abs })
          }
        }
        if (layout.splitPath) {
          const abs = `${ws}/${layout.splitPath}`
          try {
            if (!get().tabs.some((t) => t.path === abs)) await get().openFile(abs, { keepActivity: true })
            if (get().tabs.some((t) => t.path === abs)) set({ splitPath: abs })
          } catch {
            set({ split: 'off', splitPath: undefined })
          }
        }
      } catch {
        /* first run */
      }
      if (!restored) {
        const welcomePlan = `${boot.workspace}/RAG/plans`
        let opened = false
        try {
          const plans = (await window.homeai.list(welcomePlan)) as FileEntry[]
          const md =
            plans.find((p) => !p.dir && p.name.endsWith('.plan.md')) ??
            plans.find((p) => !p.dir && p.name.endsWith('.md'))
          if (md) {
            await get().openFile(md.path, { keepActivity: true })
            opened = true
            const body = get().tabs.find((t) => t.path === md.path)?.content ?? ''
            const ref = /Referenced by[\s\S]*?[-*]\s+(.+)/i.exec(body)?.[1]?.trim()
            const title = ref || md.name.replace(/\.plan\.md$/, '').replace(/_/g, ' ')
            set({
              chats: get().chats.map((c) => (c.id === get().activeChat ? { ...c, title } : c))
            })
          }
        } catch {
          /* no plans */
        }
        if (!opened) {
          try {
            await get().openFile(`${boot.workspace}/AGENTS.md`, { keepActivity: true })
          } catch {
            /* optional */
          }
        }
      }
      if (wantActivity && wantActivity !== 'files') get().setActivity(wantActivity)
      else if (!wantActivity || wantActivity === 'files') get().setActivity('files')
      set({ layoutReady: true })
      try {
        const [pulse, ports] = await Promise.all([window.homeai.kernelPulse(), window.homeai.workbenchPorts()])
        set({ kernelPulse: pulse as ChromePulse, ports })
      } catch {
        /* offline */
      }
    } catch (err) {
      set({ bootError: err instanceof Error ? err.message : String(err) })
    }
  },

  openFile: async (path, opts) => {
    const keep = opts?.keepActivity === true
    const existing = get().tabs.find((t) => t.path === path)
    if (existing) {
      set({ activePath: path })
      if (!keep) {
        get().setActivity('files')
        set({ cowork: false, chatOpen: true })
      }
      return
    }
    const content = await window.homeai.read(path)
    set({
      tabs: [...get().tabs, { path, content, dirty: false }],
      activePath: path
    })
    if (!keep) {
      get().setActivity('files')
      set({ cowork: false, chatOpen: true })
    }
  },

  setContent: (path, content) => {
    set({
      tabs: get().tabs.map((t) => (t.path === path ? { ...t, content, dirty: true } : t))
    })
  },

  save: async () => {
    const { activePath, tabs } = get()
    const tab = tabs.find((t) => t.path === activePath)
    if (!tab) return
    await window.homeai.write(tab.path, tab.content)
    set({
      tabs: get().tabs.map((t) => (t.path === tab.path ? { ...t, dirty: false } : t))
    })
    await get().refreshGit()
  },

  run: (task, opts) => {
    const id = nid()
    const openFiles = get().tabs.map((t) => t.path)
    const title = task.split('\n')[0].slice(0, 28) || 'Agent'
    const userItem: LogItem = { id: nid(), kind: 'user', text: task }
    const nextLog = [...get().log, userItem]
    const chats = get().chats.map((c) => (c.id === get().activeChat ? { ...c, title, log: nextLog } : c))
    const seeded = takeWorkflow(null, { type: 'status', text: 'start' }, {
      runId: id,
      task,
      goal: get().goal,
      model: takeWorkflowModel(get().provider),
      now: Date.now()
    })
    set({
      busy: true,
      chatOpen: true,
      runId: id,
      chats,
      log: nextLog,
      lastTrace: '',
      question: undefined,
      approval: undefined,
      subagents: [],
      workflow: seeded,
      waitingShell: false,
      waitingUntil: 0,
      thoughtAt: Date.now(),
      jobSource: 'desktop'
    })
    const unsub = window.homeai.onAgentChunk((rid, raw) => {
      const chunk = raw as StreamChunk
      if (rid !== id) return
      if (get().runId !== id) {
        if (chunk.type === 'done' || chunk.type === 'error') unsub()
        return
      }
      if (get().workflow.status === 'stopped') {
        if (chunk.type === 'done' || chunk.type === 'error') {
          foldWorkflow(chunk, { runId: id, task })
          set({ runId: undefined, jobSource: undefined, approval: undefined, question: undefined })
          unsub()
        }
        return
      }
      foldWorkflow(chunk, { runId: id, task })
      if (chunk.type === 'status' && chunk.text) {
        if (chunk.text === 'surface=telegram') {
          set({ jobSource: 'telegram' })
        } else if (/DesignIR needs tools|key missing — using/i.test(chunk.text)) {
          const note = String(chunk.text).replace(/[<>]/g, '').slice(0, 160)
          set({ log: [...get().log, { id: nid(), kind: 'status', text: note }] })
        }
      }
      if (chunk.type === 'text' && chunk.text) {
        const log = [...get().log]
        const last = log[log.length - 1]
        if (last && last.kind === 'assistant') {
          log[log.length - 1] = { ...last, text: last.text + chunk.text }
        } else {
          log.push({ id: nid(), kind: 'assistant', text: chunk.text })
        }
        set({ log, lastTrace: get().lastTrace + chunk.text })
      } else if (chunk.type === 'edit' && chunk.edit) {
        const st = get().stats
        set({
          log: [
            ...get().log,
            {
              id: nid(),
              kind: 'diff',
              text: chunk.edit.path.split('/').pop() ?? chunk.edit.path,
              path: chunk.edit.path,
              before: chunk.edit.before,
              after: chunk.edit.after
            }
          ],
          pending: [...get().pending.filter((p) => p.path !== chunk.edit!.path), chunk.edit],
          stats: { ...st, writes: st.writes + 1 }
        })
        void get().openFile(chunk.edit.path)
        void window.homeai.read(chunk.edit.path).then((content) => {
          set({
            tabs: get().tabs.map((t) => (t.path === chunk.edit!.path ? { ...t, content, dirty: false } : t))
          })
        })
        void get().refreshGit()
      } else if (chunk.type === 'context' && chunk.context) {
        set({ ring: chunk.context })
      } else if (chunk.type === 'question' && chunk.question) {
        set({ question: chunk.question })
      } else if (chunk.type === 'approval' && chunk.approval) {
        set({ approval: chunk.approval })
      } else if (chunk.type === 'checkpoint' && chunk.checkpoint) {
        set({
          checkpoints: [...get().checkpoints, chunk.checkpoint],
          log: [
            ...get().log,
            {
              id: nid(),
              kind: 'checkpoint',
              text: chunk.checkpoint.label,
              cpId: chunk.checkpoint.id,
              files: chunk.checkpoint.files
            }
          ]
        })
      } else if (chunk.type === 'tool_call' && chunk.toolCall) {
        appendToolRun(chunk.toolCall.name)
      } else if (chunk.type === 'status' && chunk.text) {
        const st = get().stats
        const wait = /^Waiting/i.test(chunk.text)
        const m = chunk.text.match(/^(ok|err)\s+(\S+)(?: ([^\n]+))?([\s\S]*)/)
        let kind: 'wait' | 'status' | 'shell' | 'tool' = wait ? 'wait' : 'status'
        let text = chunk.text
        if (wait) {
          set({
            log: [...get().log, { id: nid(), kind: 'wait', text: chunk.text }],
            waitingShell: true,
            waitingUntil: Date.now() + 208_000,
            lastTrace: get().lastTrace + `\n[${chunk.text}]`
          })
        } else if (m) {
          const name = toolCallName(m[2]) || 'tool'
          const cmdLine = (m[3] || '').trim()
          const body = (m[4] || '').trim()
          const isShell = name === 'test_run' || name === 'terminal_run'
          const caption = cmdLine || prettyTool(chunk.text, name, m[1] === 'ok')
          kind = isShell && body ? 'shell' : 'tool'
          text = isShell && body ? body : caption
          const reads = /explore|grep|fs_read|glob|rag_search|browser_extract/.test(name) ? st.reads + 1 : st.reads
          const entry: LogItem =
            kind === 'shell' ? { id: nid(), kind: 'shell', text, caption, tool: name } : { id: nid(), kind, text, tool: name }
          set({
            log: [...get().log, entry],
            lastTrace: get().lastTrace + `\n[${chunk.text.slice(0, 200)}]`,
            waitingShell: false,
            waitingUntil: 0,
            stats: { reads, writes: st.writes, tools: st.tools + 1 }
          })
        } else {
          const reads = /explore|grep|fs_read|glob|rag_search/.test(chunk.text) ? st.reads + 1 : st.reads
          set({
            log: [...get().log, { id: nid(), kind, text }],
            lastTrace: get().lastTrace + `\n[${chunk.text}]`,
            stats: { reads, writes: st.writes, tools: st.tools + 1 }
          })
        }
      } else if (chunk.type === 'step' && chunk.step) {
        appendForgeStep(chunk.step)
      } else if (chunk.type === 'error') {
        set({
          log: [...get().log, { id: nid(), kind: 'error', text: chunk.error ?? 'error' }],
          busy: false
        })
      } else if (chunk.type === 'done') {
        const next = get().queue[0]
        const chats = get().chats.map((c) => (c.id === get().activeChat ? { ...c, log: get().log } : c))
        set({
          busy: false,
          runId: undefined,
          queue: get().queue.slice(1),
          question: undefined,
          approval: undefined,
          chats,
          waitingShell: false,
          waitingUntil: 0,
          jobSource: undefined
        })
        unsub()
        void get().refreshGrounds()
        void get().refreshPending()
        void get().refreshGit()
        if (next) queueMicrotask(() => get().run(next))
      }
    })
    window.homeai.runAgent({
      id,
      task,
      provider: opts?.provider ?? get().provider,
      openFiles,
      mode: opts?.thinkPath ? 'agent' : get().agentMode,
      thinkPath: opts?.thinkPath,
      needsTools: opts?.needsTools === true,
      selection: get().selection,
      goal: get().goal || undefined,
      customSkill: get().customSkill || undefined,
      threadId: get().activeChat,
      surface: 'desktop',
      chatLog: get()
        .log.filter((i) => i.kind === 'user' || i.kind === 'assistant')
        .slice(-16)
        .map((i) => ('text' in i ? `${i.kind}: ${i.text.slice(0, 400)}` : ''))
        .join('\n')
    })
  },

  implementThink: async (path) => {
    const rel = path ? thinkRelFromOpen(path) : ''
    const rows =
      ((await window.homeai.thinkList()) as Array<{ path: string; status: string; title: string }>) ?? []
    const hit = rel
      ? rows.find((x) => x.path === rel) ?? {
          path: rel,
          status: 'ready',
          title: rel.split('/').pop() ?? rel
        }
      : rows.find((x) => x.status === 'ready') ?? rows[0]
    if (!hit) {
      set({
        log: [
          ...get().log,
          {
            id: nid(),
            kind: 'error',
            text: 'No RAG/plans/*.think.md yet. Stay in Think until plan_write lands status: ready.'
          }
        ]
      })
      return
    }
    if (!rel && hit.status !== 'ready' && hit.status !== 'implementing') {
      set({
        log: [
          ...get().log,
          {
            id: nid(),
            kind: 'error',
            text: `${hit.path} status is ${hit.status || 'empty'} — need status: ready`
          }
        ]
      })
      return
    }
    let provider: ProviderId = 'local'
    try {
      const keys = (await window.homeai.secretsStatus()) as Array<{ id: string; configured?: boolean }>
      if (keys.some((k) => k.id === 'openrouter' && k.configured)) provider = 'openrouter'
      else if (keys.some((k) => k.id === 'openai' && k.configured)) provider = 'openai'
    } catch {
      provider = 'local'
    }
    set({ agentMode: 'agent', provider, chatOpen: true })
    get().run(`Implement ${hit.title}`, { thinkPath: hit.path, provider })
  },

  enqueue: (task) => {
    set({ queue: [...get().queue, task], log: [...get().log, { id: nid(), kind: 'status', text: `queued · ${task.slice(0, 80)}` }] })
  },

  steer: (task) => {
    const id = get().runId
    if (!id) {
      get().run(task)
      return
    }
    window.homeai.steerAgent(id, task)
    set({ log: [...get().log, { id: nid(), kind: 'status', text: `steer · ${task.slice(0, 80)}` }] })
  },

  cycleMode: () => {
    const cur = get().agentMode
    const i = AGENT_MODES.indexOf(cur)
    const next = AGENT_MODES[(i + 1) % AGENT_MODES.length]
    set({ agentMode: next })
  },

  cycleProvider: () => {
    const cur = get().provider
    const i = Math.max(0, PROVIDERS.indexOf(cur))
    set({ provider: PROVIDERS[(i + 1) % PROVIDERS.length] })
  },

  cycleLayoutMode: () => {
    const cur = get().layoutMode
    const i = Math.max(0, LAYOUT_CYCLE.indexOf(cur))
    const next = LAYOUT_CYCLE[(i + 1) % LAYOUT_CYCLE.length]
    set({ layoutMode: next, chatOpen: true })
  },

  cycleDensity: () => {
    const order: ConversationDensity[] = ['compact', 'comfortable', 'spacious']
    const i = Math.max(0, order.indexOf(get().density))
    set({ density: order[(i + 1) % order.length] })
  },

  pinSkill: async (name: string) => {
    const n = name.replace(/^\//, '').replace(/!$/, '')
    await window.homeai.setModeSkill(n)
    set({ customSkill: n })
  },

  clearSkill: async () => {
    await window.homeai.setModeSkill('')
    set({ customSkill: '' })
  },

  stop: () => {
    const id = get().runId
    if (id) {
      window.homeai.stopAgent(id)
      const wf = takeWorkflow(get().workflow, { type: 'status', text: 'stopped' }, { runId: id, now: Date.now() })
      set({ busy: false, workflow: wf, subagents: workflowToSubagents(wf) })
      return
    }
    set({ busy: false, runId: undefined })
  },

  revealTool: (name) => {
    const n = toolCallName(name)
    if (n) set({ focusTool: n })
  },

  refreshPending: async () => {
    const pending = (await window.homeai.pending()) as FileChange[]
    set({ pending })
  },

  refreshGrounds: async () => {
    const [notes, board, qa, map] = await Promise.all([
      window.homeai.notesList() as Promise<NoteDoc[]>,
      window.homeai.boardGet() as Promise<TaskBoard>,
      window.homeai.qaList() as Promise<QaRecord[]>,
      window.homeai.map() as Promise<{ nodes: MapNode[]; edges: MapEdge[] }>
    ])
    const root = get().boot?.workspace
    const names = ['STATUS.md', 'ROADMAP.md', 'FEATURES.md', 'TESTS.md', 'EDGES.md']
    const libraryDocs: Record<string, string> = {}
    if (root) {
      await Promise.all(
        names.map(async (name) => {
          try {
            libraryDocs[name] = await window.homeai.read(`${root}/RAG/library/${name}`)
          } catch {
            libraryDocs[name] = ''
          }
        })
      )
    }
    set({ notes, board, qa, map, libraryDocs, libraryStatus: libraryDocs['STATUS.md'] ?? '' })
  }
}))

export function persistWorkbenchLayout() {
  const s = useWorkbench.getState()
  if (!s.layoutReady || !s.boot?.workspace || !window.homeai?.layoutSet) return
  const ws = s.boot.workspace
  const tabs = s.tabs
    .map((t) => workspaceRel(ws, t.path))
    .filter((x): x is string => Boolean(x))
    .slice(0, 12)
  void window.homeai.layoutSet({
    activity: s.activity,
    chatOpen: s.chatOpen,
    termOpen: s.termOpen,
    sidebarW: s.sidebarW,
    chatW: s.chatW,
    termH: s.termH,
    termPanel: s.termPanel,
    split: s.split,
    layoutMode: s.layoutMode,
    density: s.density,
    cowork: s.cowork === true,
    pinnedChats: s.pinnedChats.slice(0, 24),
    tabs,
    active: s.activePath ? workspaceRel(ws, s.activePath) : null,
    splitPath: s.splitPath ? workspaceRel(ws, s.splitPath) : null
  })
}

export function visualTier(): VisualTier {
  return useWorkbench.getState().boot?.probe.visualTier ?? 'balanced'
}

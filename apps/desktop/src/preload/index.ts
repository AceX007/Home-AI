import { contextBridge, ipcRenderer } from 'electron'
import type {
  AgentMode,
  CheckpointMeta,
  ContextRing,
  FileChange,
  GitSnapshot,
  GovernorOverride,
  HardwareProbe,
  LlmStatus,
  PermissionsFile,
  ProviderId,
  ProviderStatus,
  SecretName,
  StreamChunk,
  TaskBoard,
  DesignIR,
  DesignListItem,
  DesignPatchEnvelope,
  DesignCreateArgs,
  DesignChanged
} from '@homeai/core'
import type {
  TsCompletion,
  TsDiagnostic,
  TsHover,
  TsPositionRequest,
  TsRange,
  TsRenameResult,
  TsSymbol,
  TsTextEdit
} from '@homeai/ts-intel'
import type { DebugSnapshot } from '@homeai/debug'

export interface HomeAiApi {
  boot: () => Promise<Record<string, unknown>>
  probe: (override?: GovernorOverride) => Promise<HardwareProbe>
  llmStart: () => Promise<LlmStatus>
  llmStop: () => Promise<LlmStatus>
  llmStatus: () => Promise<LlmStatus>
  list: (path: string) => Promise<unknown>
  read: (path: string) => Promise<string>
  write: (path: string, content: string) => Promise<boolean>
  tsSync: (path: string, text: string, version?: number) => Promise<boolean>
  tsClose: (path: string) => Promise<boolean>
  tsDiagnostics: (request: TsPositionRequest) => Promise<TsDiagnostic[]>
  tsSymbols: (request: TsPositionRequest) => Promise<TsSymbol[]>
  tsWorkspaceSymbols: (query?: string) => Promise<TsSymbol[]>
  tsCancel: () => Promise<boolean>
  tsDefinition: (request: TsPositionRequest) => Promise<TsRange[]>
  tsReferences: (request: TsPositionRequest) => Promise<TsRange[]>
  tsHover: (request: TsPositionRequest) => Promise<TsHover | null>
  tsCompletions: (request: TsPositionRequest) => Promise<TsCompletion[]>
  tsFormat: (request: TsPositionRequest) => Promise<TsTextEdit[]>
  tsRename: (request: TsPositionRequest & { newName: string }) => Promise<TsRenameResult>
  debugStart: (payload: { path: string; args?: string[] }) => Promise<DebugSnapshot>
  debugBreakpoint: (payload: { path: string; line: number; enabled?: boolean }) => Promise<DebugSnapshot>
  debugStack: () => Promise<DebugSnapshot>
  debugEvaluate: (payload: { expression: string }) => Promise<string>
  debugContinue: (payload?: { kind?: string }) => Promise<DebugSnapshot>
  debugStop: () => Promise<DebugSnapshot>
  debugState: () => Promise<DebugSnapshot>
  onDebugEvent: (fn: (snap: DebugSnapshot) => void) => () => void
  mkdir: (path: string) => Promise<string>
  rename: (from: string, to: string) => Promise<string>
  remove: (path: string) => Promise<boolean>
  kernelPulse: () => Promise<unknown>
  workbenchPorts: () => Promise<Array<{ name: string; port: number }>>
  layoutGet: () => Promise<unknown>
  layoutSet: (raw: unknown) => Promise<unknown>
  openFolder: () => Promise<string>
  ragSearch: (query: string) => Promise<unknown>
  ragStats: () => Promise<{ documents: number; lastIngest?: number }>
  map: () => Promise<unknown>
  mapPin: (payload: { nodeId: string; title: string }) => Promise<unknown>
  qaList: () => Promise<unknown>
  qaAdd: (rec: unknown) => Promise<boolean>
  notesList: () => Promise<unknown>
  boardGet: () => Promise<TaskBoard>
  boardSave: (board: TaskBoard) => Promise<boolean>
  boardUpsert: (args: { id?: string; title: string; column?: string; body?: string }) => Promise<TaskBoard>
  designGet: (slug?: string) => Promise<DesignIR>
  designPatch: (envelope: DesignPatchEnvelope, slug?: string) => Promise<DesignIR>
  designCreate: (args: DesignCreateArgs) => Promise<{ slug: string; doc: DesignIR }>
  designList: () => Promise<DesignListItem[]>
  designIngestTokens: (path?: string, slug?: string) => Promise<{ doc: DesignIR; applied: string[]; skipped: string[] }>
  onDesignChanged: (fn: (p: DesignChanged) => void) => () => void
  secretsStatus: () => Promise<ProviderStatus[]>
  secretsSet: (name: SecretName, value: string) => Promise<ProviderStatus[]>
  secretsDelete: (name: SecretName) => Promise<ProviderStatus[]>
  mods: () => Promise<unknown>
  permissions: () => Promise<PermissionsFile>
  permissionsSet: (file: PermissionsFile, confirmUnrestricted?: boolean) => Promise<PermissionsFile>
  gitStatus: () => Promise<GitSnapshot>
  gitDiff: (staged?: boolean) => Promise<string>
  gitLines: (path: string) => Promise<{ added: number[]; removed: number[] }>
  gitLog: () => Promise<string>
  gitAdd: (paths: string[]) => Promise<string>
  gitUnstage: (paths: string[]) => Promise<string>
  gitCommit: (message: string) => Promise<string>
  gitPull: () => Promise<string>
  gitPush: () => Promise<string>
  workspaceGrep: (query: string) => Promise<Array<{ path: string; line: number; text: string }>>
  gitWorktreeList: () => Promise<string>
  gitWorktreeAdd: (name: string) => Promise<string>
  checkpoints: () => Promise<CheckpointMeta[]>
  checkpointGet: (id: string) => Promise<unknown>
  restore: (id: string) => Promise<string[]>
  infill: (payload: { prefix: string; suffix: string }) => Promise<string>
  mcpList: () => Promise<unknown>
  mcpReload: () => Promise<unknown>
  mcpEnableStarter: (pack?: string) => Promise<{ servers: string[] }>
  mcpTrustStarter: () => Promise<PermissionsFile>
  thinkList: () => Promise<unknown>
  agentReview: (depth?: 'quick' | 'deep') => Promise<{ text: string; diff: string }>
  cursorLaunch: (prompt: string, repo?: string) => Promise<unknown>
  cursorGet: (id: string) => Promise<unknown>
  cursorList: () => Promise<unknown>
  browserShow: (bounds: { x: number; y: number; width: number; height: number }) => Promise<void>
  browserHide: () => Promise<void>
  browserNavigate: (url: string) => Promise<void>
  browserExtract: () => Promise<{ url: string; title: string; text: string; saved: string }>
  browserConsole: (persist?: boolean) => Promise<string>
  openPath: (path: string) => Promise<unknown>
  runAgent: (payload: {
    id: string
    task: string
    provider: ProviderId
    openFiles: string[]
    mode?: AgentMode
    selection?: { path: string; text: string }
    goal?: string
    customSkill?: string
    chatLog?: string
    thinkPath?: string
    threadId?: string
    surface?: 'telegram' | 'desktop'
    needsTools?: boolean
  }) => void
  stopAgent: (id: string) => void
  steerAgent: (id: string, text: string) => void
  answerAgent: (id: string, text: string) => void
  approveAgent: (id: string, ok: boolean) => void
  setGoal: (g: string) => Promise<string>
  setModeSkill: (name: string) => Promise<string>
  profileGet: () => Promise<unknown>
  profileSet: (patch: unknown) => Promise<unknown>
  threadList: () => Promise<unknown>
  threadGet: (id: string) => Promise<unknown>
  threadCreate: (title: string) => Promise<unknown>
  threadSelect: (id: string) => Promise<string>
  threadRename: (id: string, title: string) => Promise<unknown>
  knowledgeList: () => Promise<unknown>
  knowledgeWriteSkill: (args: { name: string; description?: string; body: string }) => Promise<unknown>
  knowledgeWriteRule: (args: { name: string; body: string }) => Promise<unknown>
  knowledgeDeleteSkill: (slug: string) => Promise<unknown>
  knowledgeDeleteRule: (slug: string) => Promise<unknown>
  telegramStatus: () => Promise<unknown>
  telegramSession: () => Promise<unknown>
  telegramPairStart: () => Promise<{ code: string; exp: number }>
  telegramUnpair: (userId: number) => Promise<unknown>
  telegramRestart: () => Promise<unknown>
  telegramSetToken: (value: string) => Promise<unknown>
  miniappStatus: () => Promise<{ url: string; publicUrl: string | null; listening: boolean }>
  miniappOpen: () => Promise<{ url: string }>
  miniappPush: () => Promise<{ url: string }>
  onAgentChunk: (fn: (id: string, chunk: StreamChunk) => void) => () => void
  quickOpen: (query: string) => Promise<string[]>
  pending: () => Promise<FileChange[]>
  acceptChange: (path: string) => Promise<FileChange[]>
  acceptAll: () => Promise<FileChange[]>
  rejectChange: (path: string) => Promise<FileChange[]>
  undoAll: () => Promise<string[]>
  inlineEdit: (payload: {
    path: string
    selected: string
    instruction: string
    provider: ProviderId
  }) => Promise<{ replacement: string; change: FileChange }>
  saveInbox: (payload: { name: string; base64: string }) => Promise<string>
  ptyCreate: (cols: number, rows: number) => Promise<number>
  ptyWrite: (id: number, data: string) => void
  ptyResize: (id: number, cols: number, rows: number) => void
  ptyKill: (id: number) => Promise<void>
  ptyTranscript: (id: number) => Promise<string>
  onPtyData: (fn: (id: number, data: string) => void) => () => void
  onPtyExit: (fn: (id: number, code: number) => void) => () => void
  fleetSnapshot: () => Promise<unknown>
  fleetAddRepo: (raw: unknown) => Promise<unknown>
  fleetRemoveRepo: (raw: unknown) => Promise<unknown>
  fleetClone: (raw: unknown) => Promise<unknown>
  fleetCloneLocal: (raw: unknown) => Promise<unknown>
  fleetPatchRepo: (raw: unknown) => Promise<unknown>
  fleetStart: (raw: unknown) => Promise<unknown>
  fleetStop: (raw: unknown) => Promise<unknown>
  fleetRestart: (raw: unknown) => Promise<unknown>
  fleetLog: (raw: unknown) => Promise<string>
  fleetAddBot: (raw: unknown) => Promise<unknown>
  fleetRemoveBot: (raw: unknown) => Promise<unknown>
  fleetProbeBot: (raw: unknown) => Promise<unknown>
  fleetAddAccount: (raw: unknown) => Promise<unknown>
  fleetRemoveAccount: (raw: unknown) => Promise<unknown>
  fleetAddSub: (raw: unknown) => Promise<unknown>
  fleetRemoveSub: (raw: unknown) => Promise<unknown>
  fleetSmtpSet: (raw: unknown) => Promise<unknown>
  fleetDraft: (raw: unknown) => Promise<{ text: string }>
  fleetBroadcast: (raw: unknown) => Promise<unknown>
  fleetAnnounce: (raw: unknown) => Promise<unknown>
  winMin: () => Promise<void>
  winMax: () => Promise<void>
  winClose: () => Promise<void>
  onboardDone: () => Promise<{ ok: boolean }>
  modelDownload: () => Promise<{ ok?: boolean; hint?: string; name?: string }>
  diagnostics: () => Promise<unknown>
  crashSet: (raw: unknown) => Promise<{ crashOptIn: string }>
  updateCheck: () => Promise<{ feed: string; update: boolean; version?: string }>
  hardwareGate: () => Promise<{ ok?: boolean; hint?: string; ramOk?: boolean; diskOk?: boolean }>
}

const api: HomeAiApi = {
  boot: () => ipcRenderer.invoke('homeai:boot'),
  probe: (override) => ipcRenderer.invoke('homeai:governor:probe', override),
  llmStart: () => ipcRenderer.invoke('homeai:llm:start'),
  llmStop: () => ipcRenderer.invoke('homeai:llm:stop'),
  llmStatus: () => ipcRenderer.invoke('homeai:llm:status'),
  list: (path) => ipcRenderer.invoke('homeai:fs:list', path),
  read: (path) => ipcRenderer.invoke('homeai:fs:read', path),
  write: (path, content) => ipcRenderer.invoke('homeai:fs:write', path, content),
  tsSync: (path, text, version) => ipcRenderer.invoke('homeai:ts:sync', { path, text, version }),
  tsClose: (path) => ipcRenderer.invoke('homeai:ts:close', path),
  tsDiagnostics: (request) => ipcRenderer.invoke('homeai:ts:diagnostics', request),
  tsSymbols: (request) => ipcRenderer.invoke('homeai:ts:symbols', request),
  tsWorkspaceSymbols: (query) => ipcRenderer.invoke('homeai:ts:workspaceSymbols', query || ''),
  tsCancel: () => ipcRenderer.invoke('homeai:ts:cancel'),
  tsDefinition: (request) => ipcRenderer.invoke('homeai:ts:definition', request),
  tsReferences: (request) => ipcRenderer.invoke('homeai:ts:references', request),
  tsHover: (request) => ipcRenderer.invoke('homeai:ts:hover', request),
  tsCompletions: (request) => ipcRenderer.invoke('homeai:ts:completions', request),
  tsFormat: (request) => ipcRenderer.invoke('homeai:ts:format', request),
  tsRename: (request) => ipcRenderer.invoke('homeai:ts:rename', request),
  debugStart: (payload) => ipcRenderer.invoke('homeai:debug:start', payload),
  debugBreakpoint: (payload) => ipcRenderer.invoke('homeai:debug:breakpoint', payload),
  debugStack: () => ipcRenderer.invoke('homeai:debug:stack'),
  debugEvaluate: (payload) => ipcRenderer.invoke('homeai:debug:evaluate', payload),
  debugContinue: (payload) => ipcRenderer.invoke('homeai:debug:continue', payload || { kind: 'continue' }),
  debugStop: () => ipcRenderer.invoke('homeai:debug:stop'),
  debugState: () => ipcRenderer.invoke('homeai:debug:state'),
  mkdir: (path) => ipcRenderer.invoke('homeai:fs:mkdir', path),
  rename: (from, to) => ipcRenderer.invoke('homeai:fs:rename', from, to),
  remove: (path) => ipcRenderer.invoke('homeai:fs:remove', path),
  kernelPulse: () => ipcRenderer.invoke('homeai:kernel:pulse'),
  workbenchPorts: () => ipcRenderer.invoke('homeai:workbench:ports'),
  layoutGet: () => ipcRenderer.invoke('homeai:workbench:layout:get'),
  layoutSet: (raw) => ipcRenderer.invoke('homeai:workbench:layout:set', raw),
  openFolder: () => ipcRenderer.invoke('homeai:fs:openFolder'),
  ragSearch: (query) => ipcRenderer.invoke('homeai:rag:search', query),
  ragStats: () => ipcRenderer.invoke('homeai:rag:stats'),
  map: () => ipcRenderer.invoke('homeai:rag:map'),
  mapPin: (payload) => ipcRenderer.invoke('homeai:rag:pin', payload),
  qaList: () => ipcRenderer.invoke('homeai:rag:qa:list'),
  qaAdd: (rec) => ipcRenderer.invoke('homeai:rag:qa:add', rec),
  notesList: () => ipcRenderer.invoke('homeai:notes:list'),
  boardGet: () => ipcRenderer.invoke('homeai:board:get'),
  boardSave: (board) => ipcRenderer.invoke('homeai:board:save', board),
  boardUpsert: (args) => ipcRenderer.invoke('homeai:board:upsert', args),
  designGet: (slug) => ipcRenderer.invoke('homeai:design:get', slug),
  designPatch: (envelope, slug) => ipcRenderer.invoke('homeai:design:patch', envelope, slug),
  designCreate: (args) => ipcRenderer.invoke('homeai:design:create', args),
  designList: () => ipcRenderer.invoke('homeai:design:list'),
  designIngestTokens: (path, slug) => ipcRenderer.invoke('homeai:design:ingestTokens', path, slug),
  secretsStatus: () => ipcRenderer.invoke('homeai:secrets:status'),
  secretsSet: (name, value) => ipcRenderer.invoke('homeai:secrets:set', name, value),
  secretsDelete: (name) => ipcRenderer.invoke('homeai:secrets:delete', name),
  mods: () => ipcRenderer.invoke('homeai:mods:list'),
  permissions: () => ipcRenderer.invoke('homeai:permissions:get'),
  permissionsSet: (file, confirmUnrestricted) =>
    ipcRenderer.invoke('homeai:permissions:set', file, confirmUnrestricted === true),
  gitStatus: () => ipcRenderer.invoke('homeai:git:status'),
  gitDiff: (staged) => ipcRenderer.invoke('homeai:git:diff', staged),
  gitLines: (path) => ipcRenderer.invoke('homeai:git:lines', path),
  gitLog: () => ipcRenderer.invoke('homeai:git:log'),
  gitAdd: (paths) => ipcRenderer.invoke('homeai:git:add', paths),
  gitUnstage: (paths) => ipcRenderer.invoke('homeai:git:unstage', paths),
  gitCommit: (message) => ipcRenderer.invoke('homeai:git:commit', message),
  gitPull: () => ipcRenderer.invoke('homeai:git:pull'),
  gitPush: () => ipcRenderer.invoke('homeai:git:push'),
  workspaceGrep: (query) => ipcRenderer.invoke('homeai:search:grep', query),
  gitWorktreeList: () => ipcRenderer.invoke('homeai:git:worktree:list'),
  gitWorktreeAdd: (name) => ipcRenderer.invoke('homeai:git:worktree:add', name),
  checkpoints: () => ipcRenderer.invoke('homeai:composer:checkpoints'),
  checkpointGet: (id) => ipcRenderer.invoke('homeai:composer:checkpointGet', id),
  restore: (id) => ipcRenderer.invoke('homeai:composer:restore', id),
  infill: (payload) => ipcRenderer.invoke('homeai:infill', payload),
  mcpList: () => ipcRenderer.invoke('homeai:mcp:list'),
  mcpReload: () => ipcRenderer.invoke('homeai:mcp:reload'),
  mcpEnableStarter: (pack) =>
    ipcRenderer.invoke('homeai:mcp:enableStarter', pack === 'blender' ? { pack: 'blender' } : {}),
  mcpTrustStarter: () => ipcRenderer.invoke('homeai:mcp:trustStarter'),
  thinkList: () => ipcRenderer.invoke('homeai:think:list'),
  agentReview: (depth) => ipcRenderer.invoke('homeai:agentReview:quick', depth),
  cursorLaunch: (prompt, repo) => ipcRenderer.invoke('homeai:cursor:launch', prompt, repo),
  cursorGet: (id) => ipcRenderer.invoke('homeai:cursor:get', id),
  cursorList: () => ipcRenderer.invoke('homeai:cursor:list'),
  browserShow: (bounds) => ipcRenderer.invoke('homeai:browser:show', bounds),
  browserHide: () => ipcRenderer.invoke('homeai:browser:hide'),
  browserNavigate: (url) => ipcRenderer.invoke('homeai:browser:navigate', url),
  browserExtract: () => ipcRenderer.invoke('homeai:browser:extract'),
  browserConsole: (persist) => ipcRenderer.invoke('homeai:browser:console', persist === true),
  openPath: (path) => ipcRenderer.invoke('homeai:shell:open', path),
  runAgent: (payload) => ipcRenderer.send('homeai:agent:run', payload),
  stopAgent: (id) => ipcRenderer.send('homeai:agent:stop', id),
  steerAgent: (id, text) => ipcRenderer.send('homeai:agent:steer', id, text),
  answerAgent: (id, text) => ipcRenderer.send('homeai:agent:answer', id, text),
  approveAgent: (id, ok) => ipcRenderer.send('homeai:agent:approve', id, ok),
  setGoal: (g) => ipcRenderer.invoke('homeai:goal:set', g),
  setModeSkill: (name) => ipcRenderer.invoke('homeai:modeSkill:set', name),
  profileGet: () => ipcRenderer.invoke('homeai:profile:get'),
  profileSet: (patch) => ipcRenderer.invoke('homeai:profile:set', patch),
  threadList: () => ipcRenderer.invoke('homeai:thread:list'),
  threadGet: (id) => ipcRenderer.invoke('homeai:thread:get', id),
  threadCreate: (title) => ipcRenderer.invoke('homeai:thread:create', title),
  threadSelect: (id) => ipcRenderer.invoke('homeai:thread:select', id),
  threadRename: (id, title) => ipcRenderer.invoke('homeai:thread:rename', id, title),
  knowledgeList: () => ipcRenderer.invoke('homeai:knowledge:list'),
  knowledgeWriteSkill: (args) => ipcRenderer.invoke('homeai:knowledge:writeSkill', args),
  knowledgeWriteRule: (args) => ipcRenderer.invoke('homeai:knowledge:writeRule', args),
  knowledgeDeleteSkill: (slug) => ipcRenderer.invoke('homeai:knowledge:deleteSkill', slug),
  knowledgeDeleteRule: (slug) => ipcRenderer.invoke('homeai:knowledge:deleteRule', slug),
  telegramStatus: () => ipcRenderer.invoke('homeai:telegram:status'),
  telegramSession: () => ipcRenderer.invoke('homeai:telegram:session'),
  telegramPairStart: () => ipcRenderer.invoke('homeai:telegram:pairStart'),
  telegramUnpair: (userId) => ipcRenderer.invoke('homeai:telegram:unpair', userId),
  telegramRestart: () => ipcRenderer.invoke('homeai:telegram:restart'),
  telegramSetToken: (value) => ipcRenderer.invoke('homeai:telegram:setToken', value),
  miniappStatus: () => ipcRenderer.invoke('homeai:miniapp:status'),
  miniappOpen: () => ipcRenderer.invoke('homeai:miniapp:open'),
  miniappPush: () => ipcRenderer.invoke('homeai:miniapp:push'),
  onAgentChunk: (fn) => {
    const listener = (_e: unknown, id: string, chunk: StreamChunk) => fn(id, chunk)
    ipcRenderer.on('homeai:agent:chunk', listener)
    return () => ipcRenderer.removeListener('homeai:agent:chunk', listener)
  },
  onDesignChanged: (fn) => {
    const listener = (_e: unknown, p: DesignChanged) => fn(p)
    ipcRenderer.on('homeai:design:changed', listener)
    return () => ipcRenderer.removeListener('homeai:design:changed', listener)
  },
  onDebugEvent: (fn) => {
    const listener = (_e: unknown, snap: DebugSnapshot) => fn(snap)
    ipcRenderer.on('homeai:debug:event', listener)
    return () => ipcRenderer.removeListener('homeai:debug:event', listener)
  },
  quickOpen: (query) => ipcRenderer.invoke('homeai:fs:quickOpen', query),
  pending: () => ipcRenderer.invoke('homeai:composer:pending'),
  acceptChange: (path) => ipcRenderer.invoke('homeai:composer:accept', path),
  acceptAll: () => ipcRenderer.invoke('homeai:composer:acceptAll'),
  rejectChange: (path) => ipcRenderer.invoke('homeai:composer:reject', path),
  undoAll: () => ipcRenderer.invoke('homeai:composer:undoAll'),
  inlineEdit: (payload) => ipcRenderer.invoke('homeai:inline', payload),
  saveInbox: (payload) => ipcRenderer.invoke('homeai:inbox:save', payload),
  ptyCreate: (cols, rows) => ipcRenderer.invoke('homeai:pty:create', cols, rows),
  ptyWrite: (id, data) => ipcRenderer.send('homeai:pty:write', id, data),
  ptyResize: (id, cols, rows) => ipcRenderer.send('homeai:pty:resize', id, cols, rows),
  ptyKill: (id) => ipcRenderer.invoke('homeai:pty:kill', id),
  ptyTranscript: (id) => ipcRenderer.invoke('homeai:pty:transcript', id),
  fleetSnapshot: () => ipcRenderer.invoke('homeai:fleet:snapshot'),
  fleetAddRepo: (raw) => ipcRenderer.invoke('homeai:fleet:addRepo', raw),
  fleetRemoveRepo: (raw) => ipcRenderer.invoke('homeai:fleet:removeRepo', raw),
  fleetClone: (raw) => ipcRenderer.invoke('homeai:fleet:clone', raw),
  fleetCloneLocal: (raw) => ipcRenderer.invoke('homeai:fleet:cloneLocal', raw),
  fleetPatchRepo: (raw) => ipcRenderer.invoke('homeai:fleet:patchRepo', raw),
  fleetStart: (raw) => ipcRenderer.invoke('homeai:fleet:start', raw),
  fleetStop: (raw) => ipcRenderer.invoke('homeai:fleet:stop', raw),
  fleetRestart: (raw) => ipcRenderer.invoke('homeai:fleet:restart', raw),
  fleetLog: (raw) => ipcRenderer.invoke('homeai:fleet:log', raw),
  fleetAddBot: (raw) => ipcRenderer.invoke('homeai:fleet:addBot', raw),
  fleetRemoveBot: (raw) => ipcRenderer.invoke('homeai:fleet:removeBot', raw),
  fleetProbeBot: (raw) => ipcRenderer.invoke('homeai:fleet:probeBot', raw),
  fleetAddAccount: (raw) => ipcRenderer.invoke('homeai:fleet:addAccount', raw),
  fleetRemoveAccount: (raw) => ipcRenderer.invoke('homeai:fleet:removeAccount', raw),
  fleetAddSub: (raw) => ipcRenderer.invoke('homeai:fleet:addSub', raw),
  fleetRemoveSub: (raw) => ipcRenderer.invoke('homeai:fleet:removeSub', raw),
  fleetSmtpSet: (raw) => ipcRenderer.invoke('homeai:fleet:smtpSet', raw),
  fleetDraft: (raw) => ipcRenderer.invoke('homeai:fleet:draft', raw),
  fleetBroadcast: (raw) => ipcRenderer.invoke('homeai:fleet:broadcast', raw),
  fleetAnnounce: (raw) => ipcRenderer.invoke('homeai:fleet:announce', raw),
  onPtyData: (fn) => {
    const listener = (_e: unknown, id: number, data: string) => fn(id, data)
    ipcRenderer.on('homeai:pty:data', listener)
    return () => ipcRenderer.removeListener('homeai:pty:data', listener)
  },
  onPtyExit: (fn) => {
    const listener = (_e: unknown, id: number, code: number) => fn(id, Number(code) || 0)
    ipcRenderer.on('homeai:pty:exit', listener)
    return () => ipcRenderer.removeListener('homeai:pty:exit', listener)
  },
  winMin: () => ipcRenderer.invoke('homeai:win:min'),
  winMax: () => ipcRenderer.invoke('homeai:win:max'),
  winClose: () => ipcRenderer.invoke('homeai:win:close'),
  onboardDone: () => ipcRenderer.invoke('homeai:onboard:done'),
  modelDownload: () => ipcRenderer.invoke('homeai:model:download'),
  diagnostics: () => ipcRenderer.invoke('homeai:diagnostics'),
  crashSet: (raw) => ipcRenderer.invoke('homeai:crash:set', raw),
  updateCheck: () => ipcRenderer.invoke('homeai:update:check'),
  hardwareGate: () => ipcRenderer.invoke('homeai:hardware:gate')
}

contextBridge.exposeInMainWorld('homeai', api)

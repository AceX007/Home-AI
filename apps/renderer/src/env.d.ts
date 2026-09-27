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

declare global {
  interface Window {
    homeai: {
      boot: () => Promise<Record<string, unknown>>
      probe: (override?: unknown) => Promise<unknown>
      llmStart: () => Promise<unknown>
      llmStop: () => Promise<unknown>
      llmStatus: () => Promise<unknown>
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
      boardGet: () => Promise<unknown>
      boardSave: (board: unknown) => Promise<boolean>
      boardUpsert: (args: unknown) => Promise<unknown>
      designGet: (slug?: string) => Promise<unknown>
      designPatch: (envelope: unknown, slug?: string) => Promise<unknown>
      designCreate: (args: unknown) => Promise<unknown>
      designList: () => Promise<unknown>
      designIngestTokens: (path?: string, slug?: string) => Promise<unknown>
      onDesignChanged: (fn: (p: { slug: string; revision: string }) => void) => () => void
      secretsStatus: () => Promise<unknown>
      secretsSet: (name: string, value: string) => Promise<unknown>
      secretsDelete: (name: string) => Promise<unknown>
      mods: () => Promise<unknown>
      permissions: () => Promise<unknown>
      permissionsSet: (file: unknown, confirmUnrestricted?: boolean) => Promise<unknown>
      gitStatus: () => Promise<unknown>
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
      checkpoints: () => Promise<unknown>
      checkpointGet: (id: string) => Promise<unknown>
      restore: (id: string) => Promise<string[]>
      infill: (payload: { prefix: string; suffix: string }) => Promise<string>
      mcpList: () => Promise<unknown>
      mcpReload: () => Promise<unknown>
      mcpEnableStarter: (pack?: string) => Promise<{ servers: string[] }>
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
        provider: string
        openFiles: string[]
        mode?: string
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
      knowledgeWriteSkill: (args: unknown) => Promise<unknown>
      knowledgeWriteRule: (args: unknown) => Promise<unknown>
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
      onAgentChunk: (fn: (id: string, chunk: unknown) => void) => () => void
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
      saveInbox: (payload: { name: string; base64: string }) => Promise<string>
      quickOpen: (query: string) => Promise<unknown>
      pending: () => Promise<unknown>
      acceptChange: (path: string) => Promise<unknown>
      acceptAll: () => Promise<unknown>
      rejectChange: (path: string) => Promise<unknown>
      undoAll: () => Promise<unknown>
      inlineEdit: (payload: {
        path: string
        selected: string
        instruction: string
        provider: string
      }) => Promise<unknown>
      winMin: () => Promise<void>
      winMax: () => Promise<void>
      winClose: () => Promise<void>
      onboardDone: () => Promise<{ ok: boolean }>
      modelDownload: () => Promise<{ ok?: boolean; hint?: string; name?: string }>
      diagnostics: () => Promise<unknown>
      crashSet: (raw: unknown) => Promise<{ crashOptIn: string }>
      updateCheck: () => Promise<{ feed: string; update: boolean; version?: string }>
      hardwareGate: () => Promise<{ ok: boolean; hint: string; ramOk: boolean; diskOk: boolean }>
    }
  }
}

export {}

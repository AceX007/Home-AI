import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, crashReporter } from 'electron'
import { existsSync, readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs'
import { totalmem } from 'node:os'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join } from 'node:path'
import { readFile, writeFile, mkdir, readdir, stat, statfs, unlink, rename } from 'node:fs/promises'
import type { AgentMode, ChatMessage, GovernorOverride, PermissionsFile, ProviderId, SecretName, StreamChunk, ToolResult } from '@homeai/core'
import { DEFAULT_LLAMA_PORT, DEFAULT_MODEL_NAME } from '@homeai/core'
import { probeHardware, llamaArgsFor, fallbackOnOom, coderModelName, coderLlamaArgs, jailedCoderModelPath } from '@homeai/governor'
import { LlamaServerManager, cursorLaunchAgent, cursorGetAgent, cursorListAgents, detectLmStudio, completeOnce, infillOnce, createCoderManager, pickInfillPort, ownedLlamaPort } from '@homeai/llm'
import { RagStore } from '@homeai/rag'
import { builtinToolDefs, loadAllKnowledge } from '@homeai/mods'
import { runForge } from '@homeai/agent'
import { TsIntelligence, applyTextEdits, publicTsError, takeTsQuery, takeTsRequest } from '@homeai/ts-intel'
import {
  NodeDebugHost,
  publicDebugError,
  takeDebugBreakpoint,
  takeDebugContinue,
  takeDebugEval,
  takeDebugLaunch
} from '@homeai/debug'
import {
  ChangeSet,
  applySelection,
  decideTool,
  runAutoReviewPipeline,
  parseReviewerAxes,
  publicAutoReviewLine,
  reviewerSystemPrompt,
  reviewerUserPrompt,
  takeReviewerTranscript,
  gitAdd,
  gitUnstage,
  gitCommit,
  gitDiff,
  gitLog,
  gitSnapshot,
  gitBranch,
  gitWorktreeAdd,
  gitWorktreeList,
  gitPullFfOnly,
  gitPushUpstream,
  gitLineChanges,
  lastConversation,
  loadIgnore,
  loadPermissions,
  savePermissions,
  mcpToolAllowed,
  mcpApprovalDecision,
  toolApprovalDetail,
  cursorAgentId,
  cursorJobList,
  cursorJobSummary,
  redactCloudText,
  bumpThinkStatus,
  shouldCloseThink,
  chunkIsForgeError,
  McpHub,
  parseSlash,
  pickSkill,
  resolveMentions,
  runHooks,
  seedPermissions,
  aboutMeRule,
  appendTurn,
  chatThreadId,
  createThread,
  archiveThread,
  deleteThread,
  deleteRule,
  deleteSkill,
  ensureHomeThread,
  formatChatLog,
  getThread,
  listThreads,
  listWritableRules,
  listWritableSkills,
  loadActiveThreadId,
  loadProfile,
  loadTelegramState,
  ragExcerpt,
  renameThread,
  saveActiveThreadId,
  saveProfile,
  telegramStatusView,
  telegramUserId,
  unpair,
  writeRule,
  writeSkill,
  toolsForMode,
  toolsForDesign,
  toolsForSubagent,
  nestedExploreForgeFlags,
  formatToolSurface,
  isFullToolMode,
  detectToolPacks,
  enableMcpStarter,
  takeMcpEnableOpts,
  jailPath,
  healthPulse,
  loadLayout,
  loopbackMiniAppUrl,
  pickForgeProvider,
  forgeForDesign,
  forgeFallbackNote,
  forgeTurnCap,
  taskNeedsDesignTools,
  publicMindError,
  pushMiniChunk,
  saveInboxSafe,
  saveLayout,
  takeChromePulse,
  takeKernelHealth,
  takeMind,
  takeMiniAppUrl,
  takePortList,
  takeTelegramSession,
  publicDesignEnvelope,
  takeOnboardNeeded,
  takeOpenFolder,
  takeHardwareGate,
  publicDiagnostics,
  takeCrashOptIn,
  takeUpdateFeed,
  takeUpdateProvider,
  takePartialDest,
  takeRangeHeader,
  takeGgufReady,
  sha256File,
  modelDownloadPlan,
  takeApprovalSave,
  needsPerceivePack,
  freezeToolList,
  filterFrozenTools,
  registerKernelRun,
  stopKernelRun,
  forgetKernelRun,
  kernelRunCount,
  kernelSurface,
  bootCurate,
  mergeStarterAllowlist,
  MCP_STARTER_IDS,
  mintHarness,
  harnessRel,
  takeHarness,
  gatewayContinuity,
  fleetReceiptLine,
  designMeshRoute
} from '@homeai/runtime'
import { projectRoot, modelPath, secretsDir, ragDbPath, vendorDir, defaultWorkspace, loadRoots, saveRootsPatch, profileDir } from './paths'
import { seedWorkspace, seedLibraryIfMissing } from './seed'
import {
  listDir,
  mkdirSafe,
  readFileSafe,
  removeSafe,
  renameSafe,
  writeFileSafe,
  runTool,
  loadBoard,
  saveBoard,
  upsertTask,
  loadDesign,
  patchDesign,
  ingestDesignTokens,
  createDesign,
  listDesigns,
  designEvents,
  perceivePack,
  listThinkDocs,
  loadThinkDoc,
  quickOpen,
  workspaceGrep,
  assertInside,
  refreshWorkspaceGraph
} from './tools'
import { getSecret, setSecret, deleteSecret, providerStatus, attachSecretCrypt } from './secrets'
import { createTelegramBridge } from './telegram-bridge'
import { createMiniAppServer, MINIAPP_PORT } from './miniapp-server'
import { registerPty, disposePtys, lastPtyText } from './pty-host'
import { createFleetHost } from './fleet-host'
import {
  showBrowser,
  hideBrowser,
  browserNavigate,
  browserExtract,
  browserClick,
  browserType,
  browserScreenshot,
  browserConsole,
  browserCurrentUrl,
  lastBrowserText
} from './browser'

app.setName('Hex AI Workbench')
if (process.env.ELECTRON_RENDERER_URL || process.env.ELECTRON_DISABLE_SANDBOX) {
  app.commandLine.appendSwitch('no-sandbox')
}

let mainWindow: BrowserWindow | null = null
let rag: RagStore | null = null
let llama: LlamaServerManager | null = null
let coder: LlamaServerManager | null = null
let workspace = ''
let probeCache: Awaited<ReturnType<typeof probeHardware>> | null = null
let override: GovernorOverride = { profile: 'auto', visualTier: 'auto' }
const changes = new ChangeSet()
const aborts = new Map<string, AbortController>()
const steers = new Map<string, string[]>()
const approvals = new Map<string, (ok: boolean) => void>()
const questions = new Map<string, (ans: string) => void>()
const mcp = new McpHub()
let mcpTools: Awaited<ReturnType<McpHub['load']>> = []
let lastVerifyOk = true
let stickyGoal = ''
let customModeSkill = ''
let telegramBridge: ReturnType<typeof createTelegramBridge> | null = null
let miniApp: ReturnType<typeof createMiniAppServer> | null = null
let fleetHost: ReturnType<typeof createFleetHost> | null = null
let tsIntel: TsIntelligence | null = null
let debugIntel: NodeDebugHost | null = null
const HEADLESS = Boolean(process.env.HOMEAI_HEADLESS)
const mainDir = dirname(fileURLToPath(import.meta.url))

function root(): string {
  return workspace || defaultWorkspace()
}

function languageIntel(): TsIntelligence {
  const ws = root()
  if (!tsIntel || tsIntel.root !== ws) {
    tsIntel?.dispose()
    tsIntel = new TsIntelligence(ws)
  }
  return tsIntel
}

function emitDebug() {
  const snap = debugIntel?.snapshot()
  if (mainWindow && !mainWindow.isDestroyed() && snap) {
    mainWindow.webContents.send('homeai:debug:event', snap)
  }
}

function languageDebug(): NodeDebugHost {
  const ws = root()
  if (!debugIntel || debugIntel.root !== ws) {
    void debugIntel?.stop()
    debugIntel = new NodeDebugHost(ws)
    debugIntel.on('paused', emitDebug)
    debugIntel.on('resumed', emitDebug)
    debugIntel.on('exit', emitDebug)
  }
  return debugIntel
}

function tsPayload(payload: unknown) {
  const req = takeTsRequest(payload)
  if (!req) throw new Error('TS request is outside the workspace jail')
  return req
}

function tsIsolated<T>(method: 'diagnostics' | 'symbols' | 'definitions' | 'references' | 'hover' | 'completions' | 'format', payload: unknown, fallback: T) {
  try {
    return languageIntel().callIsolated(method, tsPayload(payload)).catch(() => fallback)
  } catch {
    return Promise.resolve(fallback)
  }
}

async function commitTsEdits(edits: Array<{
  path: string
  text: string
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}>) {
  const intel = languageIntel()
  const grouped = new Map<string, typeof edits>()
  for (const edit of edits) {
    const path = intel.jail(edit.path, false)
    if (!path) continue
    const rows = grouped.get(path) || []
    rows.push({ ...edit, path })
    grouped.set(path, rows)
  }
  const pending = []
  for (const [path, rows] of grouped) {
    const before = intel.snapshotText(path)
    if (typeof before !== 'string') continue
    const after = applyTextEdits(before, rows)
    if (after === before) continue
    await writeFileSafe(workspace || root(), path, after)
    intel.update(path, after)
    pending.push(changes.record(path, before, after, 'inline'))
  }
  return pending
}

function secrets(): string {
  return secretsDir(root())
}

function seedVerifyFromHarness(r: string): void {
  try {
    const dest = assertInside(r, harnessRel())
    if (!existsSync(dest)) return
    const taken = takeHarness(JSON.parse(readFileSync(dest, 'utf8')))
    if (taken && Object.prototype.hasOwnProperty.call(taken, 'verifyOk')) lastVerifyOk = taken.verifyOk !== false
  } catch {
    /* keep default */
  }
}

async function persistOutcomeHarness(r: string): Promise<void> {
  try {
    const perms = loadPermissions(r)
    const minted = mintHarness(
      { stack: 'electron' },
      {
        approvalMode: perms.approvalMode,
        evolve: perms.approvalMode === 'auto-review',
        verifyOk: lastVerifyOk,
        localOk: llama?.status?.running !== false,
        hasSidecar: Boolean(coder)
      }
    )
    if (!minted.harness) return
    const dest = assertInside(r, minted.rel)
    await mkdir(join(r, '.homeai'), { recursive: true })
    await writeFile(dest, JSON.stringify(minted.harness, null, 2) + '\n', 'utf8')
  } catch {
    /* harness is optional */
  }
}

async function kernelMindHealth(opts?: { warm?: boolean; listCursor?: boolean }) {
  const r = workspace || root()
  const model = modelPath(r)
  let llamaState: 'on' | 'off' | 'missing' = !existsSync(model)
    ? 'missing'
    : llama?.status.running
      ? 'on'
      : 'off'
  if (opts?.warm && llamaState === 'off') {
    try {
      await ensureLlama()
      llamaState = llama?.status.running ? 'on' : 'off'
    } catch {
      llamaState = existsSync(model) ? 'off' : 'missing'
    }
  }
  const keys = {
    openai: Boolean(await getSecret(secrets(), 'openai')),
    openrouter: Boolean(await getSecret(secrets(), 'openrouter')),
    cursor: Boolean(await getSecret(secrets(), 'cursor'))
  }
  let cursorJobs: ReturnType<typeof cursorJobList> = []
  if (opts?.listCursor && keys.cursor) {
    try {
      const key = await getSecret(secrets(), 'cursor')
      if (key) cursorJobs = cursorJobList(await cursorListAgents(key))
    } catch {
      cursorJobs = []
    }
  }
  return takeKernelHealth({ llama: llamaState, ...keys, cursorJobs })
}

async function runCursorCloudJob(opts: {
  task: string
  key: string
  signal: AbortSignal
  send: (chunk: StreamChunk) => void
}): Promise<void> {
  const launched = await cursorLaunchAgent({ apiKey: opts.key, prompt: opts.task.slice(0, 8000) })
  const id = cursorAgentId(launched.id) || cursorAgentId((launched.raw as { id?: string } | undefined)?.id)
  if (!id) throw new Error('Cursor Cloud Agents did not start.')
  opts.send({ type: 'status', text: `Cursor · ${id}` })
  const done = new Set(['FINISHED', 'COMPLETED', 'ERROR', 'FAILED', 'CANCELLED', 'EXPIRED'])
  while (!opts.signal.aborted) {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 4000)
      const onAbort = () => {
        clearTimeout(t)
        resolve()
      }
      if (opts.signal.aborted) {
        clearTimeout(t)
        resolve()
        return
      }
      opts.signal.addEventListener('abort', onAbort, { once: true })
    })
    if (opts.signal.aborted) return
    const raw = await cursorGetAgent(opts.key, id)
    const sum =
      cursorJobSummary(raw) ||
      cursorJobSummary(raw && typeof raw === 'object' ? { id, ...(raw as object) } : { id })
    if (sum) opts.send({ type: 'status', text: `${sum.status} · ${sum.name}` })
    const st = String(sum?.status || '').toUpperCase()
    if (done.has(st)) {
      if (sum?.summary) opts.send({ type: 'text', text: sum.summary })
      return
    }
  }
}

async function ensureLlama(): Promise<void> {
  const r = root()
  if (!llama) llama = new LlamaServerManager(vendorDir(r))
  if (llama.status.running) {
    llama.touch()
    try {
      await ensureCoder()
    } catch {
      /* sidecar optional */
    }
    return
  }
  probeCache = await probeHardware(override)
  const name = coderModelName(r, probeCache.profile)
  if (name) probeCache = { ...probeCache, coderModelName: name, coderEnabled: false }
  const model = modelPath(r)
  if (!existsSync(model)) {
    throw new Error(`Model missing: ${model}. Place ${DEFAULT_MODEL_NAME} in the project root.`)
  }
  let args = llamaArgsFor(probeCache, model)
  try {
    await llama.start(args)
  } catch (err) {
    probeCache = fallbackOnOom(probeCache)
    args = llamaArgsFor(probeCache, model)
    try {
      await llama.start(args)
    } catch {
      probeCache = fallbackOnOom(probeCache)
      args = llamaArgsFor(probeCache, model)
      await llama.start(args)
    }
  }
  try {
    await ensureCoder()
  } catch {
    /* sidecar must not stop the 2B */
  }
}

async function ensureCoder(): Promise<void> {
  const r = root()
  if (!probeCache || probeCache.profile !== 'standard') {
    if (coder?.status.running) {
      try {
        await coder.stop()
      } catch {
        /* ignore */
      }
    }
    if (probeCache) probeCache = { ...probeCache, coderEnabled: false }
    return
  }
  const name = coderModelName(r, probeCache.profile)
  const model = name ? jailedCoderModelPath(r, name) : null
  if (!model || !existsSync(model)) {
    probeCache = { ...probeCache, coderEnabled: false, coderModelName: name }
    return
  }
  if (!coder) coder = createCoderManager(vendorDir(r))
  if (coder.status.running) {
    coder.touch()
    probeCache = { ...probeCache, coderEnabled: true, coderModelName: name }
    return
  }
  try {
    await coder.startSidecar(coderLlamaArgs(probeCache, model))
    probeCache = { ...probeCache, coderEnabled: Boolean(coder.status.running), coderModelName: name }
  } catch {
    probeCache = { ...probeCache, coderEnabled: false, coderModelName: name }
  }
}

async function nestedExploreDigest(
  job: { name: string; kind: string; query: string; path: string },
  opts: { root: string; ignore: ReturnType<typeof loadIgnore>; perms: PermissionsFile; signal: AbortSignal }
): Promise<ToolResult> {
  const flags = nestedExploreForgeFlags()
  const tools = toolsForSubagent('explore', builtinToolDefs())
  const port = ownedLlamaPort(coder?.status)
  if (port == null) {
    return { ok: false, name: 'explore', content: 'coder sidecar not running' }
  }
  coder?.touch()
  const bits: string[] = []
  try {
    for await (const chunk of runForge(
      {
        task: String(job.query || '').slice(0, 200),
        pinnedProvider: 'local',
        localPort: port,
        getKey: async () => null,
        tools,
        runTool: (call) =>
          runTool(opts.root, rag!, call, {
            ignore: opts.ignore,
            tsIntel: languageIntel(),
            extraRoots: opts.perms.fsExtraRoots ?? [],
            netAllowlist: opts.perms.netAllowlist,
            unrestricted: opts.perms.approvalMode === 'unrestricted',
            depth: 1
          }),
        skills: [],
        rules: [],
        ragHits: [],
        openFiles: [],
        workspaceRoot: opts.root,
        mode: 'agent',
        signal: opts.signal,
        maxTurns: flags.maxTurns,
        skipVerify: flags.skipVerify,
        skipRemember: flags.skipRemember
      },
      true
    )) {
      if (chunk.type === 'text' && chunk.text) bits.push(chunk.text)
      else if (chunk.type === 'status' && chunk.text) bits.push(chunk.text)
      else if (chunk.type === 'error' && chunk.error) bits.push(chunk.error)
    }
  } catch (err) {
    return { ok: false, name: 'explore', content: err instanceof Error ? err.message : String(err) }
  }
  return { ok: true, name: 'explore', content: bits.join('\n').slice(0, 4000) }
}

let kernelReady = false

async function reloadMcp(force = false): Promise<ReturnType<McpHub['list']>> {
  if (!force && kernelRunCount() > 0) return mcp.list()
  const r = workspace || root()
  try {
    mcp.dispose()
    mcpTools = await mcp.load(r)
  } catch {
    mcpTools = []
  }
  return mcp.list()
}

async function ensureKernelReady(): Promise<void> {
  const r = workspace || root()
  workspace = r
  await seedWorkspace(r)
  if (!probeCache) probeCache = await probeHardware(override)
  if (!rag) {
    await mkdir(join(r, 'data'), { recursive: true })
    rag = new RagStore(ragDbPath(r))
    try {
      await rag.ingestRoots(
        [
          join(r, 'RAG'),
          join(r, 'notes'),
          join(r, 'qa'),
          join(r, 'mods'),
          join(r, 'apps'),
          join(r, 'packages'),
          join(r, 'data', 'bug-memory')
        ],
        r
      )
    } catch (err) {
      console.error('rag ingestRoots', err)
    }
    rag.watch([join(r, 'RAG'), join(r, 'notes'), join(r, 'qa'), join(r, 'data', 'bug-memory')], r)
  }
  seedPermissions(r)
  const profile = loadProfile(r)
  ensureHomeThread(r)
  stickyGoal = profile.standingGoal || stickyGoal
  customModeSkill = profile.pinnedSkill || customModeSkill
  if (!kernelReady) await reloadMcp()
  kernelReady = true
  seedVerifyFromHarness(r)
  try {
    refreshWorkspaceGraph(r)
  } catch {
    /* analog graph is optional */
  }
  try {
    const names = readdirSync(join(r, 'RAG', 'discoveries'))
    const existing = listWritableSkills(r).map((s) => s.slug)
    const learned = bootCurate(names, existing)
    if (learned.body && learned.slug && !learned.slug.includes('..')) {
      const rel = `RAG/discoveries/boot-${learned.slug}.skill.md`
      const dest = assertInside(r, rel)
      if (!existsSync(dest)) await writeFile(dest, learned.body, 'utf8')
    }
  } catch {
    /* no discoveries yet */
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#141414',
    title: 'Hex AI Workbench',
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(mainDir, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    }
  })

  mainWindow.setTitle('Hex AI Workbench')

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(mainDir, '../renderer/index.html'))
  }

  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    if (level >= 2) console.error(`[renderer ${level}] ${message} (${sourceId}:${line})`)
  })
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('did-fail-load', code, desc, url)
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('render-process-gone', details)
  })
  const shot = process.env.HOMEAI_SHOT
  if (shot) {
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        void mainWindow?.capturePage().then((img) => writeFile(shot, img.toPNG()))
      }, 4500)
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function sendChunk(id: string, chunk: StreamChunk): void {
  mainWindow?.webContents.send('homeai:agent:chunk', id, chunk)
  telegramBridge?.onChunk(id, chunk)
  pushMiniChunk(id, chunk)
}

designEvents.on('changed', (p: { slug: string; revision: string }) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('homeai:design:changed', p)
  }
})

function livePorts() {
  const rows = []
  const llamaPort = ownedLlamaPort(llama?.status)
  if (llamaPort != null) rows.push({ name: 'llama', port: llamaPort })
  const coderPort = ownedLlamaPort(coder?.status)
  if (coderPort != null) rows.push({ name: 'coder', port: coderPort })
  if (miniApp) rows.push({ name: 'miniapp', port: MINIAPP_PORT })
  const inspect = debugIntel?.snapshot().port
  if (typeof inspect === 'number' && inspect > 0) rows.push({ name: 'inspect', port: inspect })
  return takePortList(rows)
}

function registerIpc(): void {
  ipcMain.handle('homeai:boot', async () => {
    await ensureKernelReady()
    const r = workspace || root()
    const knowledge = loadAllKnowledge(r)
    const profile = loadProfile(r)
    const lm = await detectLmStudio()
    return {
      root: r,
      workspace,
      model: existsSync(modelPath(r)) ? modelPath(r) : null,
      probe: probeCache,
      llm: llama?.status ?? { running: false, backend: 'none' },
      providers: await providerStatus(secrets()),
      mods: knowledge.mods,
      ragStats: rag.stats(),
      gitBranch: gitBranch(workspace),
      lmStudio: lm,
      warning: probeCache.warning,
      permissions: loadPermissions(workspace || r),
      mcpServers: mcpTools.length,
      goal: stickyGoal,
      profile,
      threads: listThreads(r),
      activeThreadId: loadActiveThreadId(r),
      telegram: telegramBridge
        ? telegramBridge.status()
        : telegramStatusView(loadTelegramState(r), Boolean(await getSecret(secrets(), 'telegram')), false),
      packaged: loadRoots().packaged,
      onboard: takeOnboardNeeded(loadRoots(), loadRoots().onboardDone),
      hexProfile: profileDir(),
      modelMissing: !existsSync(modelPath(r))
    }
  })

  ipcMain.handle('homeai:win:min', () => mainWindow?.minimize())
  ipcMain.handle('homeai:win:max', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.handle('homeai:win:close', () => mainWindow?.close())

  ipcMain.handle('homeai:onboard:done', () => {
    saveRootsPatch({ onboardDone: true, workspace: workspace || defaultWorkspace() })
    return { ok: true }
  })
  ipcMain.handle('homeai:model:download', async () => {
    const roots = loadRoots()
    const plan = modelDownloadPlan(roots.modelsDir)
    const partial = plan ? takePartialDest(plan.dest) : ''
    if (!plan || !partial) throw new Error('bad model dest')
    await mkdir(roots.modelsDir, { recursive: true, mode: 0o700 })
    let free = 0
    try {
      const s = await statfs(roots.modelsDir)
      free = Number(s.bavail) * Number(s.bsize)
    } catch {
      free = 0
    }
    const gate = takeHardwareGate({ totalMem: totalmem(), freeDisk: free })
    if (!gate.diskOk) return { ok: false, hint: gate.hint }

    const finish = async (path: string) => {
      const st = await stat(path)
      const gotSha = await sha256File(path)
      const ready = takeGgufReady({
        dest: plan.dest,
        bytes: st.size,
        minBytes: plan.minBytes,
        gotSha,
        wantSha: plan.sha256
      })
      if (!ready.ok) {
        try {
          await unlink(path)
        } catch {
          /* torn blob */
        }
        return { ok: false as const, hint: ready.hint || 'download failed' }
      }
      return { ok: true as const }
    }

    if (existsSync(plan.dest)) {
      const skip = await finish(plan.dest)
      if (skip.ok) return { ok: true, name: 'Qwen3.5-2B-Q8_0.gguf' }
    }

    let existing = 0
    try {
      if (existsSync(partial)) existing = (await stat(partial)).size
    } catch {
      existing = 0
    }
    const headers: Record<string, string> = {}
    const range = takeRangeHeader(existing)
    if (range) headers.Range = range
    const res = await fetch(plan.url, { headers })
    if (!res.ok || !res.body) throw new Error('download failed')
    const append = res.status === 206 && existing > 0
    await pipeline(
      Readable.fromWeb(res.body as never),
      createWriteStream(partial, { flags: append ? 'a' : 'w', mode: 0o600 })
    )
    const ready = await finish(partial)
    if (!ready.ok) return ready
    await rename(partial, plan.dest)
    return { ok: true, name: 'Qwen3.5-2B-Q8_0.gguf' }
  })
  ipcMain.handle('homeai:diagnostics', async () => {
    const pulse = await kernelMindHealth()
    return publicDiagnostics({
      version: app.getVersion(),
      llama: pulse.llama,
      packaged: loadRoots().packaged,
      sandbox: true,
      model: existsSync(modelPath()),
      crashOptIn: loadRoots().crashOptIn,
      ports: livePorts()
    })
  })
  ipcMain.handle('homeai:crash:set', (_e, raw) => {
    const next = takeCrashOptIn(raw)
    saveRootsPatch({ crashOptIn: next })
    return { crashOptIn: next }
  })
  ipcMain.handle('homeai:update:check', async () => {
    const feed = takeUpdateFeed()
    if (!app.isPackaged) return { feed, update: false }
    try {
      const mod = await import('electron-updater')
      const autoUpdater = mod.autoUpdater
      const provider = takeUpdateProvider()
      if (provider) autoUpdater.setFeedURL(provider)
      autoUpdater.autoDownload = false
      autoUpdater.autoInstallOnAppQuit = false
      const r = await autoUpdater.checkForUpdates()
      const ver = String(r?.updateInfo?.version || '').replace(/[<>]/g, '').slice(0, 32)
      return { feed, update: Boolean(ver), version: ver }
    } catch {
      return { feed, update: false }
    }
  })
  ipcMain.handle('homeai:hardware:gate', async () => {
    let free = 0
    try {
      const s = await statfs(loadRoots().profile || process.cwd())
      free = Number(s.bavail) * Number(s.bsize)
    } catch {
      free = 0
    }
    return takeHardwareGate({ totalMem: totalmem(), freeDisk: free })
  })

  ipcMain.handle('homeai:governor:probe', async (_e, next?: GovernorOverride) => {
    if (next) override = { ...override, ...next }
    probeCache = await probeHardware(override)
    const name = coderModelName(root(), probeCache.profile)
    probeCache = {
      ...probeCache,
      coderModelName: name,
      coderEnabled: Boolean(name && coder?.status.running)
    }
    return probeCache
  })

  ipcMain.handle('homeai:llm:start', async () => {
    await ensureLlama()
    return llama?.status
  })

  ipcMain.handle('homeai:llm:stop', async () => {
    try {
      await coder?.stop()
    } catch {
      /* sidecar optional */
    }
    await llama?.stop()
    if (probeCache) probeCache = { ...probeCache, coderEnabled: false }
    return llama?.status ?? { running: false, backend: 'none' }
  })

  ipcMain.handle('homeai:llm:status', () => llama?.status ?? { running: false, backend: 'none' })

  ipcMain.handle('homeai:fs:list', async (_e, path: string) => listDir(workspace, path || workspace))
  ipcMain.handle('homeai:fs:read', async (_e, path: string) => readFileSafe(workspace, path))
  ipcMain.handle('homeai:fs:write', async (_e, path: string, content: string) => {
    await writeFileSafe(workspace, path, content)
    return true
  })
  ipcMain.handle('homeai:ts:sync', (_e, payload: { path: string; text: string; version?: number }) => {
    const req = takeTsRequest(payload)
    if (!req || typeof req.text !== 'string') return false
    return languageIntel().update(req.path, req.text, req.version)
  })
  ipcMain.handle('homeai:ts:close', (_e, path: string) => {
    const req = takeTsRequest({ path })
    if (req) languageIntel().close(req.path)
    return true
  })
  ipcMain.handle('homeai:ts:diagnostics', (_e, payload) =>
    tsIsolated('diagnostics', payload, [])
  )
  ipcMain.handle('homeai:ts:symbols', (_e, payload) =>
    tsIsolated('symbols', payload, [])
  )
  ipcMain.handle('homeai:ts:workspaceSymbols', (_e, query: string) =>
    languageIntel().workspaceSymbolsIsolated(takeTsQuery(query)).catch(() => [])
  )
  ipcMain.handle('homeai:ts:cancel', () => {
    languageIntel().cancel()
    return true
  })
  ipcMain.handle('homeai:ts:definition', (_e, payload) =>
    tsIsolated('definitions', payload, [])
  )
  ipcMain.handle('homeai:ts:references', (_e, payload) =>
    tsIsolated('references', payload, [])
  )
  ipcMain.handle('homeai:ts:hover', (_e, payload) =>
    tsIsolated('hover', payload, null)
  )
  ipcMain.handle('homeai:ts:completions', (_e, payload) =>
    tsIsolated('completions', payload, [])
  )
  ipcMain.handle('homeai:ts:format', (_e, payload) =>
    tsIsolated('format', payload, [])
  )
  ipcMain.handle('homeai:ts:rename', async (_e, payload) => {
    try {
      const req = tsPayload(payload)
      const edits = languageIntel().rename({ ...req, newName: req.newName || '' })
      const pending = await commitTsEdits(edits)
      return { edits, pending }
    } catch (err) {
      throw new Error(publicTsError(err))
    }
  })
  ipcMain.handle('homeai:debug:start', async (_e, payload) => {
    const req = takeDebugLaunch(payload)
    if (!req) throw new Error('Debug target is outside the workspace jail')
    try {
      return await languageDebug().start(req)
    } catch (err) {
      throw new Error(publicDebugError(err))
    }
  })
  ipcMain.handle('homeai:debug:breakpoint', async (_e, payload) => {
    const req = takeDebugBreakpoint(payload)
    if (!req) throw new Error('Debug breakpoint is outside the workspace jail')
    try {
      return await languageDebug().breakpoint(req)
    } catch (err) {
      throw new Error(publicDebugError(err))
    }
  })
  ipcMain.handle('homeai:debug:stack', async () => {
    try {
      return await languageDebug().stack()
    } catch (err) {
      throw new Error(publicDebugError(err))
    }
  })
  ipcMain.handle('homeai:debug:evaluate', async (_e, payload) => {
    if (!takeDebugEval(payload)) throw new Error('Debug evaluate rejected')
    try {
      return await languageDebug().evaluate(payload)
    } catch (err) {
      throw new Error(publicDebugError(err))
    }
  })
  ipcMain.handle('homeai:debug:continue', async (_e, payload) => {
    if (!takeDebugContinue(payload)) throw new Error('Debug continue rejected')
    try {
      return await languageDebug().continue(payload)
    } catch (err) {
      throw new Error(publicDebugError(err))
    }
  })
  ipcMain.handle('homeai:debug:stop', async () => {
    try {
      return await languageDebug().stop()
    } catch (err) {
      throw new Error(publicDebugError(err))
    }
  })
  ipcMain.handle('homeai:debug:state', () => languageDebug().snapshot())
  ipcMain.handle('homeai:fs:mkdir', async (_e, path: string) => mkdirSafe(workspace, path))
  ipcMain.handle('homeai:fs:rename', async (_e, from: string, to: string) => renameSafe(workspace, from, to))
  ipcMain.handle('homeai:fs:remove', async (_e, path: string) => removeSafe(workspace, path))
  ipcMain.handle('homeai:kernel:pulse', async () => {
    const r = workspace || root()
    const profile = loadProfile(r)
    const h = await kernelMindHealth()
    const pulse = healthPulse(h)
    const token = await getSecret(secrets(), 'telegram')
    const st = telegramBridge ? telegramBridge.status() : telegramStatusView(loadTelegramState(r), Boolean(token), false)
    const sess = telegramBridge ? telegramBridge.session() : takeTelegramSession({ ...st, live: [] })
    return takeChromePulse({
      llama: pulse.llama,
      keys: pulse.keys,
      cursor: pulse.cursor,
      mode: profile.defaultMode,
      mind: profile.defaultProvider,
      telegram: Boolean(st.online || st.configured),
      glass: Boolean(miniApp),
      mcp: mcp.list().length,
      pending: changes.list().length,
      live: Array.isArray(sess.live) ? sess.live.length : 0,
      gpu: probeCache?.gpuName,
      vramMb: probeCache?.vramMb,
      ngl: probeCache?.nGpuLayers,
      ctx: probeCache?.contextSize,
      llamaErr: llama?.status.error
    })
  })
  ipcMain.handle('homeai:workbench:ports', () => livePorts())
  ipcMain.handle('homeai:workbench:layout:get', () => loadLayout(workspace || root()))
  ipcMain.handle('homeai:workbench:layout:set', (_e, raw) => saveLayout(workspace || root(), raw))
  ipcMain.handle('homeai:inbox:save', (_e, payload: { name: string; base64: string }) => {
    const saved = saveInboxSafe(workspace || root(), payload?.name, payload?.base64)
    if (!saved) throw new Error('inbox rejected')
    return saved.rel
  })
  ipcMain.handle('homeai:fs:openFolder', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (res.canceled || !res.filePaths[0]) return workspace
    const picked = takeOpenFolder(res.filePaths[0])
    if (!picked) return workspace
    tsIntel?.dispose()
    tsIntel = null
    workspace = picked
    saveRootsPatch({ workspace: picked })
    await seedWorkspace(workspace)
    await seedLibraryIfMissing(workspace)
    return workspace
  })

  ipcMain.handle('homeai:rag:search', async (_e, query: string) => rag?.search(query, 12) ?? [])
  ipcMain.handle('homeai:rag:stats', () => rag?.stats() ?? { documents: 0 })
  ipcMain.handle('homeai:rag:map', () => rag?.getMap() ?? { nodes: [], edges: [] })
  ipcMain.handle('homeai:rag:pin', (_e, payload: { nodeId: string; title: string }) => {
    const id = `pin_${Date.now()}`
    rag?.addMapNode({
      id,
      title: payload.title.slice(0, 80),
      kind: 'discovery',
      payload: payload.nodeId,
      createdAt: Date.now()
    })
    rag?.addMapEdge({ src: id, dst: payload.nodeId, rel: 'pinned' })
    return rag?.getMap() ?? { nodes: [], edges: [] }
  })
  ipcMain.handle('homeai:rag:qa:list', () => rag?.listQa() ?? [])
  ipcMain.handle('homeai:rag:qa:add', async (_e, rec) => {
    rag?.addQa(rec)
    return true
  })

  ipcMain.handle('homeai:notes:list', async () => {
    const dir = join(root(), 'notes')
    const names = await readdir(dir).catch(() => [])
    const out = []
    for (const name of names) {
      if (!name.endsWith('.md')) continue
      const p = join(dir, name)
      const st = await stat(p)
      const text = await readFile(p, 'utf8')
      out.push({
        path: p,
        title: name.replace(/\.md$/, ''),
        preview: text.slice(0, 160).replace(/\n/g, ' '),
        mtime: st.mtimeMs
      })
    }
    return out.sort((a, b) => b.mtime - a.mtime)
  })

  ipcMain.handle('homeai:board:get', () => loadBoard(root()))
  ipcMain.handle('homeai:board:save', (_e, board) => {
    saveBoard(root(), board)
    return true
  })
  ipcMain.handle('homeai:board:upsert', (_e, args) => upsertTask(root(), args))
  ipcMain.handle('homeai:design:get', (_e, slug?: string) => loadDesign(workspace || root(), slug))
  ipcMain.handle('homeai:design:patch', (_e, envelope, slug?: string) =>
    patchDesign(workspace || root(), publicDesignEnvelope(envelope), slug)
  )
  ipcMain.handle('homeai:design:create', (_e, args) => createDesign(workspace || root(), args))
  ipcMain.handle('homeai:design:list', () => listDesigns(workspace || root()))
  ipcMain.handle('homeai:design:ingestTokens', (_e, path?: string, slug?: string) =>
    ingestDesignTokens(workspace || root(), path, slug)
  )
  ipcMain.handle('homeai:think:list', () => listThinkDocs(workspace || root()))

  ipcMain.handle('homeai:secrets:status', () => providerStatus(secrets()))
  ipcMain.handle('homeai:secrets:set', async (_e, name: SecretName, value: string) => {
    await setSecret(secrets(), name, value)
    return providerStatus(secrets())
  })
  ipcMain.handle('homeai:secrets:delete', async (_e, name: SecretName) => {
    await deleteSecret(secrets(), name)
    return providerStatus(secrets())
  })

  ipcMain.handle('homeai:mods:list', () => loadAllKnowledge(workspace || root()))
  ipcMain.handle('homeai:permissions:get', () => loadPermissions(workspace || root()))
  ipcMain.handle('homeai:permissions:set', async (_e, file: PermissionsFile, confirmUnrestricted?: boolean) => {
    const next = savePermissions(workspace || root(), {
      ...file,
      approvalMode: takeApprovalSave(file?.approvalMode, confirmUnrestricted === true)
    })
    await reloadMcp()
    return next
  })
  ipcMain.handle('homeai:mcp:reload', async () => reloadMcp())
  ipcMain.handle('homeai:mcp:enableStarter', async (_e, raw) => {
    const r = workspace || root()
    const cfg = enableMcpStarter(r, takeMcpEnableOpts(raw))
    await reloadMcp()
    return { servers: Object.keys(cfg.mcpServers) }
  })
  ipcMain.handle('homeai:mcp:trustStarter', async () => {
    const r = workspace || root()
    const perms = loadPermissions(r)
    const next = savePermissions(r, {
      ...perms,
      mcpAllowlist: mergeStarterAllowlist(perms.mcpAllowlist, MCP_STARTER_IDS)
    })
    await persistOutcomeHarness(r)
    return next
  })
  ipcMain.handle('homeai:git:worktree:list', () => gitWorktreeList(workspace || root()))
  ipcMain.handle('homeai:git:worktree:add', (_e, name: string) => gitWorktreeAdd(workspace || root(), String(name || 'wt')))
  ipcMain.handle('homeai:git:status', () => gitSnapshot(workspace || root()))
  ipcMain.handle('homeai:git:diff', (_e, staged?: boolean) => gitDiff(workspace || root(), Boolean(staged)))
  ipcMain.handle('homeai:git:lines', async (_e, path: string) => {
    try {
      return await gitLineChanges(workspace || root(), String(path || ''))
    } catch {
      return { added: [], removed: [] }
    }
  })
  ipcMain.handle('homeai:git:log', () => gitLog(workspace || root()))
  ipcMain.handle('homeai:git:add', async (_e, paths: string[]) => gitAdd(workspace || root(), paths))
  ipcMain.handle('homeai:git:unstage', async (_e, paths: string[]) => gitUnstage(workspace || root(), paths))
  ipcMain.handle('homeai:git:commit', async (_e, message: string) => gitCommit(workspace || root(), String(message || '')))
  ipcMain.handle('homeai:git:pull', () => gitPullFfOnly(workspace || root()))
  ipcMain.handle('homeai:git:push', () => gitPushUpstream(workspace || root()))
  ipcMain.handle('homeai:search:grep', (_e, query: string) => {
    const r = workspace || root()
    return workspaceGrep(r, String(query || ''), loadIgnore(r))
  })
  ipcMain.handle('homeai:composer:checkpoints', () => changes.checkpoints())
  ipcMain.handle('homeai:composer:checkpointGet', (_e, id: string) => changes.get(id) ?? null)
  ipcMain.handle('homeai:composer:restore', (_e, id: string) => changes.restore(id))
  ipcMain.handle('homeai:mcp:list', () => mcp.list())
  ipcMain.handle('homeai:agentReview:quick', async (_e, depth?: 'quick' | 'deep') => {
    const r = workspace || root()
    let diff = ''
    try {
      diff = await gitDiff(r)
    } catch {
      diff = ''
    }
    if (!diff.trim()) return { text: 'Working tree clean — nothing to review.', diff: '' }
    let extra = ''
    if (depth === 'deep' && rag) {
      const files = [...diff.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm)].map((m) => m[2])
      extra = files
        .slice(0, 8)
        .flatMap((f) => rag.search(f, 2).map((h) => `${h.path}\n${h.snippet}`))
        .slice(0, 10)
        .join('\n---\n')
    }
    try {
      if (!llama?.status.running) await ensureLlama()
      const text = await completeOnce({
        provider: 'local',
        localPort: llama?.status.port ?? DEFAULT_LLAMA_PORT,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              depth === 'deep'
                ? 'Deep review of this git diff plus related RAG snippets. For each file: risk, likely bug, tests to run. Be concrete. No preamble.'
                : 'Review this git diff as Quick hunks. For each file: risk low/med/high and one line (bug, OK, or question). No preamble.'
          },
          { role: 'user', content: `${diff.slice(0, 10_000)}${extra ? `\n\nRelated RAG:\n${extra.slice(0, 6000)}` : ''}` }
        ] as ChatMessage[]
      })
      return { text, diff: diff.slice(0, 4000) }
    } catch (err) {
      return { text: err instanceof Error ? err.message : String(err), diff: diff.slice(0, 2000) }
    }
  })
  ipcMain.handle('homeai:infill', async (_e, payload: { prefix: string; suffix: string }) => {
    if (!llama?.status.running) await ensureLlama()
    else {
      try {
        await ensureCoder()
      } catch {
        /* sidecar optional */
      }
    }
    const localPort = pickInfillPort(coder?.status, llama?.status, DEFAULT_LLAMA_PORT)
    if (coder?.status.running && localPort === coder.status.port) coder.touch()
    else llama?.touch()
    return infillOnce({
      localPort,
      prefix: payload.prefix,
      suffix: payload.suffix
    })
  })
  ipcMain.on('homeai:agent:steer', (_e, id: string, text: string) => {
    const list = steers.get(id) ?? []
    list.push(text)
    steers.set(id, list)
  })
  ipcMain.on('homeai:agent:answer', (_e, id: string, text: string) => {
    questions.get(id)?.(text)
    questions.delete(id)
  })
  ipcMain.on('homeai:agent:approve', (_e, id: string, ok: boolean) => {
    approvals.get(id)?.(ok)
    approvals.delete(id)
  })
  ipcMain.handle('homeai:goal:set', (_e, g: string) => {
    stickyGoal = String(g || '')
    saveProfile(workspace || root(), { standingGoal: stickyGoal })
    return stickyGoal
  })
  ipcMain.handle('homeai:modeSkill:set', (_e, name: string) => {
    customModeSkill = String(name || '')
    saveProfile(workspace || root(), { pinnedSkill: customModeSkill })
    return customModeSkill
  })
  ipcMain.handle('homeai:profile:get', () => loadProfile(workspace || root()))
  ipcMain.handle('homeai:profile:set', (_e, patch) => {
    const next = saveProfile(workspace || root(), patch)
    stickyGoal = next.standingGoal
    customModeSkill = next.pinnedSkill
    return next
  })
  ipcMain.handle('homeai:thread:list', () => listThreads(workspace || root()))
  ipcMain.handle('homeai:thread:get', (_e, id: string) => {
    const safe = chatThreadId(id)
    if (!safe) throw new Error('bad thread id')
    return getThread(workspace || root(), safe)
  })
  ipcMain.handle('homeai:thread:create', (_e, title: string) => {
    const t = createThread(workspace || root(), String(title || 'New agent'), 'desktop')
    saveActiveThreadId(workspace || root(), t.id)
    return t
  })
  ipcMain.handle('homeai:thread:select', (_e, id: string) => saveActiveThreadId(workspace || root(), id))
  ipcMain.handle('homeai:thread:rename', (_e, id: string, title: string) => renameThread(workspace || root(), id, title))
  ipcMain.handle('homeai:thread:archive', (_e, id: string) => archiveThread(workspace || root(), id))
  ipcMain.handle('homeai:thread:delete', (_e, id: string) => deleteThread(workspace || root(), id))
  ipcMain.handle('homeai:knowledge:list', () => ({
    skills: listWritableSkills(workspace || root()),
    rules: listWritableRules(workspace || root())
  }))
  ipcMain.handle('homeai:knowledge:writeSkill', (_e, args) => writeSkill(workspace || root(), args))
  ipcMain.handle('homeai:knowledge:writeRule', (_e, args) => writeRule(workspace || root(), args))
  ipcMain.handle('homeai:knowledge:deleteSkill', (_e, slug: string) => deleteSkill(workspace || root(), slug))
  ipcMain.handle('homeai:knowledge:deleteRule', (_e, slug: string) => deleteRule(workspace || root(), slug))
  ipcMain.handle('homeai:telegram:status', async () => {
    const token = await getSecret(secrets(), 'telegram')
    return telegramBridge
      ? telegramBridge.status()
      : telegramStatusView(loadTelegramState(workspace || root()), Boolean(token), false)
  })
  ipcMain.handle('homeai:telegram:pairStart', () => {
    if (!telegramBridge) throw new Error('telegram offline')
    return telegramBridge.pairStart()
  })
  ipcMain.handle('homeai:telegram:unpair', (_e, userId: number) => {
    const id = telegramUserId(userId)
    if (id == null) throw new Error('bad user')
    telegramBridge?.unpairUser(id)
    return telegramBridge?.status()
  })
  ipcMain.handle('homeai:telegram:session', async () => {
    const token = await getSecret(secrets(), 'telegram')
    const r = workspace || root()
    const profile = loadProfile(r)
    const h = await kernelMindHealth()
    const pulse = healthPulse(h)
    const base = telegramBridge
      ? telegramBridge.session()
      : takeTelegramSession({
          ...telegramStatusView(loadTelegramState(r), Boolean(token), false),
          mode: profile.defaultMode,
          mind: profile.defaultProvider,
          threads: listThreads(r)
            .filter((t) => t.source === 'telegram' || t.source === 'both' || t.telegramChatId)
            .map((t) => ({ id: t.id, title: t.title }))
        })
    return takeTelegramSession({
      ...base,
      llama: pulse.llama,
      keys: pulse.keys,
      cursor: pulse.cursor,
      glass: Boolean(miniApp) || base.glass
    })
  })
  ipcMain.handle('homeai:telegram:restart', () => {
    if (!telegramBridge) throw new Error('telegram offline')
    telegramBridge.stop()
    telegramBridge.start()
    return telegramBridge.status()
  })
  ipcMain.handle('homeai:telegram:setToken', async (_e, value: string) => {
    const v = String(value || '').trim()
    if (v) await setSecret(secrets(), 'telegram', v)
    else await deleteSecret(secrets(), 'telegram')
    telegramBridge?.stop()
    telegramBridge?.start()
    return telegramBridge?.status()
  })
  ipcMain.handle('homeai:miniapp:status', () => {
    const r = workspace || root()
    return {
      url: loopbackMiniAppUrl(MINIAPP_PORT),
      publicUrl: takeMiniAppUrl(loadProfile(r).miniAppUrl),
      listening: Boolean(miniApp)
    }
  })
  ipcMain.handle('homeai:miniapp:open', async () => {
    const url = loopbackMiniAppUrl(MINIAPP_PORT)
    if (!takeMiniAppUrl(url)) throw new Error('bad glass url')
    await shell.openExternal(url)
    return { url }
  })
  ipcMain.handle('homeai:miniapp:push', async () => {
    if (!telegramBridge) throw new Error('telegram offline')
    return telegramBridge.pushMiniApp()
  })

  ipcMain.handle('homeai:cursor:launch', async (_e, prompt: string, repo?: string) => {
    const key = await getSecret(secrets(), 'cursor')
    if (!key) throw new Error('No Cursor API key')
    if (typeof prompt !== 'string' || prompt.length > 8000) throw new Error('bad prompt')
    const r = await cursorLaunchAgent({
      apiKey: key,
      prompt,
      repositoryUrl: typeof repo === 'string' ? repo.slice(0, 400) : undefined
    })
    return (
      cursorJobSummary({ id: r.id, status: 'CREATING', name: prompt }) ?? {
        id: cursorAgentId(r.id) ?? 'pending',
        status: 'CREATING',
        name: 'cloud',
        summary: ''
      }
    )
  })
  ipcMain.handle('homeai:cursor:get', async (_e, id: string) => {
    const key = await getSecret(secrets(), 'cursor')
    if (!key) throw new Error('No Cursor API key')
    const safe = cursorAgentId(id)
    if (!safe) throw new Error('bad agent id')
    const raw = await cursorGetAgent(key, safe)
    const job = cursorJobSummary(raw)
    if (!job) throw new Error('bad agent payload')
    return job
  })
  ipcMain.handle('homeai:cursor:list', async () => {
    const key = await getSecret(secrets(), 'cursor')
    if (!key) throw new Error('No Cursor API key')
    return { jobs: cursorJobList(await cursorListAgents(key)) }
  })

  ipcMain.handle('homeai:browser:show', (_e, bounds) => {
    if (mainWindow) showBrowser(mainWindow, bounds)
  })
  ipcMain.handle('homeai:browser:hide', () => {
    if (mainWindow) hideBrowser(mainWindow)
  })
  ipcMain.handle('homeai:browser:navigate', async (_e, url: string) => browserNavigate(url))
  ipcMain.handle('homeai:browser:extract', async () => browserExtract(root()))
  ipcMain.handle('homeai:browser:console', async () => browserConsole(root(), false))

  ipcMain.handle('homeai:shell:open', (_e, path: string) => shell.openPath(assertInside(workspace || root(), path)))

  ipcMain.handle('homeai:fs:quickOpen', (_e, query: string) => quickOpen(workspace || root(), query || ''))

  ipcMain.handle('homeai:composer:pending', () => changes.list())
  ipcMain.handle('homeai:composer:accept', (_e, path: string) => {
    changes.accept(path)
    return changes.list()
  })
  ipcMain.handle('homeai:composer:acceptAll', () => {
    changes.acceptAll()
    return []
  })
  ipcMain.handle('homeai:composer:reject', (_e, path: string) => {
    changes.reject(path)
    return changes.list()
  })
  ipcMain.handle('homeai:composer:undoAll', () => {
    const paths = changes.undoAll()
    return paths
  })

  ipcMain.handle(
    'homeai:inline',
    async (
      _e,
      payload: { path: string; selected: string; instruction: string; provider: ProviderId }
    ) => {
      if (payload.provider === 'local') await ensureLlama()
      const full = readFileSafe(workspace, payload.path)
      const provider = payload.provider === 'cursor' ? 'local' : payload.provider
      const apiKey =
        provider === 'local'
          ? null
          : await getSecret(secrets(), provider === 'openai' ? 'openai' : 'openrouter')
      const replacement = await completeOnce({
        provider,
        apiKey,
        localPort: llama?.status.port ?? DEFAULT_LLAMA_PORT,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content:
              'You are inline Ctrl+K in an IDE. Return ONLY the replacement for the selected code. No markdown fences, no explanation.'
          },
          {
            role: 'user',
            content: `File: ${payload.path}\nInstruction: ${payload.instruction}\n\nSelected:\n${payload.selected || full.slice(0, 6000)}`
          }
        ]
      })
      const after = payload.selected ? applySelection(full, payload.selected, replacement) : replacement
      const abs = assertInside(workspace, payload.path)
      await writeFileSafe(workspace, payload.path, after)
      const change = changes.record(abs, full, after, 'inline')
      return { replacement, change }
    }
  )

  ipcMain.on('homeai:agent:stop', (_e, id: string) => {
    stopKernelRun(id)
    aborts.get(id)?.abort()
    approvals.get(id)?.(false)
    questions.get(id)?.('(stopped)')
  })

  ipcMain.on(
    'homeai:agent:run',
    (
      _event,
      payload: {
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
      }
    ) => {
    void startKernelJob(payload)
  })

  registerPty(() => workspace || root())
  fleetHost = createFleetHost({
    root: () => workspace || root(),
    secretsDir: () => secrets(),
    draftText: async (prompt) =>
      completeOnce({
        provider: 'local',
        localPort: ownedLlamaPort(llama?.status) ?? DEFAULT_LLAMA_PORT,
        messages: [{ role: 'user', content: String(prompt || '').slice(0, 800) }]
      })
  })
  fleetHost.register()
}

async function startKernelJob(payload: {
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
  surface?: 'telegram' | 'desktop' | 'miniapp'
  needsTools?: boolean
}): Promise<void> {
      await ensureKernelReady()
      const ac = new AbortController()
      aborts.set(payload.id, ac)
      const surface = kernelSurface(payload.surface)
      registerKernelRun(payload.id, surface, () => ac.abort())
      steers.set(payload.id, [])
      const r0 = workspace || root()
      const threadId = gatewayContinuity(
        surface,
        chatThreadId(payload.threadId) || loadActiveThreadId(r0)
      ).threadId
      let forgeOutcomeFailed = false
      try {
        const profile = loadProfile(r0)
        let mode: AgentMode = payload.mode ?? profile.defaultMode ?? 'agent'
        const r = workspace || root()
        const knowledge = loadAllKnowledge(r)
        const about = aboutMeRule(profile)
        if (about) knowledge.rules = [about, ...knowledge.rules]
        const ignore = loadIgnore(r)
        const perms = loadPermissions(r)
        let task = payload.task
        if (payload.surface === 'telegram' || surface === 'miniapp') sendChunk(payload.id, { type: 'status', text: `surface=${surface}` })
        else telegramBridge?.notifyDesktopRun(task.slice(0, 80), payload.id, threadId)
        if (getThread(r, threadId) || threadId) {
          try {
            appendTurn(r, threadId, { role: 'user', text: task, runId: payload.id })
          } catch {
            ensureHomeThread(r)
          }
        }
        const slash = parseSlash(task)
        let custom = payload.customSkill || customModeSkill ? pickSkill(knowledge.skills, payload.customSkill || customModeSkill) : undefined
        if (slash.skill === 'goal') {
          stickyGoal = slash.rest
          sendChunk(payload.id, { type: 'status', text: `goal set · ${stickyGoal}` })
          sendChunk(payload.id, { type: 'done' })
          return
        }
        if (slash.skill) {
          if (slash.skill !== 'pack' && slash.skill !== 'packs') {
            custom = pickSkill(knowledge.skills, slash.skill) ?? custom
            if (slash.customMode) customModeSkill = slash.skill
            task = slash.rest
          }
        }
        if (payload.goal) stickyGoal = payload.goal
        if (mode === 'think') {
          custom = pickSkill(knowledge.skills, 'think-handoff') ?? pickSkill(knowledge.skills, 'gather-context') ?? custom
        }
        let implementPath = ''
        if (payload.thinkPath) {
          const loaded = loadThinkDoc(r, payload.thinkPath)
          if (!loaded.parsed.ok) throw new Error(`think doc invalid: ${loaded.parsed.errors.join(', ')}`)
          if (loaded.parsed.status !== 'ready' && loaded.parsed.status !== 'implementing') {
            throw new Error(`think status ${loaded.parsed.status || 'empty'} — plan_write with status: ready first`)
          }
          implementPath = loaded.path
          let md = loaded.markdown
          if (loaded.parsed.status === 'ready') {
            const bumped = bumpThinkStatus(md, 'implementing')
            if (bumped.changed) {
              await writeFileSafe(r, loaded.path, bumped.markdown)
              md = bumped.markdown
            }
          }
          task = `IMPLEMENT only ${loaded.path}. Surgical str_replace. Hunt+prevent. Do not expand Out of scope.\n\n${md.slice(0, 16_000)}`
        }
        const keys = {
          openai: Boolean(await getSecret(secrets(), 'openai')),
          openrouter: Boolean(await getSecret(secrets(), 'openrouter')),
          cursor: Boolean(await getSecret(secrets(), 'cursor'))
        }
        const mind = takeMind(payload.provider) || takeMind(profile.defaultProvider) || 'local'
        let forge = pickForgeProvider({
          mind,
          mode,
          thinkPath: Boolean(implementPath),
          keys,
          localOk: llama?.status?.running !== false,
          verifyOk: lastVerifyOk,
          hasSidecar: Boolean(coder)
        })
        const needsDesign = taskNeedsDesignTools(task, payload.needsTools === true)
        if (needsDesign) {
          if (!isFullToolMode(mode)) {
            mode = 'agent'
            sendChunk(payload.id, { type: 'status', text: 'DesignIR needs agent tools' })
          }
          const reminted = forgeForDesign(forge, keys)
          if (forge === 'cursor') {
            sendChunk(payload.id, {
              type: 'status',
              text: `DesignIR needs tools — not Cursor Cloud Agents · ${reminted}`
            })
          }
          forge = reminted
        }
        const fall = forgeFallbackNote(mind, keys)
        if (fall) sendChunk(payload.id, { type: 'status', text: fall })
        if (forge === 'cursor') {
          sendChunk(payload.id, { type: 'status', text: 'mind cursor · Cloud Agents' })
          const key = await getSecret(secrets(), 'cursor')
          if (!key) {
            sendChunk(payload.id, { type: 'error', error: 'Cursor Cloud Agents key is not set.' })
            sendChunk(payload.id, { type: 'done' })
            return
          }
          try {
            let forgeFailed = false
            await runCursorCloudJob({
              task,
              key,
              signal: ac.signal,
              send: (chunk) => {
                if (chunkIsForgeError(chunk)) forgeFailed = true
                sendChunk(payload.id, chunk)
              }
            })
            lastVerifyOk = !forgeFailed
            if (implementPath && shouldCloseThink(forgeFailed)) {
              try {
                const loaded = loadThinkDoc(r, implementPath)
                const bumped = bumpThinkStatus(loaded.markdown, 'done')
                if (bumped.changed) await writeFileSafe(r, loaded.path, bumped.markdown)
              } catch {
                /* stay implementing until the artifact is valid */
              }
            }
          } catch (err) {
            lastVerifyOk = false
            sendChunk(payload.id, { type: 'error', error: publicMindError(err) })
          }
          sendChunk(payload.id, { type: 'done' })
          return
        }
        if (forge === 'local' || mode === 'think') {
          try {
            await ensureLlama()
          } catch (err) {
            sendChunk(payload.id, { type: 'error', error: publicMindError(err) })
            sendChunk(payload.id, { type: 'done' })
            return
          }
        }
        const hits = rag?.search(task, 8) ?? []
        const sessionId = `sess_${Date.now()}`
        rag?.addMapNode({
          id: sessionId,
          title: task.slice(0, 80),
          kind: 'session',
          createdAt: Date.now()
        })
        await ensureKernelReady()
        if (!rag) throw new Error('RAG not ready — wait for boot')
        if (isFullToolMode(mode) && mcp.list().some((s) => !s.ok)) await reloadMcp(true)
        const packs = detectToolPacks(task, knowledge.skills)
        let tools = toolsForMode(mode, builtinToolDefs(), mcpTools, { packs, task, skills: knowledge.skills })
        if (needsDesign) {
          const loop = toolsForDesign(builtinToolDefs())
          if (loop.length) tools = loop
        }
        const frozen = freezeToolList(tools)
        tools = frozen.defs as typeof tools
        sendChunk(payload.id, {
          type: 'status',
          text: `tools ${tools.length} · packs ${packs.join(',')} · mcp ${mcp.list().filter((s) => s.ok).length}/${mcp.list().length}`
        })
        if (needsDesign) {
          sendChunk(payload.id, { type: 'status', text: `mesh ${designMeshRoute(task)}` })
        }
        if (mcp.list().some((s) => s.id === 'chrome-devtools' && s.ok) && isFullToolMode(mode)) {
          sendChunk(payload.id, { type: 'status', text: 'chrome-devtools analog pack-gated' })
        }
        let gitDiffText = ''
        let gitStatusText = ''
        try {
          gitStatusText = (await gitSnapshot(r)).porcelain
          gitDiffText = await gitDiff(r)
        } catch {
          /* no git */
        }
        let mentionBlobs = resolveMentions(task, {
          workspace: r,
          readFile: (p) => readFileSafe(r, p),
          listDir: (p) => {
            const dir = isAbsolute(p) ? p : join(r, p)
            try {
              return readdirSync(dir).map((name) => {
                const path = join(dir, name)
                let dirent = false
                try {
                  dirent = statSync(path).isDirectory()
                } catch {
                  dirent = false
                }
                return { name, dir: dirent, path }
              })
            } catch {
              return []
            }
          },
          gitDiff: gitDiffText,
          gitStatus: gitStatusText,
          terminals: implementPath ? '' : lastPtyText(),
          chats: implementPath
            ? ''
            : [formatChatLog(getThread(r, threadId)), payload.chatLog, lastConversation(r)].filter(Boolean).join('\n\n').slice(0, 8000),
          browser: implementPath ? '' : lastBrowserText()
        })
        const forgeChatLog = [formatChatLog(getThread(r, threadId)), payload.chatLog].filter(Boolean).join('\n')
        if (needsPerceivePack(mode) || /(?:^|\s)@codebase\b/i.test(task)) {
          let fleetLine = ''
          try {
            if (fleetHost) fleetLine = fleetReceiptLine(fleetHost.snapshot())
          } catch {
            fleetLine = ''
          }
          if (fleetLine) sendChunk(payload.id, { type: 'status', text: fleetLine })
          const graphMcp = mcp.list().some((s) => s.id === 'codebase-memory' && s.ok)
          mentionBlobs = `${await perceivePack(r, rag, task, {
            fleet: fleetLine,
            graphMcp,
            sessionText: formatChatLog(getThread(r, threadId)).slice(0, 400),
            debug: languageDebug().perceiveLine()
          })}\n\n${mentionBlobs}`.slice(0, mode === 'think' ? 12_000 : 8_000)
        }
        if (implementPath) {
          mentionBlobs = redactCloudText(mentionBlobs).slice(0, 16_000)
        }
        const batch: Array<{ path: string; before: string; after: string }> = []
        const wait = <T,>(map: Map<string, (v: T) => void>, fallback: T, ms = 120_000): Promise<T> =>
          new Promise((resolve) => {
            const t = setTimeout(() => {
              map.delete(payload.id)
              resolve(fallback)
            }, ms)
            map.set(payload.id, (v) => {
              clearTimeout(t)
              resolve(v)
            })
          })

        const gen = runForge(
          {
            task,
            pinnedProvider: mode === 'think' ? 'local' : forge,
            localPort: llama?.status.port ?? DEFAULT_LLAMA_PORT,
            getKey: (name) => getSecret(secrets(), name),
            tools,
            runTool: async (call) => {
              if (!filterFrozenTools(frozen, [{ name: call.name }]).length) {
                return { ok: false, name: call.name, content: 'frozen tool list' }
              }
              if (call.name.startsWith('mcp_')) {
                const hook = await runHooks(r, 'preToolUse', { tool_name: call.name, arguments: call.arguments })
                if (hook.permission === 'deny') return { ok: false, name: call.name, content: hook.message ?? 'hook denied' }
                const parsed = mcp.parseTool(call.name)
                const mcpOk = parsed
                  ? mcpToolAllowed(parsed.id, parsed.tool, perms.mcpAllowlist)
                  : false
                const decision = mcpApprovalDecision(perms.approvalMode, mcpOk)
                if (decision === 'ask') {
                  sendChunk(payload.id, {
                    type: 'approval',
                    approval: { id: payload.id, tool: call.name, detail: call.name, permission: 'net' }
                  })
                  const ok = await wait(approvals, false)
                  if (!ok) return { ok: false, name: call.name, content: 'denied by human' }
                }
                return mcp.call(call.name, call.arguments)
              }
              const def = tools.find((t) => t.name === call.name)
              const perm = def?.permissions[0] ?? 'read'
              const detail = toolApprovalDetail(call, browserCurrentUrl())
              const hookEvent =
                call.name === 'terminal_run' || call.name === 'test_run' || call.name === 'debug_start'
                  ? 'beforeShellExecution'
                  : 'preToolUse'
              const hook = await runHooks(r, hookEvent, { tool_name: call.name, command: detail, arguments: call.arguments })
              if (hook.permission === 'deny') return { ok: false, name: call.name, content: hook.message ?? 'hook denied' }
              const extraRoots = perms.fsExtraRoots ?? []
              let extraRoot = false
              if (
                (call.name === 'fs_write' || call.name === 'str_replace') &&
                typeof call.arguments.path === 'string'
              ) {
                try {
                  extraRoot = jailPath(r, String(call.arguments.path), extraRoots, call.arguments.root).extra
                } catch {
                  extraRoot = false
                }
              }
              let decision: 'allow' | 'ask' | 'deny'
              let reviewReport =
                perms.approvalMode === 'auto-review'
                  ? runAutoReviewPipeline({
                      perms,
                      permission: perm,
                      tool: call.name,
                      detail,
                      extraRoot
                    })
                  : null
              if (reviewReport) decision = reviewReport.verdict
              else decision = decideTool({ perms, permission: perm, tool: call.name, detail, extraRoot })
              if (
                reviewReport &&
                reviewReport.verdict === 'ask' &&
                (perm === 'exec' || perm === 'net') &&
                llama?.status.running &&
                reviewReport.reason !== 'extra-root'
              ) {
                try {
                  const axes = parseReviewerAxes(
                    await completeOnce({
                      provider: 'local',
                      localPort: llama.status.port,
                      temperature: 0.1,
                      signal: AbortSignal.timeout(8_000),
                      messages: [
                        { role: 'system', content: reviewerSystemPrompt() },
                        {
                          role: 'user',
                          content: reviewerUserPrompt(detail, takeReviewerTranscript(forgeChatLog))
                        }
                      ]
                    })
                  )
                  if (axes) {
                    reviewReport = runAutoReviewPipeline({
                      perms,
                      permission: perm,
                      tool: call.name,
                      detail,
                      extraRoot,
                      axes
                    })
                    decision = reviewReport.verdict
                  }
                } catch {
                  /* keep ask */
                }
              }
              if (reviewReport) {
                sendChunk(payload.id, { type: 'status', text: publicAutoReviewLine(reviewReport) })
              }
              if (decision === 'deny') {
                return { ok: false, name: call.name, content: 'unavailable' }
              }
              if (decision === 'ask') {
                sendChunk(payload.id, {
                  type: 'approval',
                  approval: { id: payload.id, tool: call.name, detail, permission: perm === 'write' ? 'write' : perm === 'exec' ? 'exec' : 'net' }
                })
                const ok = await wait(approvals, false)
                if (!ok) return { ok: false, name: call.name, content: 'denied by human' }
              }
              const result = await runTool(workspace, rag!, call, {
                ignore,
                tsIntel: languageIntel(),
                debug: languageDebug(),
                extraRoots: perms.fsExtraRoots ?? [],
                netAllowlist: perms.netAllowlist,
                unrestricted: perms.approvalMode === 'unrestricted',
                mode,
                nestedForge:
                  mode !== 'think' && ownedLlamaPort(coder?.status) != null
                    ? (job) => nestedExploreDigest(job, { root: r, ignore, perms, signal: ac.signal })
                    : undefined,
                askUser: async (prompt, options) => {
                  sendChunk(payload.id, {
                    type: 'question',
                    question: { id: payload.id, questions: [{ id: 'q0', prompt, options }] }
                  })
                  return wait(questions, '', 300_000)
                },
                browser: {
                  navigate: (url) => browserNavigate(url),
                  extract: () => browserExtract(r),
                  click: (sel) => browserClick(sel),
                  type: (sel, text) => browserType(sel, text),
                  screenshot: () => browserScreenshot(r),
                  console: (persist) => browserConsole(r, persist)
                }
              })
              const extra = result.extra as { path?: string; before?: string; after?: string } | undefined
              if (result.ok && extra?.path && extra.after != null) {
                const ch = changes.record(String(extra.path), String(extra.before ?? ''), String(extra.after), 'agent')
                batch.push({ path: String(extra.path), before: String(extra.before ?? ''), after: String(extra.after) })
                sendChunk(payload.id, { type: 'edit', edit: ch, text: `edited ${ch.path}` })
                await runHooks(r, 'afterFileEdit', { path: extra.path })
              }
              return result
            },
            skills: knowledge.skills,
            rules: knowledge.rules,
            ragHits: hits,
            openFiles: payload.openFiles ?? [],
            gitBranch: gitBranch(workspace),
            workspaceRoot: r,
            verifyNote: [
              languageDebug().perceiveLine(),
              ...(function diagNote() {
                const first = Array.isArray(payload.openFiles) ? payload.openFiles[0] : ''
                if (typeof first !== 'string' || !first) return []
                try {
                  const rows = languageIntel().diagnostics({ path: first }).slice(0, 8)
                  if (!rows.length) return []
                  return [
                    rows
                      .map((row) => `TS${row.code} L${row.startLine} ${row.message}`)
                      .join(' | ')
                      .replace(/[<>]/g, '')
                      .slice(0, 400)
                  ]
                } catch {
                  return []
                }
              })()
            ]
              .filter(Boolean)
              .join('\n'),
            mode,
            signal: ac.signal,
            selection: payload.selection,
            mentionBlobs,
            goal: payload.goal || stickyGoal || profile.standingGoal,
            customSkill: custom,
            contextCap: probeCache?.contextSize ?? 4096,
            pullSteer: () => {
              const q = steers.get(payload.id) ?? []
              steers.set(payload.id, [])
              return q.join('\n')
            },
            maxTurns: forgeTurnCap(needsDesign),
            needsTools: needsDesign
          },
          Boolean(llama?.status.running)
        )
        let lastText = ''
        let forgeFailed = false
        for await (const chunk of gen) {
          if (chunk.type === 'text') lastText += chunk.text ?? ''
          if (chunkIsForgeError(chunk)) forgeFailed = true
          sendChunk(payload.id, chunk)
        }
        lastVerifyOk = !forgeFailed
        if (batch.length) {
          const meta = changes.snapshot(task.slice(0, 60), batch)
          if (meta) sendChunk(payload.id, { type: 'checkpoint', checkpoint: meta, text: `checkpoint ${meta.id}` })
        }
        if (lastText) {
          try {
            appendTurn(r, threadId, { role: 'assistant', text: lastText, runId: payload.id })
          } catch {
            /* thread gone */
          }
          const thread = getThread(r, threadId)
          const conv = join(r, 'RAG', 'conversations', `${threadId}.md`)
          await writeFile(conv, ragExcerpt(thread) || `# ${task}\n\n${lastText}\n`, 'utf8')
          rag?.addMapEdge({ src: sessionId, dst: conv, rel: 'wrote' })
        }
        if (implementPath && shouldCloseThink(forgeFailed)) {
          try {
            const loaded = loadThinkDoc(r, implementPath)
            const bumped = bumpThinkStatus(loaded.markdown, 'done')
            if (bumped.changed) await writeFileSafe(r, loaded.path, bumped.markdown)
          } catch {
            /* stay implementing until the artifact is valid */
          }
        }
      } catch (err) {
        lastVerifyOk = false
        sendChunk(payload.id, { type: 'error', error: publicMindError(err) })
        sendChunk(payload.id, { type: 'done' })
      } finally {
        forgetKernelRun(payload.id)
        aborts.delete(payload.id)
        steers.delete(payload.id)
        void persistOutcomeHarness(workspace || root())
      }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) createWindow()
    else {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
  app.whenReady().then(async () => {
  attachSecretCrypt({
    available: () => safeStorage.isEncryptionAvailable(),
    encrypt: (s) => Buffer.from(safeStorage.encryptString(s)),
    decrypt: (b) => safeStorage.decryptString(Buffer.from(b))
  })
  const roots = loadRoots(true)
  workspace = roots.workspace || defaultWorkspace()
  if (roots.profile) await mkdir(roots.profile, { recursive: true, mode: 0o700 })
  if (roots.secretsDir) await mkdir(roots.secretsDir, { recursive: true, mode: 0o700 })
  if (roots.modelsDir) await mkdir(roots.modelsDir, { recursive: true, mode: 0o700 })
  await seedWorkspace(workspace)
  await seedLibraryIfMissing(workspace)
  if (roots.crashOptIn === 'local') {
    crashReporter.start({ submitURL: '', uploadToServer: false, compress: true })
  }
  registerIpc()
  await ensureKernelReady()
  telegramBridge = createTelegramBridge({
    root: () => workspace || root(),
    getToken: () => getSecret(secrets(), 'telegram'),
    ensureReady: () => ensureKernelReady(),
    reloadMcp: () => reloadMcp(),
    toolSurface: (mode) =>
      formatToolSurface(mode, builtinToolDefs(), mcpTools, mcp.list()),
    startJob: (payload) => {
      void startKernelJob(payload)
    },
    stopJob: (id) => {
      stopKernelRun(id)
      aborts.get(id)?.abort()
      approvals.get(id)?.(false)
      questions.get(id)?.('(stopped)')
    },
    answer: (id, text) => {
      questions.get(id)?.(text)
      questions.delete(id)
    },
    approve: (id, ok) => {
      approvals.get(id)?.(ok)
      approvals.delete(id)
    },
    loadBoard: () => loadBoard(workspace || root()),
    health: (opts) => kernelMindHealth(opts),
    fleet: {
      snapshot: () => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.snapshot()
      },
      addRepo: (raw) => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.addRepo(raw)
      },
      clone: (raw) => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.clone(raw)
      },
      cloneLocal: (raw) => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.cloneLocal(raw)
      },
      patchRepo: (raw) => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.patchRepo(raw)
      },
      start: (id) => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.start(id)
      },
      stop: (id) => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.stop(id)
      },
      restart: (id) => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.restart(id)
      },
      addSub: (raw) => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.addSub(raw)
      }
    }
  })
  telegramBridge.start()
  miniApp = createMiniAppServer({
    root: () => workspace || root(),
    getToken: () => getSecret(secrets(), 'telegram'),
    ensureReady: () => ensureKernelReady(),
    startJob: (payload) => {
      void startKernelJob(payload)
    },
    stopJob: (id) => {
      stopKernelRun(id)
      aborts.get(id)?.abort()
      approvals.get(id)?.(false)
      questions.get(id)?.('(stopped)')
    },
    approve: (id, ok) => {
      approvals.get(id)?.(ok)
      approvals.delete(id)
    },
    answer: (id, text) => {
      questions.get(id)?.(text)
      questions.delete(id)
    },
    steer: (id, text) => {
      const list = steers.get(id) ?? []
      list.push(String(text || '').slice(0, 800))
      steers.set(id, list)
    },
    loadBoard: () => loadBoard(workspace || root()),
    toolSurface: (mode) => formatToolSurface(mode, builtinToolDefs(), mcpTools, mcp.list()),
    health: (opts) => kernelMindHealth(opts),
    fleet: {
      snapshot: () => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.snapshot()
      },
      addRepo: (raw) => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.addRepo(raw)
      },
      clone: (raw) => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.clone(raw)
      },
      cloneLocal: (raw) => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.cloneLocal(raw)
      },
      patchRepo: (raw) => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.patchRepo(raw)
      },
      start: (id) => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.start(id)
      },
      stop: (id) => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.stop(id)
      },
      restart: (id) => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.restart(id)
      },
      addSub: (raw) => {
        if (!fleetHost) throw new Error('fleet down')
        return fleetHost.addSub(raw)
      }
    }
  })
  void miniApp.start().catch(() => {
    /* port in use — glass stays on last listener */
  })
  const bootProfile = loadProfile(workspace || root())
  if (bootProfile.defaultProvider === 'local' || bootProfile.defaultMode === 'think') {
    void ensureLlama().catch(() => {
      /* offline module optional until a local/think run */
    })
  }
  if (!HEADLESS) createWindow()
  if (process.env.HOMEAI_SMOKE && mainWindow) {
    const out = join(app.getPath('userData'), 'smoke.json')
    writeFileSync(
      out,
      JSON.stringify({
        sandbox: true,
        title: mainWindow.getTitle(),
        workspace: workspace.replace(/[<>]/g, '').slice(0, 200)
      })
    )
    app.quit()
  }
  })
}

app.on('window-all-closed', () => {
  if (HEADLESS) return
  telegramBridge?.stop()
  miniApp?.stop()
  disposePtys()
  void fleetHost?.stopAll()
  void llama?.stop()
  void coder?.stop()
  mcp.dispose()
  rag?.close()
  tsIntel?.dispose()
  void debugIntel?.stop()
  if (process.platform !== 'darwin') app.quit()
})

import type { AgentMode, ProviderId, StreamChunk, TaskBoard } from '@homeai/core'
import type { takeKernelHealth } from '@homeai/runtime'
import {
  appendTurn,
  approvalKeyboard,
  bindTelegram,
  catalogCard,
  chatAckKeyboard,
  consumePair,
  createThread,
  fleetCard,
  formatChatLog,
  glassAppKeyboard,
  groupHelloCard,
  healthPulse,
  helpCard,
  jobMarkup,
  jobRunId,
  manageCard,
  loopbackMiniAppUrl,
  miniMenuButton,
  listThreads,
  listWritableRules,
  listWritableSkills,
  loadProfile,
  loadPermissions,
  lastAutoReviewLine,
  loadTelegramState,
  menuCard,
  menuInlineKeyboard,
  needPairCard,
  nextBackoff,
  noticeCard,
  pairDmCard,
  pairFailCard,
  pairOkCard,
  progressCard,
  questionKeyboard,
  redactFleetLog,
  rememberUpdate,
  routeTelegram,
  saveProfile,
  inboxTranscript,
  inboxSttAllowed,
  rememberMiniRun,
  saveTelegramState,
  startPairing,
  stageCard,
  statusDashboard,
  stripParseMode,
  saveInboxSafe,
  takeFleetKind,
  takeFleetRecipe,
  takeMind,
  takeMode,
  takeNav,
  telegramCall,
  telegramDownloadFile,
  telegramFilePath,
  telegramStatusView,
  telegramTokenOk,
  takeBotIdentity,
  takeMiniAppUrl,
  takeTelegramSession,
  threadForTelegram,
  unpair,
  writeRule,
  writeSkill,
  deleteRule,
  deleteSkill
} from '@homeai/runtime'
import { upsertTask, listThinkDocs } from './tools'
import { MINIAPP_PORT } from './miniapp-server'

export interface KernelJobPayload {
  id: string
  task: string
  provider: ProviderId
  openFiles: string[]
  mode?: AgentMode
  goal?: string
  customSkill?: string
  chatLog?: string
  threadId?: string
  surface?: 'telegram' | 'desktop'
  thinkPath?: string
}

export interface FleetBridgeOps {
  snapshot: () => unknown
  addRepo: (raw: unknown) => unknown
  clone: (raw: unknown) => Promise<unknown>
  cloneLocal: (raw: unknown) => Promise<unknown>
  patchRepo: (raw: unknown) => unknown
  start: (id: unknown) => Promise<unknown>
  stop: (id: unknown) => Promise<unknown>
  restart: (id: unknown) => Promise<unknown>
  addSub: (raw: unknown) => unknown
}

export interface TelegramBridgeHost {
  root: () => string
  getToken: () => Promise<string | null>
  ensureReady: () => Promise<void>
  reloadMcp: () => Promise<unknown>
  toolSurface: (mode: AgentMode) => string
  startJob: (payload: KernelJobPayload) => void
  stopJob: (id: string) => void
  answer: (id: string, text: string) => void
  approve: (id: string, ok: boolean) => void
  loadBoard: () => TaskBoard
  health: (opts?: { warm?: boolean; listCursor?: boolean }) => Promise<ReturnType<typeof takeKernelHealth>>
  fleet?: FleetBridgeOps
}

type Pending = { kind: 'skill-new' | 'rule-new'; name: string } | null

interface LiveJob {
  chatId: number
  messageId: number
  chunks: StreamChunk[]
  startedAt: number
  threadId: string
  title: string
  token: string
  options?: string[]
  topicId?: number
  mode?: AgentMode
  provider?: ProviderId
}

export function createTelegramBridge(host: TelegramBridgeHost) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false
  let online = false
  let backoff = 400
  let pending: Pending = null
  const jobs = new Map<string, LiveJob>()
  const drafts = new Map<string, { task: string; threadId: string; chatId: number; topicId?: number }>()
  const editAt = new Map<string, number>()
  const typeAt = new Map<string, number>()
  let bot: { id: number; username: string } | null = null
  let replyTopic: number | undefined
  let glassPushed = false

  function glassUrl() {
    return takeMiniAppUrl(loadProfile(root()).miniAppUrl) || loopbackMiniAppUrl(MINIAPP_PORT)
  }

  async function pushGlass(token: string) {
    await telegramCall(token, 'setChatMenuButton', { menu_button: miniMenuButton(glassUrl()) })
  }

  function root() {
    return host.root()
  }

  function state() {
    return loadTelegramState(root())
  }

  function save(next: ReturnType<typeof loadTelegramState>) {
    saveTelegramState(root(), next)
  }

  async function send(token: string, chatId: number, text: string, extra?: Record<string, unknown>) {
    return telegramCall(token, 'sendMessage', {
      chat_id: chatId,
      text: String(text).slice(0, 3500),
      disable_web_page_preview: true,
      ...topicExtra(replyTopic),
      ...stripParseMode(extra)
    }) as Promise<{ message_id?: number }>
  }

  async function edit(token: string, chatId: number, messageId: number, text: string, extra?: Record<string, unknown>) {
    try {
      await telegramCall(token, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: String(text).slice(0, 3500),
        disable_web_page_preview: true,
        ...stripParseMode(extra)
      })
    } catch {
      /* ignore identical / stale edits */
    }
  }

  function topicExtra(topicId?: number) {
    return topicId && topicId > 0 ? { message_thread_id: topicId } : {}
  }

  function threadOf(chatId: number, title?: string) {
    return threadForTelegram(root(), chatId, { title, group: chatId < 0 })
  }

  async function say(token: string, chatId: number, text: string, topicId?: number, extra?: Record<string, unknown>) {
    return send(token, chatId, text, { ...topicExtra(topicId), ...extra })
  }

  async function present(
    token: string,
    chatId: number,
    text: string,
    topicId?: number,
    extra?: Record<string, unknown>,
    surface?: string
  ) {
    const next = { ...stripParseMode(extra) }
    if (!next.reply_markup && surface !== 'group') next.reply_markup = glassAppKeyboard(glassUrl())
    return say(token, chatId, text, topicId, next)
  }

  async function presentPulse(
    token: string,
    chatId: number,
    topicId: number | undefined,
    surface: string | undefined,
    opts?: { warm?: boolean; listCursor?: boolean }
  ) {
    const live = [...jobs.values()].find((j) => j.chatId === chatId)
    const board = host.loadBoard()
    const doing = board.cards.filter((c) => c.column === 'doing').map((c) => c.title).slice(0, 6)
    const profile = loadProfile(root())
    const h = await host.health(opts)
    const pulse = healthPulse(h)
    if (opts?.listCursor) {
      const lines = h.cursorJobs.map((j) => `${j.id} · ${j.status} · ${j.name}`)
      await present(
        token,
        chatId,
        catalogCard('CURSOR', lines.join('\n') || (h.cursor ? 'No Cursor jobs yet.' : 'Cursor key is not set.')),
        topicId,
        undefined,
        surface
      )
      return
    }
    await present(
      token,
      chatId,
      statusDashboard({
        live: live ? `${live.title} · ${live.mode || 'job'}` : '',
        doing,
        threadTitle: threadOf(chatId).title,
        mode: profile.defaultMode,
        provider: profile.defaultProvider,
        surface: host.toolSurface('agent').split('\n')[0] || '',
        busy: Boolean(live),
        llama: pulse.llama,
        keys: pulse.keys,
        cursor: pulse.cursor
      }),
      topicId,
      undefined,
      surface
    )
  }

  async function presentStage(
    token: string,
    chatId: number,
    topicId: number | undefined,
    surface: string | undefined
  ) {
    const live = [...jobs.values()].find((j) => j.chatId === chatId)
    const h = await host.health()
    const pulse = healthPulse(h)
    const docs = listThinkDocs(root()).slice(0, 8)
    const chunks = live?.chunks || []
    let approval = ''
    let waiting = false
    let phase = ''
    const tools: Array<{ name: string; status: string }> = []
    for (const c of chunks) {
      if (!c || typeof c !== 'object') continue
      if (c.type === 'step' && 'step' in c && c.step) phase = String(c.step)
      if (c.type === 'approval') {
        waiting = true
        approval = String(c.approval && 'tool' in c.approval ? c.approval.tool : '') || ''
      }
      if (c.type === 'tool_call' && c.toolCall) {
        tools.push({ name: c.toolCall.name, status: 'running' })
      }
    }
    const think = docs[0]
    await present(
      token,
      chatId,
      stageCard({
        phase,
        chunks,
        items: chunks,
        think: think?.status,
        thinkTitle: think?.title,
        docs,
        waiting,
        approval,
        lanes: tools,
        llama: pulse.llama,
        keys: pulse.keys,
        busy: Boolean(live),
        approvalMode: loadPermissions(root()).approvalMode,
        autoReviewLine: lastAutoReviewLine(chunks)
      }),
      topicId,
      undefined,
      surface
    )
  }

  async function presentManage(
    token: string,
    chatId: number,
    topicId: number | undefined,
    surface: string | undefined
  ) {
    const live = [...jobs.values()].find((j) => j.chatId === chatId)
    const profile = loadProfile(root())
    const h = await host.health()
    const pulse = healthPulse(h)
    await present(
      token,
      chatId,
      manageCard({
        online: true,
        mode: profile.defaultMode,
        mind: profile.defaultProvider,
        llama: pulse.llama,
        keys: pulse.keys,
        cursor: pulse.cursor,
        peers: state().peers.length,
        live: live ? live.title : '',
        glass: Boolean(takeMiniAppUrl(profile.miniAppUrl) || glassUrl())
      }),
      topicId,
      { reply_markup: menuInlineKeyboard() },
      surface
    )
  }

  function jobCard(job: LiveJob) {
    return progressCard(job.chunks, {
      title: job.title,
      startedAt: job.startedAt,
      mode: job.mode,
      provider: job.provider
    })
  }

  async function pulseTyping(token: string, chatId: number, key: string) {
    const prev = typeAt.get(key) || 0
    if (Date.now() - prev < 4000) return
    typeAt.set(key, Date.now())
    try {
      await telegramCall(token, 'sendChatAction', { chat_id: chatId, action: 'typing' })
    } catch {
      /* ignore */
    }
  }

  async function startRun(
    token: string,
    chatId: number,
    task: string,
    mode: AgentMode,
    threadId: string,
    topicId?: number
  ) {
    const profile = loadProfile(root())
    const id = `tg_${Date.now().toString(36)}`
    appendTurn(root(), threadId, { role: 'user', text: task, runId: id })
    const thread = threadOf(chatId)
    drafts.set(id, { task, threadId, chatId, topicId })
    await pulseTyping(token, chatId, id)
    const ack = await say(
      token,
      chatId,
      progressCard([], { title: task, startedAt: Date.now(), mode, provider: profile.defaultProvider }),
      topicId
    )
    const messageId = Number(ack?.message_id) || 0
    jobs.set(id, {
      chatId,
      messageId,
      chunks: [],
      startedAt: Date.now(),
      threadId,
      title: task.slice(0, 80),
      token,
      topicId,
      mode,
      provider: profile.defaultProvider
    })
    rememberMiniRun(id, { title: task, mode, startedAt: Date.now() })
    host.startJob({
      id,
      task,
      provider: profile.defaultProvider,
      openFiles: [],
      mode,
      goal: profile.standingGoal || undefined,
      customSkill: profile.pinnedSkill || undefined,
      chatLog: formatChatLog(thread),
      threadId,
      surface: 'telegram'
    })
  }

  async function presentFleet(token: string, chatId: number, intent: ReturnType<typeof routeTelegram>) {
    const ops = host.fleet
    if (!ops) {
      await present(token, chatId, noticeCard('Fleet host is not up.', 'FAULT', 'FLEET'), intent.topicId, undefined, intent.surface)
      return
    }
    const action = String(intent.action || 'status')
    if (action === 'denied-token') {
      await present(
        token,
        chatId,
        noticeCard('Bot tokens stay on the PC Fleet pane. Phone can clone, add a repo, start, and subscribe.', 'FAULT', 'FLEET'),
        intent.topicId,
        undefined,
        intent.surface
      )
      return
    }
    if (action === 'help') {
      await present(
        token,
        chatId,
        catalogCard('FLEET', fleetCard({ repos: [], bots: [], subscribers: [] })),
        intent.topicId,
        undefined,
        intent.surface
      )
      return
    }
    try {
      let snap: unknown = ops.snapshot()
      if (action === 'clone') {
        const kind = takeFleetKind(intent.extra) || 'website'
        const recipe = kind === 'telegram-bot' ? 'python-app-main' : 'npm-dev'
        snap = await ops.clone({ id: intent.id, url: intent.text, kind, recipe, title: intent.id })
      } else if (action === 'clone-local') {
        snap = await ops.cloneLocal({ id: intent.id, fromId: intent.fromId })
      } else if (action === 'add') {
        snap = ops.addRepo({
          id: intent.id,
          rel: intent.rel,
          kind: takeFleetKind(intent.extra) || 'generic',
          recipe: takeFleetRecipe(intent.extra === 'telegram-bot' ? 'python-app-main' : 'npm-dev') || 'python-app-main',
          title: intent.id
        })
      } else if (action === 'start') {
        snap = await ops.start(intent.id)
      } else if (action === 'stop') {
        snap = await ops.stop(intent.id)
      } else if (action === 'restart') {
        snap = await ops.restart(intent.id)
      } else if (action === 'sub') {
        snap = ops.addSub({ kind: 'telegram', chatId })
      }
      await present(token, chatId, catalogCard('FLEET', fleetCard(snap), 'LIVE'), intent.topicId, undefined, intent.surface)
    } catch (err) {
      const msg = redactFleetLog(err instanceof Error ? err.message : 'failed').slice(0, 180)
      await present(token, chatId, noticeCard(msg || 'Fleet failed.', 'FAULT', 'FLEET'), intent.topicId, undefined, intent.surface)
    }
  }

  async function handle(token: string, intent: ReturnType<typeof routeTelegram>) {
    const chatId = intent.chatId
    replyTopic = intent.topicId
    if (intent.kind === 'ignore') return
    if (intent.kind === 'deny') {
      if (intent.callbackId) await telegramCall(token, 'answerCallbackQuery', { callback_query_id: intent.callbackId })
      if (chatId && intent.ack !== 'no') await send(token, chatId, noticeCard('No.', 'FAULT', 'GLASS'))
      return
    }
    if (intent.kind === 'need-pair') {
      if (chatId) await say(token, chatId, needPairCard(intent.surface === 'group'), intent.topicId)
      return
    }
    if (intent.kind === 'pair-dm') {
      if (chatId) await say(token, chatId, pairDmCard(), intent.topicId)
      return
    }
    if (intent.kind === 'group-hello') {
      if (chatId) await say(token, chatId, groupHelloCard(), intent.topicId)
      return
    }
    if (intent.kind === 'pair') {
      const next = consumePair(state(), intent.code, intent.from)
      save(next.state)
      if (chatId) {
        if (next.ok && intent.from) {
          bindTelegram(root(), threadOf(chatId)!.id, chatId)
          try {
            await pushGlass(token)
            glassPushed = true
          } catch {
            /* menu button is optional */
          }
          await present(token, chatId, pairOkCard(), intent.topicId, undefined, 'private')
        } else await say(token, chatId, pairFailCard(), intent.topicId)
      }
      return
    }
    if (intent.callbackId) {
      await telegramCall(token, 'answerCallbackQuery', { callback_query_id: intent.callbackId })
    }
    if (!chatId) return

    const thread = threadOf(chatId, intent.chatTitle)
    if (!thread) return

    if (intent.kind === 'app') {
      const publicUrl = takeMiniAppUrl(loadProfile(root()).miniAppUrl)
      await present(
        token,
        chatId,
        noticeCard(
          publicUrl
            ? 'HOME glass is on the menu and the HOME key. Same kernel.'
            : 'HOME glass lives on this machine. Settings → Open, or paste a public HTTPS URL and Push.',
          'LIVE',
          'GLASS'
        ),
        intent.topicId,
        intent.surface === 'group' ? undefined : { reply_markup: glassAppKeyboard(glassUrl()) },
        intent.surface
      )
      return
    }
    if (intent.kind === 'help' || intent.kind === 'menu') {
      const approvalMode = loadPermissions(root()).approvalMode
      await present(
        token,
        chatId,
        intent.kind === 'menu' ? menuCard({ approvalMode }) : helpCard({ approvalMode }),
        intent.topicId,
        { reply_markup: menuInlineKeyboard() },
        intent.surface
      )
      return
    }
    if (intent.kind === 'manage') {
      await presentManage(token, chatId, intent.topicId, intent.surface)
      return
    }
    if (intent.kind === 'stage') {
      await presentStage(token, chatId, intent.topicId, intent.surface)
      return
    }
    if (intent.kind === 'status' || intent.kind === 'health') {
      await presentPulse(token, chatId, intent.topicId, intent.surface, { listCursor: false })
      return
    }
    if (intent.kind === 'cursor') {
      await presentPulse(token, chatId, intent.topicId, intent.surface, { listCursor: true })
      return
    }
    if (intent.kind === 'llama') {
      await presentPulse(token, chatId, intent.topicId, intent.surface, { warm: true })
      return
    }
    if (intent.kind === 'mind' && intent.mind) {
      saveProfile(root(), { defaultProvider: intent.mind })
      await presentManage(token, chatId, intent.topicId, intent.surface)
      return
    }
    if (intent.kind === 'inbox-file' && intent.fileId && intent.name) {
      try {
        const info = (await telegramCall(token, 'getFile', { file_id: intent.fileId })) as {
          file_path?: string
          file_size?: number
        }
        const path = telegramFilePath(info?.file_path)
        const size = Number(info?.file_size) || 0
        if (!path || size > 2_000_000) {
          await present(token, chatId, noticeCard('Drop rejected.', 'FAULT', 'INBOX'), intent.topicId, undefined, intent.surface)
          return
        }
        const buf = await telegramDownloadFile(token, path)
        const saved = saveInboxSafe(root(), intent.name, buf.toString('base64'))
        if (!saved) {
          await present(token, chatId, noticeCard('Drop rejected.', 'FAULT', 'INBOX'), intent.topicId, undefined, intent.surface)
          return
        }
        let extra = intent.caption || ''
        if (inboxSttAllowed(saved.rel)) {
          const spoken = await inboxTranscript(root(), saved.rel)
          if (spoken) extra = extra ? `${extra}\n${spoken}` : spoken
        }
        await present(
          token,
          chatId,
          noticeCard(extra && extra !== intent.caption ? `Dropped · @${saved.rel}\n${String(extra).slice(0, 200)}` : `Dropped · @${saved.rel}`, 'LIVE', 'INBOX'),
          intent.topicId,
          undefined,
          intent.surface
        )
        if (extra) {
          await startRun(token, chatId, `@${saved.rel}\n${extra}`, 'ask', thread.id, intent.topicId)
        }
      } catch {
        await present(token, chatId, noticeCard('Drop failed.', 'FAULT', 'INBOX'), intent.topicId, undefined, intent.surface)
      }
      return
    }
    if (intent.kind === 'tools') {
      await host.ensureReady()
      await present(token, chatId, catalogCard('STACK', host.toolSurface('agent')), intent.topicId, undefined, intent.surface)
      return
    }
    if (intent.kind === 'mcp-reload') {
      await host.reloadMcp()
      await present(token, chatId, catalogCard('STACK', host.toolSurface('agent'), 'LIVE'), intent.topicId, undefined, intent.surface)
      return
    }
    if (intent.kind === 'fleet') {
      await presentFleet(token, chatId, intent)
      return
    }
    if (intent.kind === 'stop') {
      for (const [id, job] of jobs) {
        if (job.chatId === chatId) host.stopJob(id)
      }
      await present(token, chatId, noticeCard('Halted.', 'IDLE', 'HALT'), intent.topicId, undefined, intent.surface)
      return
    }
    if (intent.kind === 'tasks') {
      const board = host.loadBoard()
      const lines = board.columns.map((col) => {
        const cards = board.cards.filter((c) => c.column === col.id).map((c) => `· ${c.title}`)
        return `${col.title}\n${cards.join('\n') || '· —'}`
      })
      await present(token, chatId, catalogCard('BOARD', lines.join('\n\n')), intent.topicId, undefined, intent.surface)
      return
    }
    if (intent.kind === 'task-add' && intent.title) {
      upsertTask(root(), { title: intent.title, column: 'backlog' })
      await present(token, chatId, noticeCard(`Pinned · ${intent.title}`, 'IDLE', 'BOARD'), intent.topicId, undefined, intent.surface)
      return
    }
    if (intent.kind === 'skills') {
      const rows = listWritableSkills(root()).map((s) => `${s.slug} — ${s.preview}`).join('\n') || 'None yet. /skill new Name'
      await present(token, chatId, catalogCard('MIND', rows), intent.topicId, undefined, intent.surface)
      return
    }
    if (intent.kind === 'rules') {
      const rows = listWritableRules(root()).map((s) => `${s.slug} — ${s.preview}`).join('\n') || 'None yet. /rule new Name'
      await present(token, chatId, catalogCard('MIND', rows), intent.topicId, undefined, intent.surface)
      return
    }
    if (intent.kind === 'skill-new' && intent.name) {
      pending = { kind: 'skill-new', name: intent.name }
      await present(
        token,
        chatId,
        noticeCard(
          `Send the skill body for ${intent.name}${intent.surface === 'group' ? ' — reply to me' : ''}`,
          'LIVE',
          'MIND'
        ),
        intent.topicId,
        undefined,
        intent.surface
      )
      return
    }
    if (intent.kind === 'rule-new' && intent.name) {
      pending = { kind: 'rule-new', name: intent.name }
      await present(
        token,
        chatId,
        noticeCard(
          `Send the instruction for ${intent.name}${intent.surface === 'group' ? ' — reply to me' : ''}`,
          'LIVE',
          'MIND'
        ),
        intent.topicId,
        undefined,
        intent.surface
      )
      return
    }
    if (intent.kind === 'skill-body' && intent.name && intent.body) {
      pending = null
      writeSkill(root(), { name: intent.name, description: intent.name, body: intent.body })
      await present(token, chatId, noticeCard(`Skill sealed · ${intent.name}`, 'LANDED', 'MIND'), intent.topicId, undefined, intent.surface)
      return
    }
    if (intent.kind === 'rule-body' && intent.name && intent.body) {
      pending = null
      writeRule(root(), { name: intent.name, body: intent.body })
      await present(token, chatId, noticeCard(`Instruction sealed · ${intent.name}`, 'LANDED', 'MIND'), intent.topicId, undefined, intent.surface)
      return
    }
    if (intent.kind === 'skill-del' && intent.slug) {
      deleteSkill(root(), intent.slug)
      await present(token, chatId, noticeCard(`Removed skill · ${intent.slug}`, 'IDLE', 'MIND'), intent.topicId, undefined, intent.surface)
      return
    }
    if (intent.kind === 'rule-del' && intent.slug) {
      deleteRule(root(), intent.slug)
      await present(token, chatId, noticeCard(`Removed rule · ${intent.slug}`, 'IDLE', 'MIND'), intent.topicId, undefined, intent.surface)
      return
    }
    if (intent.kind === 'chats') {
      const rows = listThreads(root()).map((t) => `${t.id} · ${t.title}`).join('\n')
      await present(token, chatId, catalogCard('THREADS', rows), intent.topicId, undefined, intent.surface)
      return
    }
    if (intent.kind === 'use-chat' && intent.threadId) {
      bindTelegram(root(), intent.threadId, chatId)
      await present(token, chatId, noticeCard(`Now on ${intent.threadId}`, 'LIVE', 'THREAD'), intent.topicId, undefined, intent.surface)
      return
    }
    if (intent.kind === 'new-chat') {
      const t = createThread(root(), 'Glass', 'telegram')
      bindTelegram(root(), t.id, chatId)
      await present(
        token,
        chatId,
        noticeCard('New session on the glass. Same kernel.', 'LIVE', 'GLASS'),
        intent.topicId,
        undefined,
        intent.surface
      )
      return
    }
    if (intent.kind === 'settings') {
      await presentManage(token, chatId, intent.topicId, intent.surface)
      return
    }
    if (intent.kind === 'goal') {
      saveProfile(root(), { standingGoal: intent.text || '' })
      await present(token, chatId, noticeCard(`Goal · ${intent.text || 'cleared'}`, 'LIVE', 'YOU'), intent.topicId, undefined, intent.surface)
      return
    }
    if (intent.kind === 'mode' && intent.mode) {
      saveProfile(root(), { defaultMode: intent.mode as AgentMode })
      await present(token, chatId, noticeCard(`Mode · ${intent.mode}`, 'LIVE', 'YOU'), intent.topicId, undefined, intent.surface)
      return
    }
    if (intent.kind === 'run' && intent.task) {
      await startRun(token, chatId, intent.task, (intent.mode as AgentMode) || 'agent', thread.id, intent.topicId)
      return
    }
    if (intent.kind === 'chat' && intent.task) {
      const mode = (takeMode(loadProfile(root()).defaultMode) || 'ask') as AgentMode
      const live = mode === 'agent' || mode === 'debug' || mode === 'multitask' || mode === 'plan'
      if (live) {
        await startRun(token, chatId, intent.task, mode, thread.id, intent.topicId)
        return
      }
      const draftId = `d_${Date.now().toString(36)}`
      drafts.set(draftId, { task: intent.task, threadId: thread.id, chatId, topicId: intent.topicId })
      await startRun(token, chatId, intent.task, mode === 'think' ? 'think' : 'ask', thread.id, intent.topicId)
      const last = [...jobs.values()].find((j) => j.chatId === chatId)
      if (last?.messageId) {
        await edit(token, chatId, last.messageId, jobCard(last), {
          reply_markup: chatAckKeyboard(draftId)
        })
      }
      return
    }
    if (intent.kind === 'callback' && intent.id && intent.action) {
      await handleCallback(token, chatId, { kind: intent.action, id: intent.id, extra: intent.extra, topicId: intent.topicId })
    }
  }

  async function handleCallback(
    token: string,
    chatId: number,
    intent: { kind: string; id: string; extra?: string; topicId?: number }
  ) {
    const key = intent.id
    replyTopic = intent.topicId ?? drafts.get(key)?.topicId
    if (intent.kind === 'mod') {
      const mode = takeMode(intent.extra)
      if (mode) {
        saveProfile(root(), { defaultMode: mode as AgentMode })
        await presentManage(token, chatId, intent.topicId, chatId < 0 ? 'group' : 'private')
        return
      }
      const mind = takeMind(intent.extra || '')
      if (mind) {
        saveProfile(root(), { defaultProvider: mind })
        await presentManage(token, chatId, intent.topicId, chatId < 0 ? 'group' : 'private')
      }
      return
    }
    if (intent.kind === 'nav') {
      const nav = takeNav(intent.extra)
      if (nav) {
        await handle(token, {
          kind: nav,
          chatId,
          topicId: intent.topicId,
          surface: chatId < 0 ? 'group' : 'private'
        })
      }
      return
    }
    if (intent.kind === 'flt') {
      const verb = intent.id
      if (verb === 'start' || verb === 'stop' || verb === 'restart') {
        await handle(token, {
          kind: 'fleet',
          action: verb,
          id: intent.extra,
          chatId,
          topicId: intent.topicId,
          surface: chatId < 0 ? 'group' : 'private'
        })
      }
      return
    }
    if (intent.kind === 'new') {
      await handle(token, {
        kind: 'new-chat',
        chatId,
        topicId: intent.topicId,
        surface: chatId < 0 ? 'group' : 'private'
      })
      return
    }
    if (intent.kind === 'stp') {
      host.stopJob(key)
      await present(token, chatId, noticeCard('Halted.', 'IDLE', 'HALT'), intent.topicId)
      return
    }
    if (intent.kind === 'run' || intent.kind === 'thk') {
      const draft = drafts.get(key)
      const task = draft?.task
      if (!task) return
      const threadId = draft.threadId
      await startRun(token, chatId, task, intent.kind === 'thk' ? 'think' : 'agent', threadId, replyTopic)
      return
    }
    if (intent.kind === 'tsk') {
      const draft = drafts.get(key)
      if (draft?.task) upsertTask(root(), { title: draft.task.slice(0, 80), column: 'backlog' })
      await present(token, chatId, noticeCard('Pinned to the board.', 'IDLE', 'BOARD'), intent.topicId)
      return
    }
    if (intent.kind === 'ok' || intent.kind === 'no') {
      host.approve(key, intent.kind === 'ok')
      return
    }
    if (intent.kind === 'ans') {
      const job = jobs.get(key)
      const i = Number(intent.extra)
      const opt = job?.options?.[i] || String(intent.extra || '')
      host.answer(key, opt)
    }
  }

  async function tick() {
    if (stopped) return
    const token = await host.getToken()
    if (!token || !telegramTokenOk(token)) {
      online = false
      timer = setTimeout(() => void tick(), 5000)
      return
    }
    let next = state()
    try {
      if (!bot) {
        try {
          bot = takeBotIdentity(await telegramCall(token, 'getMe', {}))
        } catch {
          bot = null
        }
      }
      if (!glassPushed) {
        try {
          await pushGlass(token)
          glassPushed = true
        } catch {
          /* menu button is optional */
        }
      }
      const updates = (await telegramCall(token, 'getUpdates', {
        offset: next.offset + 1,
        timeout: 25,
        allowed_updates: ['message', 'callback_query', 'my_chat_member']
      })) as Array<Record<string, unknown>>
      online = true
      backoff = 400
      for (const u of updates || []) {
        const mem = rememberUpdate(next, u.update_id)
        next = mem.state
        if (!mem.fresh) continue
        save(next)
        const intent = routeTelegram(u, { state: next, pending, bot })
        try {
          await handle(token, intent)
        } catch (err) {
          const chatId = intent.chatId
          if (chatId) {
            replyTopic = intent.topicId
            await send(token, chatId, noticeCard('Something failed. Try again.', 'FAULT', 'GLASS'))
          }
          void err
        }
        next = state()
      }
      save(next)
    } catch (err) {
      online = false
      backoff = nextBackoff(backoff, err && typeof err === 'object' ? Number(err.retryAfterMs) : 0)
    }
    if (!stopped) timer = setTimeout(() => void tick(), online ? 200 : backoff)
  }

  function flushEdit(id: string) {
    const job = jobs.get(id)
    if (!job || !job.messageId) return
    void edit(job.token, job.chatId, job.messageId, jobCard(job), { reply_markup: jobMarkup(id, job.chunks) })
  }

  return {
    start() {
      stopped = false
      if (!timer) timer = setTimeout(() => void tick(), 200)
    },
    stop() {
      stopped = true
      if (timer) clearTimeout(timer)
      timer = null
      online = false
      bot = null
      glassPushed = false
    },
    async pushMiniApp() {
      const token = await host.getToken()
      if (!token || !telegramTokenOk(token)) throw new Error('telegram offline')
      await pushGlass(token)
      glassPushed = true
      return { url: glassUrl() }
    },
    status() {
      return telegramStatusView(state(), true, online)
    },
    liveJobs() {
      return [...jobs.entries()].slice(0, 8).map(([id, job]) => ({
        id: jobRunId(id) || id.slice(0, 80),
        title: job.title,
        mode: job.mode || 'ask'
      }))
    },
    session() {
      const profile = loadProfile(root())
      const st = telegramStatusView(state(), true, online)
      return takeTelegramSession({
        ...st,
        mode: profile.defaultMode,
        mind: profile.defaultProvider,
        live: [...jobs.entries()].slice(0, 8).map(([id, job]) => ({
          id,
          title: job.title,
          mode: job.mode
        })),
        threads: listThreads(root())
          .filter((t) => t.source === 'telegram' || t.source === 'both' || t.telegramChatId)
          .map((t) => ({ id: t.id, title: t.title })),
        glass: Boolean(takeMiniAppUrl(profile.miniAppUrl))
      })
    },
    pairStart() {
      const next = startPairing(state())
      save(next.state)
      return { code: next.code, exp: next.exp }
    },
    unpairUser(userId: number) {
      save(unpair(state(), userId))
    },
    onChunk(id: string, chunk: StreamChunk) {
      const job = jobs.get(id)
      if (!job) return
      const safe: StreamChunk =
        chunk.type === 'tool_call' && chunk.toolCall
          ? { type: 'tool_call', toolCall: { id: chunk.toolCall.id, name: chunk.toolCall.name, arguments: {} } }
          : chunk
      job.chunks.push(safe)
      void pulseTyping(job.token, job.chatId, id)
      if (chunk.type === 'approval' && chunk.approval) {
        void edit(job.token, job.chatId, job.messageId, jobCard(job), {
          reply_markup: approvalKeyboard(id)
        })
      }
      if (chunk.type === 'question' && chunk.question) {
        job.options = chunk.question.questions[0]?.options
        void edit(job.token, job.chatId, job.messageId, jobCard(job), {
          reply_markup: questionKeyboard(id, job.options)
        })
      }
      if (chunk.type === 'done' || chunk.type === 'error') {
        const last = job.chunks
          .filter((c) => c.type === 'text' && c.text)
          .map((c) => c.text)
          .join('')
        if (last) appendTurn(root(), job.threadId, { role: 'assistant', text: last, runId: id })
        flushEdit(id)
        jobs.delete(id)
        return
      }
      const prev = editAt.get(id) || 0
      const now = Date.now()
      if (now - prev > 800) {
        editAt.set(id, now)
        flushEdit(id)
      } else {
        setTimeout(() => {
          if (Date.now() - (editAt.get(id) || 0) >= 800) {
            editAt.set(id, Date.now())
            flushEdit(id)
          }
        }, 850)
      }
    },
    notifyDesktopRun(title: string, runId: string, threadId: string) {
      if (!loadProfile(root()).telegramNotifyDesktopRuns) return
      void (async () => {
        const token = await host.getToken()
        if (!token) return
        const bound = listThreads(root()).find((t) => t.id === threadId && t.telegramChatId)
        const chatId = bound?.telegramChatId
        if (!chatId) return
        drafts.set(runId, { task: title, threadId, chatId })
        const ack = await send(token, chatId, progressCard([], { title, startedAt: Date.now(), mode: 'agent' }))
        const messageId = Number(ack?.message_id) || 0
        jobs.set(runId, {
          chatId,
          messageId,
          chunks: [],
          startedAt: Date.now(),
          threadId,
          title: title.slice(0, 80),
          token,
          mode: 'agent'
        })
      })()
    },
    isOnline() {
      return online
    }
  }
}

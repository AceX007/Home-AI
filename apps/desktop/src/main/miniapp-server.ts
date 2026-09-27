import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentMode, ProviderId } from '@homeai/core'
import {
  bindTelegram,
  takeFleetKind,
  takeFleetRecipe,
  kindFromAddRel,
  defaultRecipeForKind,
  catalogCard,
  createThread,
  fleetCard,
  formatChatLog,
  formatConsole,
  getThread,
  healthPulse,
  inboxTranscript,
  isPeer,
  lastMiniRunId,
  listThreads,
  listWritableRules,
  listWritableSkills,
  loadActiveThreadId,
  loadProfile,
  loadPermissions,
  loadTelegramState,
  loopbackMiniAppUrl,
  miniAppPort,
  miniPulse,
  noticeCard,
  redactFleetLog,
  rememberMiniRun,
  saveActiveThreadId,
  saveInboxSafe,
  saveProfile,
  stageCard,
  statusDashboard,
  takeKernelHealth,
  takeMiniAppUrl,
  takeMiniBody,
  takeMind,
  thinkRelFromOpen,
  threadForTelegram,
  validateTelegramInitData,
  stripActivityText
} from '@homeai/runtime'
import { assertInside, listThinkDocs, upsertTask } from './tools'
import type { KernelJobPayload, FleetBridgeOps } from './telegram-bridge'

export const MINIAPP_PORT = miniAppPort(process.env.HOMEAI_MINIAPP_PORT)

const FILES: Record<string, { file: string; type: string }> = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  '/app.css': { file: 'app.css', type: 'text/css; charset=utf-8' }
}

export interface MiniAppHost {
  root: () => string
  getToken: () => Promise<string | null>
  ensureReady: () => Promise<void>
  startJob: (payload: KernelJobPayload) => void
  stopJob: (id: string) => void
  approve: (id: string, ok: boolean) => void
  answer: (id: string, text: string) => void
  steer: (id: string, text: string) => void
  loadBoard: () => { columns: Array<{ id: string; title: string }>; cards: Array<{ column: string; title: string }> }
  toolSurface: (mode: AgentMode) => string
  health: (opts?: { warm?: boolean; listCursor?: boolean }) => Promise<ReturnType<typeof takeKernelHealth>>
  fleet?: FleetBridgeOps
}

function isLoopback(req: IncomingMessage): boolean {
  const ip = String(req.socket.remoteAddress || '')
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
}

function allowOrigin(origin: string): string {
  if (!origin) return ''
  if (takeMiniAppUrl(origin)) return origin
  try {
    const u = new URL(origin)
    const host = u.hostname.toLowerCase()
    if ((host === '127.0.0.1' || host === 'localhost') && (u.protocol === 'http:' || u.protocol === 'https:')) {
      return origin
    }
  } catch {
    return ''
  }
  return ''
}

function cors(req: IncomingMessage, res: ServerResponse): void {
  const origin = allowOrigin(String(req.headers.origin || ''))
  if (origin) res.setHeader('access-control-allow-origin', origin)
  res.setHeader('access-control-allow-headers', 'content-type, x-telegram-init-data')
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
  res.setHeader('vary', 'origin')
}

function json(res: ServerResponse, code: number, body: Record<string, unknown>): void {
  res.statusCode = code
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body).slice(0, 8000))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let n = 0
    req.on('data', (c: Buffer) => {
      n += c.length
      if (n > 2_800_000) {
        reject(new Error('too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function createMiniAppServer(host: MiniAppHost) {
  const dir = join(host.root(), 'apps', 'miniapp')

  async function authorize(req: IncomingMessage): Promise<{ userId: number; loopback: boolean } | null> {
    const init = String(req.headers['x-telegram-init-data'] || '')
    const token = await host.getToken()
    const publicUrl = takeMiniAppUrl(loadProfile(host.root()).miniAppUrl)
    if (init) {
      if (!token) return null
      const v = validateTelegramInitData(token, init)
      if (!v) return null
      if (!isPeer(loadTelegramState(host.root()), v.userId)) return null
      return { userId: v.userId, loopback: false }
    }
    if (isLoopback(req) && !publicUrl) return { userId: 0, loopback: true }
    return null
  }

  function threadOf(root: string, who: { userId: number; loopback: boolean }) {
    if (who.loopback) return getThread(root, loadActiveThreadId(root))
    return threadForTelegram(root, who.userId)
  }

  function publicThinkDocs(root: string) {
    return listThinkDocs(root)
      .slice(0, 8)
      .map((d) => {
        const path = thinkRelFromOpen(d.path)
        const status = ['ready', 'implementing', 'done', 'think'].includes(d.status) ? d.status : ''
        const title = String(d.title || '')
          .replace(/[<>]/g, '')
          .slice(0, 80)
        return path ? { path, title, status } : null
      })
      .filter((d): d is { path: string; title: string; status: string } => Boolean(d))
  }

  function startChat(
    root: string,
    profile: ReturnType<typeof loadProfile>,
    thread: ReturnType<typeof getThread>,
    task: string,
    mode: string,
    thinkPath?: string
  ) {
    const id = `mn_${Date.now().toString(36)}`
    rememberMiniRun(id, { title: task, mode, startedAt: Date.now() })
    host.startJob({
      id,
      task,
      provider: profile.defaultProvider as ProviderId,
      openFiles: [],
      mode: (mode as AgentMode) || 'ask',
      goal: profile.standingGoal || undefined,
      customSkill: profile.pinnedSkill || undefined,
      chatLog: formatChatLog(thread),
      threadId: thread?.id || loadActiveThreadId(root),
      surface: 'miniapp',
      thinkPath
    })
    return id
  }

  const server = createServer(async (req, res) => {
    try {
      cors(req, res)
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      if (req.method === 'OPTIONS') {
        res.statusCode = 204
        res.end()
        return
      }
      if (req.method === 'GET') {
        const spec = FILES[url.pathname]
        if (!spec) {
          res.statusCode = 404
          res.end()
          return
        }
        const abs = assertInside(dir, spec.file)
        if (!existsSync(abs)) {
          res.statusCode = 404
          res.end()
          return
        }
        res.setHeader('content-type', spec.type)
        res.setHeader('cache-control', 'no-store')
        res.setHeader('x-content-type-options', 'nosniff')
        res.end(readFileSync(abs))
        return
      }
      if (req.method !== 'POST' || url.pathname !== '/api') {
        res.statusCode = 404
        res.end()
        return
      }
      const who = await authorize(req)
      if (!who) {
        json(res, 401, { error: 'pair this Telegram account first' })
        return
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(await readBody(req))
      } catch {
        json(res, 400, { error: 'bad json' })
        return
      }
      const body = takeMiniBody(parsed)
      if (!body) {
        json(res, 400, { error: 'bad action' })
        return
      }
      await host.ensureReady()
      const root = host.root()
      const profile = loadProfile(root)
      const thread = threadOf(root, who)

      if (body.action === 'session') {
        const h = await host.health()
        json(res, 200, {
          ok: true,
          mode: profile.defaultMode,
          provider: profile.defaultProvider,
          thread: thread?.title || 'Home',
          health: h,
          card: noticeCard('Glass is live. Stage · Think · Drop on the same kernel.', 'LIVE', 'GLASS')
        })
        return
      }
      if (body.action === 'health') {
        const h = await host.health({ listCursor: true })
        const pulse = healthPulse(h)
        const live = lastMiniRunId()
        const run = live ? miniPulse(live) : null
        const docs = publicThinkDocs(root)
        json(res, 200, {
          health: h,
          docs,
          card: stageCard({
            think: docs[0]?.status,
            thinkTitle: docs[0]?.title,
            docs,
            llama: pulse.llama,
            keys: pulse.keys,
            approvalMode: loadPermissions(root).approvalMode,
            autoReviewLine: run?.autoReviewLine
          })
        })
        return
      }
      if (body.action === 'provider' && body.provider) {
        const mind = takeMind(body.provider)
        if (!mind) {
          json(res, 400, { error: 'bad mind' })
          return
        }
        const next = saveProfile(root, { defaultProvider: mind })
        const h = await host.health()
        json(res, 200, {
          provider: next.defaultProvider,
          health: h,
          card: noticeCard(`Mind · ${next.defaultProvider}`, 'LIVE', 'YOU')
        })
        return
      }
      if (body.action === 'mode' && body.mode) {
        const next = saveProfile(root, { defaultMode: body.mode as AgentMode })
        json(res, 200, {
          mode: next.defaultMode,
          card: noticeCard(`Mode · ${next.defaultMode}`, 'LIVE', 'YOU')
        })
        return
      }
      if (body.action === 'cursor') {
        const h = await host.health({ listCursor: true })
        const lines = h.cursorJobs.map((j) => `${j.id} · ${j.status} · ${j.name}`)
        json(res, 200, {
          health: h,
          card: catalogCard('CURSOR', lines.join('\n') || (h.cursor ? 'No Cursor jobs yet.' : 'Cursor key is not set.'))
        })
        return
      }
      if (body.action === 'llama') {
        const h = await host.health({ warm: true })
        const pulse = healthPulse(h)
        json(res, 200, {
          health: h,
          card: statusDashboard({
            threadTitle: thread?.title,
            mode: profile.defaultMode,
            provider: profile.defaultProvider,
            llama: pulse.llama,
            keys: pulse.keys,
            cursor: pulse.cursor
          })
        })
        return
      }
      if (body.action === 'stack') {
        json(res, 200, { card: catalogCard('STACK', host.toolSurface('agent')) })
        return
      }
      if (
        body.action === 'fleet' ||
        body.action === 'fleet-clone' ||
        body.action === 'fleet-add' ||
        body.action === 'fleet-start' ||
        body.action === 'fleet-stop' ||
        body.action === 'fleet-restart' ||
        body.action === 'fleet-fork' ||
        body.action === 'fleet-sub'
      ) {
        const ops = host.fleet
        if (!ops) {
          json(res, 503, { error: 'fleet down' })
          return
        }
        try {
          let snap: unknown = ops.snapshot()
          if (body.action === 'fleet-clone') {
            snap = await ops.clone({
              id: body.id,
              url: body.url,
              kind: body.kind || 'website',
              recipe: body.kind === 'telegram-bot' ? 'python-app-main' : 'npm-dev',
              title: body.id
            })
          } else if (body.action === 'fleet-fork') {
            snap = await ops.cloneLocal({ id: body.id, fromId: body.fromId })
          } else if (body.action === 'fleet-add') {
            const kind = takeFleetKind(body.kind) || kindFromAddRel(body.rel) || 'generic'
            const recipe = takeFleetRecipe(body.recipe) || defaultRecipeForKind(kind)
            snap = ops.addRepo({ id: body.id, rel: body.rel, kind, recipe, title: body.id })
          } else if (body.action === 'fleet-start') {
            snap = await ops.start(body.id)
          } else if (body.action === 'fleet-stop') {
            snap = await ops.stop(body.id)
          } else if (body.action === 'fleet-restart') {
            snap = await ops.restart(body.id)
          } else if (body.action === 'fleet-sub') {
            if (!who.userId) {
              json(res, 400, { error: 'pair telegram to subscribe' })
              return
            }
            snap = ops.addSub({ kind: 'telegram', chatId: who.userId })
          }
          const s = snap && typeof snap === 'object' ? (snap as Record<string, unknown>) : {}
          const repos = Array.isArray(s.repos)
            ? s.repos.slice(0, 16).map((row: { id?: string; running?: boolean; rel?: string; kind?: string; cloneOf?: string; domain?: string }) => ({
                id: String(row.id || ''),
                running: Boolean(row.running),
                kind: String(row.kind || ''),
                cloneOf: String(row.cloneOf || ''),
                domain: String(row.domain || '')
              }))
            : []
          json(res, 200, { card: catalogCard('FLEET', fleetCard(snap), 'LIVE'), repos })
        } catch (err) {
          json(res, 400, {
            error: redactFleetLog(err instanceof Error ? err.message : 'failed').slice(0, 180)
          })
        }
        return
      }
      if (body.action === 'skills') {
        const rows = listWritableSkills(root).map((s) => `${s.slug} — ${s.preview}`)
        json(res, 200, { card: catalogCard('SKILLS', rows.join('\n') || 'None yet.') })
        return
      }
      if (body.action === 'board') {
        const board = host.loadBoard()
        const lines = board.columns.map((col) => {
          const cards = board.cards.filter((c) => c.column === col.id).map((c) => `· ${c.title}`)
          return `${col.title}\n${cards.join('\n') || '· —'}`
        })
        json(res, 200, { card: catalogCard('BOARD', lines.join('\n\n')) })
        return
      }
      if (body.action === 'glance') {
        const live = lastMiniRunId()
        const pulse = live ? miniPulse(live) : null
        const h = await host.health({ listCursor: true })
        const mind = healthPulse(h)
        const docs = publicThinkDocs(root)
        json(res, 200, {
          health: h,
          docs,
          hold: pulse?.hold === true,
          runId: pulse?.runId || '',
          phases: stripActivityText(pulse?.phases, 80),
          card: stageCard({
            phase: pulse?.phase,
            think: docs[0]?.status,
            thinkTitle: docs[0]?.title,
            docs,
            waiting: pulse?.hold === true,
            approval: pulse?.tool,
            llama: mind.llama,
            keys: mind.keys,
            error: pulse?.error,
            tools: pulse?.tools,
            busy: Boolean(pulse && !pulse.done),
            runId: pulse?.runId,
            workflow: pulse?.workflow,
            approvalMode: loadPermissions(root).approvalMode,
            autoReviewLine: pulse?.autoReviewLine
          })
        })
        return
      }
      if (body.action === 'mind') {
        const skills = listWritableSkills(root).map((s) => `${s.slug} — ${s.preview}`)
        const rules = listWritableRules(root).map((s) => `${s.slug} — ${s.preview}`)
        json(res, 200, {
          card: catalogCard('MIND', `skills\n${skills.join('\n') || '· —'}\n\nrules\n${rules.join('\n') || '· —'}`)
        })
        return
      }
      if (body.action === 'threads') {
        const rows = listThreads(root)
        json(res, 200, {
          card: catalogCard('THREADS', rows.map((t) => `${t.id} · ${t.title}`).join('\n')),
          threads: rows.slice(0, 12).map((t) => ({ id: t.id, title: t.title }))
        })
        return
      }
      if (body.action === 'new') {
        const t = createThread(root, 'Glass', 'telegram')
        if (who.loopback) saveActiveThreadId(root, t.id)
        else bindTelegram(root, t.id, who.userId)
        json(res, 200, { card: noticeCard('New session on the glass. Same kernel.', 'LIVE', 'GLASS'), thread: t.title })
        return
      }
      if (body.action === 'use' && body.threadId) {
        if (who.loopback) saveActiveThreadId(root, body.threadId)
        else bindTelegram(root, body.threadId, who.userId)
        json(res, 200, { card: noticeCard(`Now on ${body.threadId}`, 'LIVE', 'THREAD') })
        return
      }
      if (body.action === 'think') {
        const docs = listThinkDocs(root).slice(0, 8)
        const lines = docs.map((d) => `${d.status || 'think'} · ${d.title}`)
        json(res, 200, {
          card: catalogCard('THINK', lines.join('\n') || 'No think docs yet. Deep pass first.'),
          docs: docs.map((d) => ({ path: d.path, title: d.title, status: d.status }))
        })
        return
      }
      if (body.action === 'pin' && body.title) {
        upsertTask(root, { title: body.title, column: 'backlog' })
        json(res, 200, { card: noticeCard(`Pinned · ${body.title}`, 'IDLE', 'BOARD') })
        return
      }
      if (body.action === 'goal') {
        saveProfile(root, { standingGoal: body.text || '' })
        json(res, 200, { card: noticeCard(`Goal · ${body.text || 'cleared'}`, 'LIVE', 'YOU') })
        return
      }
      if (body.action === 'pulse') {
        const id = body.runId || lastMiniRunId()
        json(res, 200, miniPulse(id) || { error: 'idle', card: formatConsole(['No live job.'], { state: 'IDLE', kicker: 'PULSE' }) })
        return
      }
      if (body.action === 'stop' && body.runId) {
        host.stopJob(body.runId)
        json(res, 200, { ok: true })
        return
      }
      if (body.action === 'approve' && body.runId) {
        host.approve(body.runId, body.ok === true)
        json(res, 200, { ok: true })
        return
      }
      if (body.action === 'steer' && body.runId && body.text) {
        host.steer(body.runId, body.text)
        json(res, 200, { ok: true, card: noticeCard('Steered.', 'LIVE', 'GLASS') })
        return
      }
      if (body.action === 'answer' && body.runId) {
        const pulse = miniPulse(body.runId)
        const picked =
          typeof body.pick === 'number' && pulse?.options[body.pick] ? pulse.options[body.pick] : body.text
        if (!picked) {
          json(res, 400, { error: 'bad answer' })
          return
        }
        host.answer(body.runId, picked)
        json(res, 200, { ok: true })
        return
      }
      if (body.action === 'implement' && body.path) {
        const id = startChat(root, profile, thread, `Implement ${body.path}`, 'agent', body.path)
        json(res, 200, { runId: id, card: miniPulse(id)?.card || noticeCard(body.path, 'LIVE', 'SHIP') })
        return
      }
      if (body.action === 'inbox' && body.name && body.data) {
        const saved = saveInboxSafe(root, body.name, body.data)
        if (!saved) {
          json(res, 400, { error: 'inbox rejected' })
          return
        }
        let transcript = ''
        try {
          transcript = await inboxTranscript(root, saved.rel)
        } catch {
          transcript = ''
        }
        json(res, 200, {
          card: noticeCard(`Dropped · @${saved.rel}`, 'LIVE', 'INBOX'),
          rel: saved.rel,
          transcript: stripActivityText(transcript, 800)
        })
        return
      }
      if (body.action === 'chat' && body.task) {
        const id = startChat(root, profile, thread, body.task, body.mode || 'ask')
        json(res, 200, {
          runId: id,
          card: miniPulse(id)?.card || noticeCard(body.task, 'LIVE', body.mode)
        })
        return
      }
      json(res, 400, { error: 'bad action' })
    } catch {
      json(res, 500, { error: 'failed' })
    }
  })

  return {
    port: MINIAPP_PORT,
    url: loopbackMiniAppUrl(MINIAPP_PORT),
    start() {
      return new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(MINIAPP_PORT, '127.0.0.1', () => resolve())
      })
    },
    stop() {
      server.close()
    }
  }
}

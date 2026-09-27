import { ipcMain } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  accountSecretRel,
  assertInside,
  botSecretRel,
  gitCloneHttpsArgv,
  loadRegistry,
  publicSnapshot,
  recipeSpawn,
  redactFleetLog,
  rotationNotice,
  saveRegistry,
  smtpEndpoint,
  smtpSecretRel,
  takeAccountLabel,
  takeBotRole,
  takeBotToken,
  takeBotUsername,
  takeBroadcastBody,
  takeTelegramChatId,
  takeEmail,
  takeFleetId,
  takeFleetKind,
  takeFleetRecipe,
  takePlainLine,
  takeRepoRel,
  takeSiteDomain,
  nextCloneId,
  takeSmtpProvider,
  telegramCall,
  maskSecret,
  sendAllowlistedSmtp,
  filterSubscribers
} from '@homeai/runtime'

type Live = { child: ChildProcess; pid: number }

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function runGit(cwd: string, args: string[], timeoutMs = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, env: process.env as NodeJS.ProcessEnv })
    let out = ''
    const t = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('git timeout'))
    }, timeoutMs)
    child.stdout?.on('data', (d) => {
      out += String(d)
    })
    child.stderr?.on('data', (d) => {
      out += String(d)
    })
    child.on('close', (code) => {
      clearTimeout(t)
      if (code === 0) resolve(redactFleetLog(out) || 'ok')
      else reject(new Error(redactFleetLog(out) || `git exit ${code}`))
    })
    child.on('error', (e) => {
      clearTimeout(t)
      reject(e)
    })
  })
}

export function createFleetHost(opts: {
  root: () => string
  secretsDir: () => string
  draftText?: (prompt: string) => Promise<string>
}): {
  register(): void
  stopAll(): Promise<void>
  snapshot: () => unknown
  addRepo: (raw: unknown) => unknown
  clone: (raw: unknown) => Promise<unknown>
  cloneLocal: (raw: unknown) => Promise<unknown>
  patchRepo: (raw: unknown) => unknown
  start: (id: unknown) => Promise<unknown>
  stop: (id: unknown) => Promise<unknown>
  restart: (id: unknown) => Promise<unknown>
  addSub: (raw: unknown) => unknown
  removeSub: (raw: unknown) => unknown
} {
  const live = new Map<string, Live>()

  const root = () => opts.root()
  const secrets = () => opts.secretsDir()

  function fleetSecretAbs(rel: string | null): string {
    if (!rel) throw new Error('bad secret')
    return assertInside(root(), rel)
  }

  function writeSecret(rel: string | null, value: string): void {
    const abs = fleetSecretAbs(rel)
    mkdirSync(join(secrets(), 'fleet'), { recursive: true, mode: 0o700 })
    writeFileSync(abs, value.trim(), { encoding: 'utf8', mode: 0o600 })
    chmodSync(abs, 0o600)
  }

  function readSecret(rel: string | null): string | null {
    try {
      const abs = fleetSecretAbs(rel)
      if (!existsSync(abs)) return null
      const v = readFileSync(abs, 'utf8').trim()
      return v || null
    } catch {
      return null
    }
  }

  function dropSecret(rel: string | null): void {
    try {
      const abs = fleetSecretAbs(rel)
      if (existsSync(abs)) unlinkSync(abs)
    } catch {
      /* ignore */
    }
  }

  function snap() {
    const reg = loadRegistry(root())
    const running: Record<string, number> = {}
    for (const [id, row] of live) running[id] = row.pid
    return publicSnapshot(reg, { ...running, smtpPass: Boolean(readSecret(smtpSecretRel())) })
  }

  function appendLog(id: string, chunk: string): void {
    const rel = `data/fleet/logs/${id}.log`
    try {
      const abs = assertInside(root(), rel)
      mkdirSync(join(root(), 'data', 'fleet', 'logs'), { recursive: true })
      appendFileSync(abs, redactFleetLog(chunk), 'utf8')
    } catch {
      /* ignore */
    }
  }

  async function stopStack(id: string): Promise<void> {
    const row = live.get(id)
    if (!row) return
    live.delete(id)
    const child = row.child
    if (child.exitCode == null) {
      child.kill('SIGTERM')
      await sleep(1500)
      if (child.exitCode == null) child.kill('SIGKILL')
    }
  }

  async function startStack(idRaw: unknown): Promise<unknown> {
    const id = takeFleetId(idRaw)
    if (!id) throw new Error('bad id')
    const reg = loadRegistry(root())
    const repo = (reg.repos as Array<{ id: string; rel: string; recipe: string; kind: string }>).find((r) => r.id === id)
    if (!repo) throw new Error('unknown repo')
    if (live.has(id)) return snap()
    const spec = recipeSpawn(repo.recipe)
    if (!spec) throw new Error('bad recipe')
    const cwd = assertInside(root(), repo.rel)
    const env: NodeJS.ProcessEnv = { ...process.env, PYTHONUNBUFFERED: '1' }
    if (repo.kind === 'telegram-bot') {
      const bots = (reg.bots as Array<{ id: string; role: string; repoId: string }>).filter((b) => b.repoId === id)
      const hub = bots.find((b) => b.role === 'hub')
      const workers = bots.filter((b) => b.role === 'worker')
      const hubTok = hub ? readSecret(botSecretRel(hub.id)) : null
      if (hubTok) env.HUB_BOT_TOKEN = hubTok
      const toks = workers.map((w) => readSecret(botSecretRel(w.id))).filter(Boolean) as string[]
      if (toks.length) env.TEST_BOT_TOKENS = toks.join(',')
    }
    const child = spawn(spec.bin, spec.args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const pid = child.pid
    if (!pid) throw new Error('spawn failed')
    live.set(id, { child, pid })
    child.stdout?.on('data', (d) => appendLog(id, String(d)))
    child.stderr?.on('data', (d) => appendLog(id, String(d)))
    child.on('exit', () => {
      live.delete(id)
      appendLog(id, `\n[exit]\n`)
    })
    return snap()
  }

  async function announce(botIdRaw: unknown): Promise<{ sent: number; preview: string }> {
    const botId = takeFleetId(botIdRaw)
    if (!botId) throw new Error('bad bot')
    const reg = loadRegistry(root())
    const bot = (reg.bots as Array<{ id: string; username?: string; repoId: string; role: string }>).find((b) => b.id === botId)
    if (!bot?.username) throw new Error('bot has no username')
    const body = rotationNotice(bot.username)
    if (!body) throw new Error('bad notice')
    const token = readSecret(botSecretRel(botId))
    if (!token) throw new Error('missing token')
    const subs = (reg.subscribers as Array<{ kind: string; chatId?: number; botId?: string }>).filter(
      (s) => s.kind === 'telegram' && (!s.botId || s.botId === botId || s.botId === bot.repoId)
    )
    let sent = 0
    for (const s of subs.slice(0, 50)) {
      if (s.chatId == null) continue
      await telegramCall(token, 'sendMessage', { chat_id: s.chatId, text: body })
      sent += 1
    }
    return { sent, preview: body }
  }

  function addRepo(raw: unknown) {
    const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const id = takeFleetId(row.id)
    const rel = takeRepoRel(row.rel)
    const kind = takeFleetKind(row.kind) || 'generic'
    const recipe = takeFleetRecipe(row.recipe) || 'python-app-main'
    const title = takePlainLine(row.title, 80) || id
    const cloneOf = takeFleetId(row.fromId) || takeFleetId(row.cloneOf)
    const domain = takeSiteDomain(row.domain)
    if (!id || !rel) throw new Error('bad repo')
    assertInside(root(), rel)
    const reg = loadRegistry(root())
    const repos = (reg.repos as Array<Record<string, unknown>>).filter((r) => r.id !== id)
    const next: Record<string, unknown> = { id, title, kind, rel, recipe }
    if (cloneOf && cloneOf !== id) next.cloneOf = cloneOf
    if (domain) next.domain = domain
    repos.push(next)
    saveRegistry(root(), { ...reg, repos })
    return snap()
  }

  async function cloneHttps(raw: unknown) {
    const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const id = takeFleetId(row.id)
    const kind = takeFleetKind(row.kind) || 'website'
    const recipe = takeFleetRecipe(row.recipe) || (kind === 'telegram-bot' ? 'python-app-main' : 'npm-dev')
    const title = takePlainLine(row.title, 80) || id
    const cloneOf = takeFleetId(row.fromId) || takeFleetId(row.cloneOf)
    const domain = takeSiteDomain(row.domain)
    if (!id) throw new Error('bad id')
    const argv = gitCloneHttpsArgv(row.url, id)
    const parentRel = kind === 'website' || kind === 'generic' ? 'Repos' : 'data/fleet/clones'
    const parent = assertInside(root(), parentRel)
    mkdirSync(parent, { recursive: true })
    const dest = join(parent, id)
    if (existsSync(dest)) throw new Error('clone dest exists')
    await runGit(parent, argv)
    const rel = takeRepoRel(`${parentRel}/${id}`)
    if (!rel) throw new Error('bad dest')
    const reg = loadRegistry(root())
    const repos = (reg.repos as Array<Record<string, unknown>>).filter((r) => r.id !== id)
    const next: Record<string, unknown> = { id, title, kind, rel, recipe }
    if (cloneOf && cloneOf !== id) next.cloneOf = cloneOf
    if (domain) next.domain = domain
    repos.push(next)
    saveRegistry(root(), { ...reg, repos })
    return snap()
  }

  async function cloneLocal(raw: unknown) {
    const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const fromId = takeFleetId(row.fromId)
    if (!fromId) throw new Error('bad clone')
    const reg = loadRegistry(root())
    const src = (reg.repos as Array<{ id: string; rel: string; kind: string; recipe: string; title: string }>).find(
      (r) => r.id === fromId
    )
    if (!src) throw new Error('unknown source')
    const ids = (reg.repos as Array<{ id: string }>).map((r) => r.id)
    const id = takeFleetId(row.id) || nextCloneId(fromId, ids)
    if (!id) throw new Error('bad clone id')
    const srcAbs = assertInside(root(), src.rel)
    const destRel = takeRepoRel(`data/fleet/clones/${id}`)
    if (!destRel) throw new Error('bad dest')
    const destAbs = assertInside(root(), destRel)
    if (existsSync(destAbs)) throw new Error('clone dest exists')
    mkdirSync(join(root(), 'data', 'fleet', 'clones'), { recursive: true })
    await runGit(root(), ['clone', '--', srcAbs, destAbs])
    const repos = (reg.repos as Array<Record<string, unknown>>).filter((r) => r.id !== id)
    repos.push({
      id,
      title: takePlainLine(`${src.title} clone`, 80) || id,
      kind: src.kind,
      rel: destRel,
      recipe: src.recipe,
      cloneOf: fromId
    })
    saveRegistry(root(), { ...reg, repos })
    return snap()
  }

  function patchRepo(raw: unknown) {
    const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const id = takeFleetId(row.id)
    if (!id) throw new Error('bad id')
    const reg = loadRegistry(root())
    const repos = (reg.repos as Array<Record<string, unknown>>).map((r) => {
      if (r.id !== id) return r
      const next = { ...r }
      const title = takePlainLine(row.title, 80)
      if (title) next.title = title
      const domain = takeSiteDomain(row.domain)
      if (row.domain === '' || row.domain === null) delete next.domain
      else if (domain) next.domain = domain
      const recipe = takeFleetRecipe(row.recipe)
      if (recipe) next.recipe = recipe
      return next
    })
    saveRegistry(root(), { ...reg, repos })
    return snap()
  }

  function addSub(raw: unknown) {
    const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const kind = row.kind === 'email' ? 'email' : row.kind === 'telegram' ? 'telegram' : null
    if (!kind) throw new Error('bad subscriber')
    const botId = takeFleetId(row.botId)
    const reg = loadRegistry(root())
    const subs = [...(reg.subscribers as Array<Record<string, unknown>>)]
    if (kind === 'telegram') {
      const chatId = takeTelegramChatId(row.chatId)
      if (chatId == null) throw new Error('bad chat id')
      if (subs.some((s) => s.kind === 'telegram' && s.chatId === chatId)) {
        saveRegistry(root(), { ...reg, subscribers: subs })
        return snap()
      }
      subs.push(botId ? { kind, chatId, botId } : { kind, chatId })
    } else {
      const email = takeEmail(row.email)
      if (!email) throw new Error('bad email')
      subs.push({ kind, email })
    }
    saveRegistry(root(), { ...reg, subscribers: subs })
    return snap()
  }

  function removeSub(raw: unknown) {
    const reg = loadRegistry(root())
    const subs = filterSubscribers(reg.subscribers, raw)
    saveRegistry(root(), { ...reg, subscribers: subs })
    return snap()
  }

  async function stopById(idRaw: unknown) {
    const id = takeFleetId(idRaw)
    if (!id) throw new Error('bad id')
    await stopStack(id)
    return snap()
  }

  async function restartById(idRaw: unknown) {
    const id = takeFleetId(idRaw)
    if (!id) throw new Error('bad id')
    await stopStack(id)
    return startStack(id)
  }

  function register(): void {
    ipcMain.handle('homeai:fleet:snapshot', () => snap())

    ipcMain.handle('homeai:fleet:addRepo', (_e, raw) => addRepo(raw))

    ipcMain.handle('homeai:fleet:removeRepo', async (_e, raw) => {
      const id = takeFleetId(raw?.id)
      if (!id) throw new Error('bad id')
      await stopStack(id)
      const reg = loadRegistry(root())
      saveRegistry(root(), {
        ...reg,
        repos: (reg.repos as Array<{ id: string }>).filter((r) => r.id !== id)
      })
      return snap()
    })

    ipcMain.handle('homeai:fleet:clone', (_e, raw) => cloneHttps(raw))
    ipcMain.handle('homeai:fleet:cloneLocal', (_e, raw) => cloneLocal(raw))
    ipcMain.handle('homeai:fleet:patchRepo', (_e, raw) => patchRepo(raw))

    ipcMain.handle('homeai:fleet:start', (_e, raw) => startStack(raw?.id))
    ipcMain.handle('homeai:fleet:stop', (_e, raw) => stopById(raw?.id))
    ipcMain.handle('homeai:fleet:restart', (_e, raw) => restartById(raw?.id))
    ipcMain.handle('homeai:fleet:log', (_e, raw) => {
      const id = takeFleetId(raw?.id)
      if (!id) throw new Error('bad id')
      const abs = assertInside(root(), `data/fleet/logs/${id}.log`)
      if (!existsSync(abs)) return ''
      return redactFleetLog(readFileSync(abs, 'utf8').slice(-8000))
    })

    ipcMain.handle('homeai:fleet:addBot', async (_e, raw) => {
      const id = takeFleetId(raw?.id)
      const repoId = takeFleetId(raw?.repoId)
      const role = takeBotRole(raw?.role) || 'worker'
      const token = takeBotToken(raw?.token)
      if (!id || !repoId || !token) throw new Error('bad bot')
      let username = takeBotUsername(raw?.username)
      try {
        const me = (await telegramCall(token, 'getMe', {})) as { username?: string }
        if (me?.username) username = takeBotUsername(me.username) || username
      } catch {
        /* token stored even if getMe fails; probe later */
      }
      writeSecret(botSecretRel(id), token)
      const reg = loadRegistry(root())
      const bots = (reg.bots as Array<Record<string, unknown>>).filter((b) => b.id !== id)
      bots.push({
        id,
        role,
        repoId,
        username: username || '',
        hasToken: true,
        last4: maskSecret(token).slice(-4)
      })
      saveRegistry(root(), { ...reg, bots })
      return snap()
    })

    ipcMain.handle('homeai:fleet:removeBot', (_e, raw) => {
      const id = takeFleetId(raw?.id)
      if (!id) throw new Error('bad id')
      dropSecret(botSecretRel(id))
      const reg = loadRegistry(root())
      saveRegistry(root(), { ...reg, bots: (reg.bots as Array<{ id: string }>).filter((b) => b.id !== id) })
      return snap()
    })

    ipcMain.handle('homeai:fleet:probeBot', async (_e, raw) => {
      const id = takeFleetId(raw?.id)
      if (!id) throw new Error('bad id')
      const token = readSecret(botSecretRel(id))
      if (!token) throw new Error('missing token')
      const me = (await telegramCall(token, 'getMe', {})) as { username?: string; id?: number }
      const username = takeBotUsername(me?.username)
      const reg = loadRegistry(root())
      const bots = (reg.bots as Array<Record<string, unknown>>).map((b) =>
        b.id === id ? { ...b, username: username || b.username, hasToken: true } : b
      )
      saveRegistry(root(), { ...reg, bots })
      return { ok: true, username: username || '', telegramId: me?.id || 0, ...snap() }
    })

    ipcMain.handle('homeai:fleet:addAccount', (_e, raw) => {
      const id = takeFleetId(raw?.id)
      const label = takeAccountLabel(raw?.label) || id
      const session = String(raw?.session || '').trim()
      if (!id || session.length < 20 || session.length > 8000 || session.includes('\0')) throw new Error('bad account')
      writeSecret(accountSecretRel(id), session)
      const reg = loadRegistry(root())
      const accounts = (reg.accounts as Array<Record<string, unknown>>).filter((a) => a.id !== id)
      accounts.push({ id, label, hasSession: true, last4: maskSecret(session).slice(-4) })
      saveRegistry(root(), { ...reg, accounts })
      return snap()
    })

    ipcMain.handle('homeai:fleet:removeAccount', (_e, raw) => {
      const id = takeFleetId(raw?.id)
      if (!id) throw new Error('bad id')
      dropSecret(accountSecretRel(id))
      const reg = loadRegistry(root())
      saveRegistry(root(), {
        ...reg,
        accounts: (reg.accounts as Array<{ id: string }>).filter((a) => a.id !== id)
      })
      return snap()
    })

    ipcMain.handle('homeai:fleet:addSub', (_e, raw) => addSub(raw))

    ipcMain.handle('homeai:fleet:removeSub', (_e, raw) => removeSub(raw))

    ipcMain.handle('homeai:fleet:smtpSet', (_e, raw) => {
      const provider = takeSmtpProvider(raw?.provider) || 'none'
      const user = takeEmail(raw?.user) || ''
      const pass = String(raw?.pass || '').trim()
      if (pass) {
        if (pass.length < 4 || pass.length > 200 || pass.includes('\0')) throw new Error('bad smtp pass')
        writeSecret(smtpSecretRel(), pass)
      }
      const reg = loadRegistry(root())
      saveRegistry(root(), { ...reg, smtp: { provider, user } })
      return snap()
    })

    ipcMain.handle('homeai:fleet:draft', async (_e, raw) => {
      const username = takeBotUsername(raw?.username)
      const hint = takeBroadcastBody(raw?.hint) || rotationNotice(username || 'NewHubBot')
      const fallback = rotationNotice(username || 'NewHubBot') || ''
      if (!opts.draftText) return { text: fallback }
      try {
        const text = takeBroadcastBody(
          await opts.draftText(
            `Write a short plain-text Telegram notice for subscribers. No HTML. Mention https://t.me/${username || 'bot'} if a username is given. Hint: ${hint}. Max 400 characters.`
          )
        )
        return { text: text || fallback }
      } catch {
        return { text: fallback }
      }
    })

    ipcMain.handle('homeai:fleet:broadcast', async (_e, raw) => {
      const channel = raw?.channel === 'email' ? 'email' : 'telegram'
      const body = takeBroadcastBody(raw?.body)
      if (!body) throw new Error('bad body')
      const reg = loadRegistry(root())
      if (channel === 'telegram') {
        const botId = takeFleetId(raw?.botId)
        if (!botId) throw new Error('pick a bot')
        const token = readSecret(botSecretRel(botId))
        if (!token) throw new Error('missing token')
        const subs = (reg.subscribers as Array<{ kind: string; chatId?: number; botId?: string }>).filter(
          (s) => s.kind === 'telegram' && (!s.botId || s.botId === botId)
        )
        let sent = 0
        for (const s of subs.slice(0, 50)) {
          if (s.chatId == null) continue
          await telegramCall(token, 'sendMessage', { chat_id: s.chatId, text: body })
          sent += 1
        }
        return { sent, channel: 'telegram' }
      }
      const ep = smtpEndpoint(reg.smtp.provider)
      if (!ep) throw new Error('set Proton Bridge or Tuta SMTP first')
      const pass = readSecret(smtpSecretRel())
      const user = String(reg.smtp.user || '')
      if (!pass || !user) throw new Error('smtp not configured')
      const emails = (reg.subscribers as Array<{ kind: string; email?: string }>)
        .filter((s) => s.kind === 'email' && s.email)
        .map((s) => s.email as string)
        .slice(0, 20)
      let sent = 0
      for (const to of emails) {
        await sendAllowlistedSmtp({
          host: ep.host,
          port: ep.port,
          user,
          pass,
          from: user,
          to,
          subject: takePlainLine(raw?.subject, 80) || 'Notice',
          body
        })
        sent += 1
      }
      return { sent, channel: 'email' }
    })

    ipcMain.handle('homeai:fleet:announce', (_e, raw) => announce(raw?.botId))
  }

  async function stopAll(): Promise<void> {
    const ids = [...live.keys()]
    for (const id of ids) await stopStack(id)
  }

  return {
    register,
    stopAll,
    snapshot: snap,
    addRepo,
    clone: cloneHttps,
    cloneLocal,
    patchRepo,
    start: startStack,
    stop: stopById,
    restart: restartById,
    addSub,
    removeSub
  }
}

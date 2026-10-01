export const FORGE_STEPS = ['perceive', 'route', 'act', 'verify', 'remember']

export function stripActivityText(s, max = 80) {
  return String(s ?? '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** Jailed workspace-relative prefix for editor crumbs. No `..`, no secrets, no HTML. */
export function takeCrumbPrefix(rel, index) {
  if (typeof rel !== 'string') return null
  const s = rel.trim()
  if (!s || s.includes('\\') || s.startsWith('/') || s.includes('..') || s.includes('<') || s.includes('>')) return null
  if (/\.key$/i.test(s) || /(^|\/)\.env(\.|$)/.test(s) || /(^|\/)data\/secrets(\/|$)/.test(s)) return null
  const parts = s.split('/').filter(Boolean).map((p) => stripActivityText(p, 48)).filter(Boolean)
  const i = Number(index)
  if (!Number.isInteger(i) || i < 0 || i >= parts.length - 1) return null
  const prefix = parts.slice(0, i + 1).join('/')
  if (!prefix || prefix.includes('..')) return null
  return prefix.slice(0, 240)
}

/** In-buffer outline. Labels are stripped text. Cap 80. */
export function takeBufferOutline(text, query) {
  if (typeof text !== 'string' || !text) return []
  const q = typeof query === 'string' ? stripActivityText(query, 80).toLowerCase() : ''
  const out = []
  const lines = text.split('\n')
  const decl = /^(export\s+)?(async\s+)?(function|class|const|let|type|interface|enum|def)\s+([\w$]+)/
  const md = /^(#{1,6})\s+(.+)$/
  for (let n = 0; n < lines.length && out.length < 80; n++) {
    const raw = String(lines[n] ?? '').slice(0, 200)
    const t = raw.trim()
    let label = ''
    const m = decl.exec(t)
    if (m) label = stripActivityText(`${m[3]} ${m[4]}`, 80)
    else {
      const h = md.exec(t)
      if (h) label = stripActivityText(h[2], 80)
    }
    if (!label) continue
    if (q && !label.toLowerCase().includes(q)) continue
    out.push({ line: n + 1, label })
  }
  return out
}

export function countDiffLines(before, after) {
  const oldL = String(before ?? '').split('\n')
  const newL = String(after ?? '').split('\n')
  const n = Math.max(oldL.length, newL.length)
  let adds = 0
  let dels = 0
  for (let i = 0; i < n; i++) {
    if (oldL[i] !== newL[i]) {
      if (oldL[i] != null) dels++
      if (newL[i] != null) adds++
    }
  }
  return { adds, dels }
}

function classify(item) {
  const kind = item?.kind
  if (kind === 'tool' || kind === 'status' || kind === 'shell' || kind === 'edit') return 'commands'
  if (kind === 'diff') return 'edits'
  if (kind === 'thought') return 'thought'
  if (kind === 'wait') return 'wait'
  if (kind === 'user') return 'user'
  if (kind === 'assistant') return 'assistant'
  if (kind === 'checkpoint') return 'checkpoint'
  if (kind === 'error') return 'error'
  return 'other'
}

function labelFor(type, items) {
  if (type === 'commands') {
    if (items.length === 1) {
      const it = items[0]
      return stripActivityText(it.caption || it.text || 'command', 80)
    }
    return `Ran ${items.length} commands`
  }
  if (type === 'edits') {
    if (items.length === 1) {
      const it = items[0]
      const { adds, dels } = countDiffLines(it.before, it.after)
      const name = stripActivityText(String(it.text || it.path || 'file').split('/').pop(), 48)
      return `Edited ${name} +${adds} −${dels}`
    }
    return `Edited ${items.length} files`
  }
  if (type === 'thought') return stripActivityText(items[0]?.text || 'Thought', 80)
  if (type === 'wait') return stripActivityText(items[0]?.text || 'Waiting', 80)
  if (type === 'checkpoint') return stripActivityText(items[0]?.text || 'checkpoint', 80)
  if (type === 'error') return stripActivityText(items[0]?.text || 'error', 160)
  if (type === 'user' || type === 'assistant') return stripActivityText(items[0]?.text || '', 160)
  return stripActivityText(items[0]?.text || type, 80)
}

export function groupActivity(items, opts) {
  const groups = []
  const list = Array.isArray(items) ? items : []
  for (const item of list) {
    if (!item || item.kind === 'step') continue
    const type = classify(item)
    const last = groups[groups.length - 1]
    if (last && last.type === type && (type === 'commands' || type === 'edits')) {
      last.items.push(item)
      last.label = labelFor(type, last.items)
    } else {
      const next = { type, items: [item], label: '' }
      next.label = labelFor(type, next.items)
      groups.push(next)
    }
  }
  const density = takeActivityDensity(opts?.density)
  if (density !== 'compact') return groups
  const out = []
  for (const g of groups) {
    const last = out[out.length - 1]
    if (g.type === 'thought' && last && last.type === 'thought') {
      last.items.push(...g.items)
      last.label = `Thought · ${last.items.length}`
    } else {
      out.push(g)
    }
  }
  return out
}

export function takeActivityDensity(raw) {
  return raw === 'compact' || raw === 'spacious' || raw === 'comfortable' ? raw : 'comfortable'
}

export function foldMin(density) {
  const d = takeActivityDensity(density)
  if (d === 'spacious') return 999
  if (d === 'compact') return 2
  return 3
}

export function formatAgo(ts, now) {
  const s = Math.max(0, Math.floor((Number(now) - Number(ts)) / 1000) || 0)
  if (s < 45) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export function parseReviewHunks(text) {
  const out = []
  const seen = new Set()
  for (const raw of String(text ?? '').split('\n')) {
    const line = stripActivityText(raw, 200)
    if (!line) continue
    const m = line.match(/([\w][\w./-]{0,118}\.\w{1,8})/)
    let path = ''
    if (m) {
      const p = m[1].replace(/^\.\//, '')
      if (!p.includes('..') && !p.startsWith('/') && !p.includes('\\')) path = p
    }
    const key = `${path}|${line}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ path, line })
    if (out.length >= 24) break
  }
  return out
}

export function laneBuckets(rows) {
  const running = []
  const done = []
  const error = []
  const src = Array.isArray(rows) ? rows : []
  for (const r of src) {
    const name = toolCallName(r?.name) || stripActivityText(r?.name, 40)
    if (!name) continue
    const status = r?.status === 'error' ? 'error' : r?.status === 'running' ? 'running' : 'done'
    const tokens = publicTokens(r?.tokens)
    const row = {
      id: toolCallName(r?.id) || name,
      name,
      status,
      started: Number(r?.started) || 0,
      ended: Number(r?.ended) || 0,
      tokens
    }
    if (status === 'running') running.push(row)
    else if (status === 'error') error.push(row)
    else done.push(row)
  }
  return { running, done, error }
}

export function formatPublicTokens(n) {
  const x = Math.trunc(Number(n))
  if (!Number.isFinite(x) || x < 1 || x > 1e9) return ''
  if (x < 1000) return String(x)
  if (x < 1_000_000) {
    const k = x / 1000
    if (k < 10) {
      const t = (Math.round(k * 10) / 10).toFixed(1)
      return t.endsWith('.0') ? `${Math.round(k)}k` : `${t}k`
    }
    return `${Math.round(k)}k`
  }
  const m = x / 1e6
  const t = (Math.round(m * 10) / 10).toFixed(1)
  return t.endsWith('.0') ? `${Math.round(m)}M` : `${t}M`
}

export function publicTokens(raw) {
  const s = String(raw ?? '').trim()
  if (/^\d{1,9}$/.test(s)) {
    const n = Number(s)
    if (n < 1 || n > 1e9) return ''
    if (n < 1000) return String(n)
    return formatPublicTokens(n)
  }
  if (/^\d{1,4}(?:\.\d)?[kM]$/.test(s)) return s
  if (/^\d{1,6}k$/.test(s)) return s
  return ''
}

export function parsePublicTokens(raw) {
  const s = publicTokens(raw)
  if (!s) return 0
  if (/^\d+$/.test(s)) return Math.trunc(Number(s)) || 0
  const m = s.match(/^(\d{1,4}(?:\.\d)?)([kM])$/) || s.match(/^(\d{1,6})(k)$/)
  if (!m) return 0
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 0) return 0
  if (m[2] === 'M') return Math.min(1e9, Math.round(n * 1e6))
  return Math.min(1e9, Math.round(n * 1000))
}

export function takeSseUsage(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return 0
  const u = json.usage
  if (u && typeof u === 'object' && !Array.isArray(u)) {
    const total = Math.trunc(Number(u.total_tokens))
    if (Number.isFinite(total) && total >= 1 && total <= 1e9) return total
    const p = Math.max(0, Math.trunc(Number(u.prompt_tokens)) || 0)
    const c = Math.max(0, Math.trunc(Number(u.completion_tokens)) || 0)
    const sum = p + c
    if (sum >= 1 && sum <= 1e9) return sum
  }
  const t = json.timings
  if (t && typeof t === 'object' && !Array.isArray(t)) {
    const p = Math.max(0, Math.trunc(Number(t.prompt_n)) || 0)
    const pred = Math.max(0, Math.trunc(Number(t.predicted_n)) || 0)
    const n = p + pred
    if (n >= 1 && n <= 1e9) return n
  }
  return 0
}

export function takeUsageTotal(raw) {
  if (typeof raw === 'number') {
    const n = Math.trunc(raw)
    return Number.isFinite(n) && n >= 1 && n <= 1e9 ? n : 0
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 0
  const direct = Math.trunc(Number(raw.total))
  if (Number.isFinite(direct) && direct >= 1 && direct <= 1e9) return direct
  return takeSseUsage({ usage: raw })
}

export function lastForgeStep(items) {
  let step = ''
  const list = Array.isArray(items) ? items : []
  for (const it of list) {
    if (it && it.kind === 'step' && FORGE_STEPS.includes(it.step)) step = it.step
  }
  return step
}

export function workflowForgeStep(log, wf) {
  const fromLog = lastForgeStep(log)
  if (fromLog) return fromLog
  const step = wf && typeof wf === 'object' && !Array.isArray(wf) ? wf.step : ''
  return FORGE_STEPS.includes(step) ? step : ''
}

/** True when the desktop listener already owns this rid (foreign chunks must not double-fold). */
export function desktopOwnsAgentChunk(runId, rid, jobSource) {
  const a = workflowId(runId)
  const b = workflowId(rid)
  return Boolean(a && b && a === b && jobSource !== 'telegram')
}

export function forgePhaseIndex(step) {
  const i = FORGE_STEPS.indexOf(step)
  return i < 0 ? 0 : i
}

export function formatDuration(ms) {
  const s = Math.max(0, Math.floor(Number(ms) / 1000) || 0)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return `${h}h ${m}m ${sec}s`
  if (m) return `${m}m ${sec}s`
  return `${sec}s`
}

export function countRunningTasks(p) {
  const sub = Math.max(0, Number(p?.subRunning) || 0)
  const cloud = Math.max(0, Number(p?.cloudRunning) || 0)
  const queue = Math.max(0, Number(p?.queueLen) || 0)
  const pty = Math.max(0, Number(p?.ptyCount) || 0)
  let n = sub + cloud + queue
  if (p?.busy) n += 1
  else if (p?.waitingShell) n += 1
  if (pty > 0) n += 1
  return n
}

export function sessionPreview(log) {
  const list = Array.isArray(log) ? log : []
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i]
    if (it && it.kind === 'user' && it.text) return stripActivityText(it.text, 48)
  }
  return ''
}

export const EFFORT_LABELS = ['Faster', 'Fast', 'Normal', 'Smarter', 'Max', 'Ultracode']

export function sessionTitle(raw) {
  return stripActivityText(raw, 80) || 'New agent'
}

export function chatLink(id) {
  const s = String(id ?? '').trim()
  if (!/^[\w.-]{1,64}$/.test(s) || s.includes('..')) return ''
  return `homeai://chat/${s}`
}

export function projectTag(ws) {
  const base = String(ws ?? '')
    .split(/[/\\]/)
    .filter(Boolean)
    .pop() || 'Hex AI'
  const stripped = stripActivityText(base, 24)
  if (/^home ai$/i.test(stripped)) return 'Hex AI'
  return (stripped || 'Hex AI').slice(0, 12)
}

export function takeEffort(n) {
  const i = Math.trunc(Number(n))
  if (!Number.isFinite(i)) return 2
  return Math.min(5, Math.max(0, i))
}

export function effortLine(n) {
  return `Effort: ${EFFORT_LABELS[takeEffort(n)]}.`
}

export function filterTranscript(groups, view) {
  const list = Array.isArray(groups) ? groups : []
  const v = String(view || 'normal')
  if (v === 'summary') return []
  if (v === 'thinking') {
    return list.filter(
      (g) => g && (g.type === 'thought' || g.type === 'user' || g.type === 'assistant' || g.type === 'error')
    )
  }
  return list
}

export function splitHuntVerify(rows) {
  const hunt = []
  const verify = []
  const src = Array.isArray(rows) ? rows : []
  for (const r of src) {
    const name = toolCallName(r?.name) || stripActivityText(r?.name, 40)
    if (!name) continue
    const status = r?.status === 'error' ? 'error' : r?.status === 'running' ? 'running' : 'done'
    const row = {
      id: toolCallName(r?.id) || name,
      name,
      status,
      started: Number(r?.started) || 0,
      ended: Number(r?.ended) || 0,
      tokens: publicTokens(r?.tokens)
    }
    if (/verify|test_run|review/i.test(name)) verify.push(row)
    else hunt.push(row)
  }
  return { hunt, verify }
}

/** Exclusive bible pills: design | cowork | code. Second arg must be boolean true (layoutMode strings are not cowork). */
export function chromeRoute(activity, cowork) {
  if (String(activity || '') === 'design') return 'design'
  if (cowork === true) return 'cowork'
  return 'code'
}

export function thinkPick(docs) {
  const src = Array.isArray(docs) ? docs : []
  const ok = []
  for (const d of src) {
    const status = String(d?.status || '')
    if (status !== 'ready' && status !== 'implementing') continue
    const path = String(d?.path || '')
    if (!path || path.includes('..') || path.includes('<') || path.includes('>') || path.includes('\\')) continue
    if (!/(?:^|\/)RAG\/plans\/[\w.-]+\.think\.md$/.test(path.replace(/\\/g, '/'))) continue
    const files = Array.isArray(d?.files)
      ? d.files
          .filter((f) => typeof f === 'string' && f && !f.includes('..') && !f.includes('<') && !String(f).startsWith('/'))
          .slice(0, 12)
          .map((f) => stripActivityText(f, 80))
      : []
    ok.push({
      path: path.slice(0, 200),
      status,
      title: stripActivityText(d?.title, 80),
      files
    })
  }
  return ok.find((x) => x.status === 'ready') || ok[0] || null
}

export function lastForgeError(items) {
  const src = Array.isArray(items) ? items : []
  for (let i = src.length - 1; i >= 0; i--) {
    const it = src[i]
    if (!it || typeof it !== 'object') continue
    if (it.kind === 'error' || it.type === 'error') {
      const t = stripActivityText(it.text || it.error || '', 160)
      return t || 'forge error'
    }
  }
  return ''
}

/** True when the newest meaningful log row is an error (later assistant/done clears it). */
export function forgeIsFault(items) {
  const src = Array.isArray(items) ? items : []
  for (let i = src.length - 1; i >= 0; i--) {
    const it = src[i]
    if (!it || typeof it !== 'object') continue
    if (it.kind === 'error' || it.type === 'error') return true
    if (it.kind === 'assistant' || it.kind === 'user' || it.type === 'done' || it.type === 'text') return false
  }
  return false
}

export const GO_TABS = ['session', 'mode', 'stack', 'skills']

export function takeGoTab(raw) {
  const s = String(raw || '')
  return GO_TABS.includes(s) ? s : null
}

export function publicSkillPeek(rows) {
  const out = []
  const seen = new Set()
  const src = Array.isArray(rows) ? rows : []
  for (const r of src) {
    const slash = String(r?.slash || r?.name || '')
      .replace(/^\/+/, '')
      .replace(/[^\w.-]/g, '')
      .slice(0, 40)
    if (!slash || slash.includes('..') || seen.has(slash)) continue
    seen.add(slash)
    out.push({
      slash,
      name: stripActivityText(r?.name || slash, 40),
      hint: stripActivityText(r?.description || r?.preview, 80)
    })
    if (out.length >= 24) break
  }
  return out
}

export function publicStackPeek(rows) {
  const out = []
  const seen = new Set()
  const src = Array.isArray(rows) ? rows : []
  for (const r of src) {
    const raw = String(typeof r === 'string' ? r : r?.name || r?.id || '')
    const name = toolCallName(raw)
    if (!name || name !== raw.trim() || seen.has(name)) continue
    seen.add(name)
    out.push({ name })
    if (out.length >= 32) break
  }
  return out
}

export function phasePips(done, total, cap = 8, running = 0) {
  const n = Math.min(Math.max(1, Math.trunc(Number(cap)) || 8), 16)
  const tot = Math.max(1, Math.min(n, Math.trunc(Number(total)) || 1))
  const d = Math.max(0, Math.min(tot, Math.trunc(Number(done)) || 0))
  const run = Number(running) > 0 && d < tot
  const out = []
  for (let i = 0; i < tot; i++) {
    if (i < d) out.push('on')
    else if (run && i === d) out.push('run')
    else out.push('off')
  }
  return out
}

export function toolCallName(raw) {
  const s = String(raw ?? '')
    .replace(/[<>]/g, '')
    .trim()
  return /^[\w.-]{1,64}$/.test(s) ? s : null
}

export function publicToolCall(call) {
  const name = toolCallName(call?.name)
  if (!name) return null
  const id = toolCallName(call?.id) || name
  return { id, name, arguments: {} }
}

export function workflowId(raw) {
  let s = String(raw ?? '').trim()
  if (s.startsWith('wf_')) s = s.slice(3)
  const id = toolCallName(s)
  if (!id || id.includes('..')) return ''
  return `wf_${id}`.slice(0, 72)
}

export function takeWorkflowModel(raw) {
  const s = String(raw ?? '').trim()
  if (s === 'local' || s === 'local 2B' || /^local\s*2b$/i.test(s)) return 'local 2B'
  if (s === 'openai' || s === 'OpenAI') return 'OpenAI'
  if (s === 'openrouter' || s === 'OpenRouter') return 'OpenRouter'
  if (s === 'cursor' || s === 'Cursor cloud') return 'Cursor cloud'
  if (s === 'coder') return 'coder'
  return ''
}

export function takeWorkflowLane(raw, name, step, criticLive) {
  if (raw === 'hunt' || raw === 'verify' || raw === 'critic' || raw === 'trust') return raw
  const n = toolCallName(name) || ''
  if (n === 'auto-review' || n === 'trust') return 'trust'
  if (n === 'critic') return 'critic'
  if (criticLive === true && (step === 'verify' || step === 'remember')) return 'critic'
  if (/verify|test_run|review/i.test(n)) return 'verify'
  return 'hunt'
}

export function emptyWorkflow() {
  return {
    id: '',
    status: 'running',
    title: '',
    description: '',
    model: '',
    started: 0,
    ended: 0,
    tokens: '',
    tokensKind: '',
    usageTotal: 0,
    pendingUsage: 0,
    criticSkipped: false,
    criticLive: false,
    step: '',
    agents: [],
    fleet: ''
  }
}

function jailAgent(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null
  const name = toolCallName(a.name)
  if (!name) return null
  const id = toolCallName(a.id) || name
  const status = a.status === 'error' ? 'error' : a.status === 'running' ? 'running' : 'done'
  const lane = a.lane === 'verify' || a.lane === 'critic' || a.lane === 'trust' ? a.lane : 'hunt'
  const started = Math.max(0, Math.trunc(Number(a.started)) || 0)
  const ended = Math.max(0, Math.trunc(Number(a.ended)) || 0)
  return {
    id,
    name,
    lane,
    model: takeWorkflowModel(a.model),
    tokens: publicTokens(a.tokens),
    status,
    started,
    ended
  }
}

function cloneWf(prev) {
  const next = emptyWorkflow()
  if (!prev || typeof prev !== 'object' || Array.isArray(prev)) return next
  next.id = workflowId(prev.id)
  next.status =
    prev.status === 'done' || prev.status === 'error' || prev.status === 'stopped' ? prev.status : 'running'
  next.title = stripActivityText(prev.title, 80)
  next.description = stripActivityText(prev.description, 160)
  next.model = takeWorkflowModel(prev.model)
  next.started = Math.max(0, Math.trunc(Number(prev.started)) || 0)
  next.ended = Math.max(0, Math.trunc(Number(prev.ended)) || 0)
  next.tokens = publicTokens(prev.tokens)
  next.tokensKind = prev.tokensKind === 'usage' || prev.tokensKind === 'context' ? prev.tokensKind : ''
  const usage = Math.trunc(Number(prev.usageTotal)) || 0
  next.usageTotal = usage >= 1 && usage <= 1e9 ? usage : 0
  const pending = Math.trunc(Number(prev.pendingUsage)) || 0
  next.pendingUsage = pending >= 1 && pending <= 1e9 ? pending : 0
  next.criticSkipped = prev.criticSkipped === true
  next.criticLive = prev.criticLive === true
  next.step = FORGE_STEPS.includes(prev.step) ? prev.step : ''
  next.fleet = stripActivityText(prev.fleet, 120)
  const agents = Array.isArray(prev.agents) ? prev.agents : []
  for (const a of agents) {
    const row = jailAgent(a)
    if (row) next.agents.push(row)
    if (next.agents.length >= 64) break
  }
  return next
}

function upsertAgent(next, row, now) {
  const jailed = jailAgent({ ...row, started: row.started || now, status: row.status || 'running' })
  if (!jailed) return
  const agents = next.agents
  let hit =
    agents.find((a) => a.id === jailed.id && a.status === 'running') ||
    agents.find((a) => a.name === jailed.name && a.status === 'running')
  if (!hit) {
    if (agents.length >= 64) return
    if (!jailed.model) jailed.model = next.model
    agents.push(jailed)
    return
  }
  if (row.lane === 'hunt' || row.lane === 'verify' || row.lane === 'critic' || row.lane === 'trust') hit.lane = row.lane
  const model = takeWorkflowModel(row.model)
  if (model) hit.model = model
  if (row.tokens) hit.tokens = publicTokens(row.tokens)
  if (row.status === 'done' || row.status === 'error') {
    hit.status = row.status
    hit.ended = now
  }
}

function completeAgentsNamed(next, name, status, now) {
  const n = toolCallName(name)
  if (!n) return
  const st = status === 'error' ? 'error' : 'done'
  for (let i = next.agents.length - 1; i >= 0; i--) {
    const a = next.agents[i]
    if (a.name === n && a.status === 'running') {
      a.status = st
      a.ended = now
      return
    }
  }
}

function finishOpenAgents(next, status, now) {
  const st = status === 'error' ? 'error' : 'done'
  for (const a of next.agents) {
    if (a.status === 'running') {
      a.status = st
      a.ended = now
    }
  }
}

function attachPendingUsage(next) {
  if (next.pendingUsage < 1) return
  const formatted = formatPublicTokens(next.pendingUsage)
  const running = next.agents.filter((a) => a.status === 'running')
  const target = running[running.length - 1]
  if (target && !target.tokens && formatted) {
    target.tokens = formatted
    next.pendingUsage = 0
  }
}

function retoken(next) {
  if (next.usageTotal >= 1) {
    next.tokens = formatPublicTokens(next.usageTotal)
    next.tokensKind = 'usage'
    return
  }
  if (next.tokensKind === 'context' && next.tokens) return
  let sum = 0
  for (const a of next.agents) sum += parsePublicTokens(a.tokens)
  if (sum >= 1) {
    next.tokens = formatPublicTokens(sum)
    next.tokensKind = 'usage'
  }
}

export function takeWorkflow(prev, chunk, meta) {
  const now = Math.max(0, Math.trunc(Number(meta?.now)) || Date.now())
  const want = workflowId(meta?.runId)
  const next = cloneWf(prev)
  if (next.id && want && next.id !== want) return cloneWf(prev)
  if (want) next.id = want
  const title = stripActivityText(meta?.title || meta?.task, 80)
  if (title) next.title = title
  const desc = stripActivityText(meta?.description || meta?.goal || meta?.task, 160)
  if (desc) next.description = desc
  const model = takeWorkflowModel(meta?.model)
  if (model) next.model = model
  if (!next.started) next.started = now
  if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) return next

  const sealed = next.status === 'stopped' || next.status === 'done' || next.status === 'error'
  if (sealed && chunk.type !== 'done' && chunk.type !== 'error') return next

  if (chunk.type === 'step' && FORGE_STEPS.includes(chunk.step)) {
    next.step = chunk.step
    if (chunk.step === 'remember' || chunk.step === 'verify') {
      /* critic row closes on remember */
    }
    if (chunk.step === 'remember') {
      completeAgentsNamed(next, 'critic', 'done', now)
      next.criticLive = false
    }
  }

  if (chunk.type === 'status' && typeof chunk.text === 'string') {
    const t = chunk.text
    if (t === 'stopped' || t.startsWith('stopped')) {
      next.status = 'stopped'
      next.ended = now
      finishOpenAgents(next, 'done', now)
      next.criticLive = false
    }
    if (
      /verify · skipped/.test(t) ||
      /verify · critic skipped/.test(t) ||
      /verify · files changed.*no critic tools/.test(t) ||
      /verify · no tools/.test(t)
    ) {
      next.criticSkipped = true
      next.criticLive = false
    }
    if (/verify · critic skipped/.test(t)) {
      completeAgentsNamed(next, 'critic', 'done', now)
    }
    if (/verify · critic pass/.test(t)) {
      next.criticLive = true
      next.criticSkipped = false
      upsertAgent(next, { id: 'critic', name: 'critic', lane: 'critic', status: 'running', model: next.model }, now)
    }
    const okm = t.match(/^(ok|err)\s+(\S+)/)
    if (okm) completeAgentsNamed(next, okm[2], okm[1] === 'ok' ? 'done' : 'error', now)
    if (/^auto-review ·/.test(t)) {
      const st = /· deny ·/.test(t) ? 'error' : 'done'
      upsertAgent(next, { id: 'auto-review', name: 'auto-review', lane: 'trust', status: st, model: next.model }, now)
    }
    if (/^fleet ·/.test(t)) {
      next.fleet = stripActivityText(t, 120)
      upsertAgent(next, { id: 'fleet', name: 'fleet', lane: 'hunt', status: 'done', model: next.model }, now)
    }
  }

  if (chunk.type === 'tool_call' && chunk.toolCall) {
    const pub = publicToolCall(chunk.toolCall)
    if (pub) {
      const lane = takeWorkflowLane(chunk.lane, pub.name, next.step, next.criticLive)
      upsertAgent(
        next,
        { id: pub.id, name: pub.name, lane, status: 'running', model: next.model },
        now
      )
      attachPendingUsage(next)
    }
  }

  if (chunk.type === 'usage' || chunk.usage) {
    const n = takeUsageTotal(chunk.usage)
    if (n) {
      next.usageTotal = Math.min(1e9, next.usageTotal + n)
      next.pendingUsage = Math.min(1e9, next.pendingUsage + n)
      attachPendingUsage(next)
    }
  }

  if (chunk.type === 'context' && chunk.context && next.usageTotal < 1) {
    const tot = Math.trunc(Number(chunk.context.total))
    if (Number.isFinite(tot) && tot >= 1 && tot <= 1e9) {
      next.tokens = formatPublicTokens(tot)
      next.tokensKind = 'context'
    }
  }

  if (chunk.type === 'error') {
    next.status = 'error'
    next.ended = now
    finishOpenAgents(next, 'error', now)
    next.criticLive = false
  }
  if (chunk.type === 'done') {
    if (next.status === 'running') next.status = 'done'
    next.ended = now
    finishOpenAgents(next, next.status === 'error' ? 'error' : 'done', now)
    next.criticLive = false
  }

  retoken(next)
  return next
}

export function reduceWorkflowChunks(chunks, meta) {
  let wf = emptyWorkflow()
  const list = Array.isArray(chunks) ? chunks : []
  for (const c of list) wf = takeWorkflow(wf, c, meta)
  return wf
}

export function splitWorkflowPhases(wf) {
  const hunt = []
  const verify = []
  const critic = []
  const trust = []
  const agents = Array.isArray(wf?.agents) ? wf.agents : []
  for (const a of agents) {
    const row = jailAgent(a)
    if (!row) continue
    if (row.lane === 'critic') critic.push(row)
    else if (row.lane === 'verify') verify.push(row)
    else if (row.lane === 'trust') trust.push(row)
    else hunt.push(row)
  }
  return { hunt, verify, critic, trust }
}

function phaseCount(rows, skipped) {
  const list = Array.isArray(rows) ? rows : []
  return {
    done: list.filter((r) => r.status === 'done').length,
    total: list.length,
    skipped: skipped === true
  }
}

export function workflowPhases(wf) {
  const { hunt, verify, critic, trust } = splitWorkflowPhases(wf)
  return {
    trust: phaseCount(trust, false),
    hunt: phaseCount(hunt, false),
    verify: phaseCount(verify, false),
    critic: phaseCount(critic, wf?.criticSkipped === true)
  }
}

export function workflowPhaseLine(wf) {
  const p = workflowPhases(wf)
  const bit = (label, x) => {
    if (x.skipped && x.total === 0) return `${label} skipped`
    return `${label} ${x.done}/${x.total}`
  }
  return `${bit('Trust', p.trust)} · ${bit('Hunt', p.hunt)} · ${bit('Verify', p.verify)} · ${bit('Critic', p.critic)}`
}

export function workflowTokenLabel(wf) {
  const s = publicTokens(wf?.tokens)
  if (!s) return ''
  if (wf?.tokensKind === 'context') return `${s} context`
  return s
}

export function workflowToSubagents(wf) {
  const agents = Array.isArray(wf?.agents) ? wf.agents : []
  const out = []
  for (const a of agents) {
    const row = jailAgent(a)
    if (!row) continue
    out.push({
      id: row.id,
      name: row.name,
      started: row.started,
      ended: row.ended || undefined,
      tokens: row.tokens,
      status: row.status,
      hint: row.status === 'error' ? 'failed' : row.status === 'running' ? 'running' : 'ok',
      lane: row.lane,
      model: row.model
    })
    if (out.length >= 64) break
  }
  return out
}

export function workflowPips(rows) {
  const list = Array.isArray(rows) ? rows : []
  const done = list.filter((r) => r.status === 'done').length
  const running = list.some((r) => r.status === 'running') ? 1 : 0
  const total = Math.max(list.length, 1)
  return phasePips(done, total, Math.min(16, total), running)
}

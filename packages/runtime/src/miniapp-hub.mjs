import { progressCard } from './telegram-progress.mjs'
import { lastForgeError, publicToolCall, reduceWorkflowChunks, stripActivityText, takeUsageTotal, workflowPhaseLine } from './activity.mjs'
import { lastAutoReviewLine } from './auto-review.mjs'
import { jobRunId } from './conversations.mjs'
import { redactCloudText } from './think.mjs'

const CAP = 80
const RUN_CAP = 16
const runs = new Map()

function safeChunk(chunk) {
  if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) return null
  if (chunk.type === 'tool_call' && chunk.toolCall) {
    const pub = publicToolCall(chunk.toolCall)
    if (!pub) return null
    const out = { type: 'tool_call', toolCall: pub }
    if (chunk.lane === 'hunt' || chunk.lane === 'verify' || chunk.lane === 'critic') out.lane = chunk.lane
    return out
  }
  const type = String(chunk.type || '')
  const out = { type }
  if (typeof chunk.text === 'string') out.text = chunk.text.slice(0, 4000)
  if (typeof chunk.step === 'string') out.step = chunk.step.slice(0, 32)
  if (typeof chunk.error === 'string') out.error = chunk.error.slice(0, 200)
  if (type === 'approval' && chunk.approval) out.tool = stripActivityText(chunk.approval.tool, 40)
  if (type === 'question' && chunk.question) {
    const q = Array.isArray(chunk.question.questions) ? chunk.question.questions[0] : null
    out.prompt = stripActivityText(q?.prompt, 80)
    const opts = Array.isArray(q?.options) ? q.options : []
    out.options = opts
      .slice(0, 8)
      .map((o) => stripActivityText(o, 40))
      .filter(Boolean)
  }
  if (typeof chunk.lane === 'string' && (chunk.lane === 'hunt' || chunk.lane === 'verify' || chunk.lane === 'critic')) {
    out.lane = chunk.lane
  }
  if (type === 'usage') {
    const n = takeUsageTotal(chunk.usage)
    if (!n) return null
    out.usage = { total: n }
  }
  return out
}

export function rememberMiniRun(id, meta = {}) {
  const runId = jobRunId(id)
  if (!runId) return null
  const cur = runs.get(runId) || { chunks: [], startedAt: Date.now(), title: 'job', mode: 'ask' }
  if (meta.title) cur.title = String(meta.title).slice(0, 80)
  if (meta.mode) cur.mode = String(meta.mode).slice(0, 16)
  if (meta.startedAt) cur.startedAt = Number(meta.startedAt) || cur.startedAt
  runs.set(runId, cur)
  while (runs.size > RUN_CAP) {
    const first = runs.keys().next().value
    if (!first) break
    runs.delete(first)
  }
  return cur
}

export function pushMiniChunk(id, chunk) {
  const runId = jobRunId(id)
  if (!runId) return
  const rec = runs.get(runId)
  if (!rec) return
  const safe = safeChunk(chunk)
  if (safe) rec.chunks.push(safe)
  if (rec.chunks.length > CAP) rec.chunks = rec.chunks.slice(-CAP)
  runs.set(runId, rec)
}

export function miniPulse(id) {
  const runId = jobRunId(id)
  if (!runId) return null
  const rec = runs.get(runId)
  if (!rec) return null
  const last = rec.chunks[rec.chunks.length - 1]
  let phase = ''
  let tool = ''
  const tools = []
  for (const c of rec.chunks) {
    if (!c || typeof c !== 'object') continue
    if (c.type === 'step' && c.step) phase = String(c.step).slice(0, 32)
    if (c.type === 'approval' && c.tool) tool = stripActivityText(c.tool, 40)
    if (c.type === 'tool_call' && c.toolCall) {
      const pub = publicToolCall(c.toolCall)
      if (pub) tools.push({ name: pub.name, status: 'running' })
    }
  }
  const wf = reduceWorkflowChunks(rec.chunks, { runId, task: rec.title, now: rec.startedAt })
  const phases = wf.agents.length || wf.criticSkipped ? workflowPhaseLine(wf) : ''
  return {
    runId,
    title: rec.title,
    mode: rec.mode,
    card: progressCard(rec.chunks, { title: rec.title, startedAt: rec.startedAt, mode: rec.mode }),
    done: last?.type === 'done' || last?.type === 'error',
    hold: last?.type === 'approval',
    ask: last?.type === 'question',
    prompt: last?.prompt || '',
    options: Array.isArray(last?.options) ? last.options : [],
    error: redactCloudText(lastForgeError(rec.chunks)),
    phase,
    tool,
    tools: tools.slice(-8),
    phases,
    workflow: wf,
    autoReviewLine: lastAutoReviewLine(rec.chunks)
  }
}

export function forgetMiniRun(id) {
  const runId = jobRunId(id)
  if (runId) runs.delete(runId)
}

export function lastMiniRunId() {
  const keys = [...runs.keys()]
  return keys[keys.length - 1] || ''
}

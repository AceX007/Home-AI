import { formatDuration, publicToolCall, lastForgeError, reduceWorkflowChunks, stripActivityText, workflowPhaseLine } from './activity.mjs'
import { doneKeyboard, formatConsole, liveKeyboard, phaseTrack, plainBlock, plainLine, safeCallbackId } from './telegram-chrome.mjs'
import { redactCloudText } from './think.mjs'

export { doneKeyboard, liveKeyboard }

export function progressCard(chunks, meta = {}) {
  const list = Array.isArray(chunks) ? chunks : []
  const title = plainLine(meta.title || 'job', 80)
  const status = []
  let phase = ''
  const tools = []
  let err = ''
  let done = false
  let text = ''
  for (const c of list) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) continue
    if (c.type === 'step' && c.step) phase = String(c.step)
    if (c.type === 'status' && c.text) status.push(plainLine(c.text, 120))
    if (c.type === 'tool_call') {
      const pub = publicToolCall(c.toolCall)
      if (pub) tools.push(pub.name)
    }
    if (c.type === 'error') err = lastForgeError(list) || plainLine(c.error || c.text, 160)
    if (c.type === 'done') done = true
    if (c.type === 'text' && c.text) text += String(c.text)
    if (c.type === 'approval') status.push(`hold · ${plainLine(c.approval?.tool, 40)}`)
    if (c.type === 'question') {
      status.push(`ask · ${plainLine(c.question?.questions?.[0]?.prompt, 80)}`)
    }
  }
  if (!err) err = lastForgeError(list)
  err = redactCloudText(err)
  const elapsed = meta.startedAt ? formatDuration((meta.now || Date.now()) - meta.startedAt) : ''
  const state = err ? 'FAULT' : done ? 'LANDED' : 'LIVE'
  const kicker = plainLine(meta.mode, 16) || 'JOB'
  const wf = reduceWorkflowChunks(list, { runId: meta.runId, task: title, now: meta.now || Date.now() })
  const phases = wf.agents.length || wf.criticSkipped ? workflowPhaseLine(wf) : ''
  const lines = [
    title,
    phase ? phaseTrack(phase) : '',
    phases,
    ...status.slice(-6),
    tools.length ? tools.slice(-8).join(' · ') : '',
    err,
    done ? plainBlock(text, 1400) : '',
    [elapsed, tools.length ? `${tools.length} tools` : '', plainLine(meta.provider, 16)]
      .filter(Boolean)
      .join(' · ')
  ]
  return formatConsole(lines, { state, kicker })
}

export function chatAckKeyboard(draftId) {
  const id = safeCallbackId(draftId)
  if (!id) return { inline_keyboard: [] }
  return {
    inline_keyboard: [
      [
        { text: 'Ship on PC', callback_data: `run:${id}` },
        { text: 'Deep pass', callback_data: `thk:${id}` },
        { text: 'Pin', callback_data: `tsk:${id}` }
      ]
    ]
  }
}

export function approvalKeyboard(runId) {
  const id = safeCallbackId(runId)
  if (!id) return { inline_keyboard: [] }
  return {
    inline_keyboard: [[{ text: 'Allow', callback_data: `ok:${id}` }, { text: 'Deny', callback_data: `no:${id}` }]]
  }
}

export function questionKeyboard(runId, options) {
  const id = safeCallbackId(runId)
  if (!id) return { inline_keyboard: [] }
  const rows = []
  const list = Array.isArray(options) ? options : []
  for (let i = 0; i < Math.min(list.length, 8); i++) {
    const label = stripActivityText(list[i], 32) || `opt${i}`
    rows.push([{ text: label, callback_data: `ans:${id}:${i}` }])
  }
  return { inline_keyboard: rows }
}

export function jobMarkup(id, chunks) {
  const list = Array.isArray(chunks) ? chunks : []
  let kind = 'live'
  for (const c of list) {
    if (!c || typeof c !== 'object') continue
    if (c.type === 'approval') kind = 'approval'
    if (c.type === 'question') kind = 'question'
    if (c.type === 'done' || c.type === 'error') kind = 'done'
  }
  if (kind === 'approval') return approvalKeyboard(id)
  if (kind === 'question') {
    const last = [...list].reverse().find((c) => c && c.type === 'question')
    return questionKeyboard(id, last?.question?.questions?.[0]?.options)
  }
  if (kind === 'done') return doneKeyboard(id)
  return liveKeyboard(id)
}

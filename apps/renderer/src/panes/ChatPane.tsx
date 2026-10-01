import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Check, Image as ImageIcon, MoreVertical, Paperclip, Share2, Square, X } from 'lucide-react'
import type { AgentMode, Checkpoint, ContextRing, ProviderId } from '@homeai/core'
import { AGENT_MODES } from '@homeai/core'
import {
  countRunningTasks,
  FORGE_STEPS,
  formatDuration,
  forgePhaseIndex,
  groupActivity,
  sessionPreview,
  sessionTitle,
  stripActivityText,
  foldMin,
  parseReviewHunks,
  chatLink,
  projectTag,
  chromeRoute,
  filterTranscript,
  formatAgo,
  thinkPick,
  EFFORT_LABELS,
  takeEffort,
  effortLine,
  takeMind,
  workflowForgeStep,
  toolCallName
} from '@homeai/runtime/browser'
import { lastAutoReviewLine } from '@homeai/runtime/browser'
import { useWorkbench, type LogItem } from '../store/useWorkbench'
import { StagePills } from './StagePills'
import { StageGo } from './StageGo'
import { StageTrustRow } from './StageTrustRow'
import { BackgroundTasks } from './BackgroundTasks'
import { HxEmpty } from '../layout/HxPage'
export { FocusTicker } from './StageFocus'

function lastUser(log: LogItem[]): string | undefined {
  for (let i = log.length - 1; i >= 0; i--) {
    const item = log[i]
    if (item.kind === 'user') return item.text
  }
  return undefined
}

function MiniDiff({
  path,
  name,
  before,
  after
}: {
  path: string
  name: string
  before: string
  after: string
}) {
  const [wide, setWide] = useState(false)
  const oldL = before.split('\n')
  const newL = after.split('\n')
  let start = 0
  const n = Math.max(oldL.length, newL.length)
  while (start < n && oldL[start] === newL[start]) start++
  const from = Math.max(0, start - 2)
  const cap = wide ? 120 : 24
  const rows: Array<{ t: '-' | '+' | ' '; s: string; ln: number }> = []
  let adds = 0
  let dels = 0
  for (let i = 0; i < n; i++) {
    if (oldL[i] !== newL[i]) {
      if (oldL[i] != null) dels++
      if (newL[i] != null) adds++
    }
  }
  for (let i = from; i < Math.min(n, from + cap); i++) {
    if (oldL[i] === newL[i]) rows.push({ t: ' ', s: oldL[i] ?? '', ln: i + 1 })
    else {
      if (oldL[i] != null) rows.push({ t: '-', s: oldL[i], ln: i + 1 })
      if (newL[i] != null) rows.push({ t: '+', s: newL[i], ln: i + 1 })
    }
  }
  const w = useWorkbench.getState()
  const potato = w.boot?.probe.visualTier === 'potato'
  return (
    <div className="trace-diff">
      <button className="diff-file" onClick={() => void w.openFile(path)}>
        # {name} +{adds} −{dels}
      </button>
      <div className="hunk-head">{`@@ -${from + 1} +${from + 1} @@`}</div>
      <pre className="mini-diff">
        {rows.map((r, i) => (
          <div key={i} className={r.t === '+' ? 'add' : r.t === '-' ? 'del' : ''} title={r.s}>
            <span className="ln">{r.ln}</span>
            {r.t}
            {r.s}
          </div>
        ))}
      </pre>
      <div className="diff-actions">
        <button className="keep-btn" onClick={() => void w.keepFile(path)}>
          Keep
        </button>
        <button className="ghost tiny" onClick={() => void w.undoFile(path)}>
          Undo
        </button>
        <button type="button" className="ghost tiny" onClick={() => setWide((v) => !v)}>
          {wide ? 'Fold' : 'Expand'}
        </button>
        {potato ? null : (
          <button
            className="ghost tiny"
            title="Open side-by-side"
            onClick={() => {
              void w.openFile(path)
              useWorkbench.setState({ reviewOpen: true })
              useWorkbench.getState().setActivity('files')
            }}
          >
            Side-by-side
          </button>
        )}
      </div>
    </div>
  )
}

function logToolAttr(item: LogItem): string | undefined {
  if ('tool' in item && item.tool) return toolCallName(item.tool) || undefined
  return undefined
}

function ActivityLine({
  item,
  waitingShell,
  lastWaitId,
  waitingUntil,
  now,
  onCheckpoint,
  duration
}: {
  item: LogItem
  waitingShell: boolean
  lastWaitId?: string
  waitingUntil: number
  now: number
  onCheckpoint: (cpId: string) => void
  duration?: string
}) {
  if (item.kind === 'step') return null
  if (item.kind === 'checkpoint') {
    return (
      <button type="button" className="cp-mark" onClick={() => onCheckpoint(item.cpId)}>
        checkpoint · {item.text}
        {item.files.length ? ` · ${item.files.length} files` : ''}
      </button>
    )
  }
  if (item.kind === 'diff') {
    return <MiniDiff path={item.path} name={item.text} before={item.before} after={item.after} />
  }
  if (item.kind === 'thought') {
    return <div className="trace-thought">{item.text}</div>
  }
  if (item.kind === 'wait') {
    const live = waitingShell && lastWaitId === item.id
    const done = !live && /^Waiting/i.test(item.text)
    return (
      <button
        type="button"
        className="trace-wait linkish"
        onClick={() => useWorkbench.setState({ termOpen: true, termPanel: 'shells' })}
      >
        {live ? formatWait(waitingUntil, now) : done ? 'Shell finished' : item.text}
      </button>
    )
  }
  if (item.kind === 'shell') {
    const tool = logToolAttr(item)
    return (
      <button
        type="button"
        className="shell-wrap"
        data-tool={tool}
        onClick={() => useWorkbench.setState({ termOpen: true, termPanel: 'shells' })}
      >
        {item.caption ? <div className="shell-cap">{item.caption}</div> : null}
        <pre className="shell-block">{item.text}</pre>
        {duration ? <span className="trace-dur">{duration}</span> : null}
      </button>
    )
  }
  if (item.kind === 'tool' || item.kind === 'status' || item.kind === 'edit') {
    const tool = logToolAttr(item)
    return (
      <div className="trace-tool" data-tool={tool}>
        {item.text}
        {duration ? <span className="trace-dur">{duration}</span> : null}
      </div>
    )
  }
  if (item.kind === 'assistant') {
    return (
      <div className="bubble assistant">
        <p className="hx-kicker">Hex AI</p>
        <p>{item.text}</p>
      </div>
    )
  }
  if (item.kind === 'user') {
    return (
      <div className="bubble user">
        <p className="hx-kicker">You</p>
        <p>{item.text}</p>
      </div>
    )
  }
  if (item.kind === 'error') {
    return (
      <div className="bubble error">
        <p className="hx-kicker">Error</p>
        <p>{item.text}</p>
      </div>
    )
  }
  return <div className={`bubble ${item.kind}`}>{item.text}</div>
}

function formatWait(until: number, now: number): string {
  const left = Math.max(0, Math.round((until - now) / 1000))
  const m = Math.floor(left / 60)
  const s = left % 60
  return `Waiting up to ${m}m ${s}s for shell`
}

function modeLabel(m: AgentMode): string {
  if (m === 'think') return 'Think'
  if (m === 'ask') return 'Ask'
  if (m === 'multitask') return 'Multitask'
  return m[0].toUpperCase() + m.slice(1)
}

function modeHint(m: AgentMode): string {
  if (m === 'think') return 'Local 2B gatherer. Writes RAG/plans/*.think.md only.'
  if (m === 'agent') return 'Edit the repo. Approvals still gate writes and net.'
  if (m === 'plan') return 'Human plan markdown. No product writes until you Build.'
  if (m === 'debug') return 'Hunt a failure with tools, then remember.'
  if (m === 'multitask') return 'Concurrent tool lanes in Background. Not a fourth product.'
  return 'Answers only. No writes.'
}

function toolDur(
  item: LogItem,
  rows: Array<{ name: string; started: number; ended?: number; status: string }>,
  now: number
): string | undefined {
  if (item.kind !== 'tool' && item.kind !== 'status' && item.kind !== 'edit' && item.kind !== 'shell')
    return undefined
  const name = String('text' in item ? item.text : '')
    .replace(/^run\s+/i, '')
    .split(/\s+/)[0]
  const hit = rows.find((a) => name.includes(a.name) || a.name === name)
  if (!hit?.started) return undefined
  const end = hit.ended || (hit.status === 'running' ? now : 0)
  if (!end) return undefined
  return formatDuration(end - hit.started)
}

function providerLabel(p: ProviderId): string {
  if (p === 'local') return 'local 2B'
  if (p === 'openai') return 'OpenAI'
  if (p === 'openrouter') return 'OpenRouter'
  return 'Cursor cloud'
}

const MODEL_ROWS: Array<{ id: ProviderId; label: string; hint: string }> = [
  { id: 'local', label: 'Local 2B', hint: '1' },
  { id: 'openai', label: 'OpenAI', hint: '2' },
  { id: 'openrouter', label: 'OpenRouter', hint: '3' },
  { id: 'cursor', label: 'Cursor cloud', hint: '4' }
]
type TranscriptView = 'normal' | 'thinking' | 'verbose' | 'summary'

function RingMeter({ ring }: { ring: ContextRing }) {
  const [open, setOpen] = useState(false)
  const parts: Array<[string, number]> = [
    ['sys', ring.system],
    ['tools', ring.tools],
    ['rules', ring.rules],
    ['skills', ring.skills],
    ['rag', ring.rag],
    ['mentions', ring.mentions],
    ['chat', ring.chat]
  ]
  const pct = ring.cap ? Math.min(100, Math.round((ring.total / ring.cap) * 100)) : 0
  return (
    <div className="ctx-ring-wrap">
      <button
        type="button"
        className="ctx-ring"
        onClick={() => setOpen((v) => !v)}
        title={`${ring.total} / ${ring.cap} tokens`}
      >
        <div className="ctx-bar">
          {parts.map(([k, v]) => (
            <span
              key={k}
              className={`ctx-seg ${k}`}
              style={{ width: `${ring.cap ? Math.max(0, (v / ring.cap) * 100) : 0}%` }}
            />
          ))}
        </div>
        <span className="ctx-pct">{pct}%</span>
      </button>
      {open ? (
        <div className="ctx-pop">
          <div className="ctx-pop-head">
            {ring.total} / {ring.cap} tokens
          </div>
          {parts.map(([k, v]) => (
            <div key={k} className="ctx-pop-row">
              <span className={`ctx-dot ${k}`} />
              <span>{k}</span>
              <span className="spacer" />
              <b>{v}</b>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function draftMentions(text: string): string[] {
  const out: string[] = []
  const re = /@([A-Za-z0-9_./:@-]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (!out.includes(m[1])) out.push(m[1])
  }
  return out
}

type CloudJob = { id: string; status: string; name: string; summary?: string }

function jobTone(status: string): 'ok' | 'err' | 'run' | 'wait' {
  const s = status.toLowerCase()
  if (/fail|error|cancel/.test(s)) return 'err'
  if (/done|complete|finish|success/.test(s)) return 'ok'
  if (/run|progress|active|creat/.test(s)) return 'run'
  return 'wait'
}

function cursorJobs(raw: unknown): CloudJob[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as Record<string, unknown>
  const arr = Array.isArray(obj.jobs)
    ? obj.jobs
    : Array.isArray(raw)
      ? raw
      : Array.isArray(obj.agents)
        ? obj.agents
        : Array.isArray(obj.data)
          ? obj.data
          : []
  return (arr as Array<Record<string, unknown>>)
    .map((j) => ({
      id: String(j.id ?? ''),
      status: String(j.status ?? 'unknown'),
      name: String(j.name ?? j.title ?? j.id ?? '').slice(0, 80),
      summary: typeof j.summary === 'string' ? j.summary.slice(0, 200) : ''
    }))
    .filter((j) => /^[\w.-]{1,80}$/.test(j.id))
    .slice(0, 50)
}

async function bytesToB64(buf: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buf)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

async function saveBlob(file: File): Promise<string> {
  const b64 = await bytesToB64(await file.arrayBuffer())
  return window.homeai.saveInbox({ name: file.name || 'paste.bin', base64: b64 })
}

export default function ChatPane() {
  const w = useWorkbench()
  const [text, setText] = useState('')
  const [mentions, setMentions] = useState<string[]>([])
  const [slash, setSlash] = useState<string[]>([])
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)
  const [answer, setAnswer] = useState('')
  const [now, setNow] = useState(Date.now())
  const [cpView, setCpView] = useState<Checkpoint | null>(null)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [jobsOpen, setJobsOpen] = useState(true)
  const [jobs, setJobs] = useState<CloudJob[]>([])
  const [jobsErr, setJobsErr] = useState('')
  const [jobsBusy, setJobsBusy] = useState(false)
  const [pinNode, setPinNode] = useState('')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [thinkDocs, setThinkDocs] = useState<Array<{ path: string; status: string; title: string; files?: string[] }>>([])
  const [sessQ, setSessQ] = useState('')
  const [effortOpen, setEffortOpen] = useState(false)
  const [reviewMenu, setReviewMenu] = useState(false)
  const [effort, setEffort] = useState(2)
  const [kebab, setKebab] = useState<string | null>(null)
  const [transOpen, setTransOpen] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptView>('normal')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [toast, setToast] = useState('')
  const [bgOpen, setBgOpen] = useState(false)
  const [bgWide, setBgWide] = useState(false)
  const [openIn, setOpenIn] = useState(false)
  const bgNudged = useRef(false)
  const kebabRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [w.log.length])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!kebab) return
    const onDown = (e: MouseEvent) => {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setKebab(null)
        setTransOpen(false)
        setOpenIn(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setKebab(null)
        setTransOpen(false)
        setOpenIn(false)
        return
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const st = useWorkbench.getState()
      const id = st.activeChat
      if (e.key === 'r' || e.key === 'R') {
        const hit = st.chats.find((c) => c.id === id)
        if (hit) {
          setRenameId(id)
          setRenameVal(hit.title)
          setKebab(null)
        }
      }
      if (e.key === 'c' || e.key === 'C') {
        const href = chatLink(id)
        if (href) void navigator.clipboard?.writeText(href)
        setToast(href ? 'Link copied' : 'No link')
        setKebab(null)
      }
      if (e.key === 'a' || e.key === 'A') {
        st.archiveChat(id)
        setKebab(null)
      }
      if (e.key === 'd' || e.key === 'D') {
        if (window.confirm('Delete this session?')) st.closeChat(id)
        setKebab(null)
      }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [kebab])

  useEffect(() => {
    if (!effortOpen && !reviewMenu) return
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setEffortOpen(false)
        setReviewMenu(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEffortOpen(false)
        setReviewMenu(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [effortOpen, reviewMenu])

  const refreshJobs = async (): Promise<boolean> => {
    setJobsBusy(true)
    try {
      const raw = await window.homeai.cursorList()
      setJobs(cursorJobs(raw))
      setJobsErr('')
      return true
    } catch (err) {
      setJobs([])
      const msg = err instanceof Error ? err.message : String(err)
      const missing = /no cursor api key/i.test(msg)
      setJobsErr(missing ? '' : msg)
      return !missing
    } finally {
      setJobsBusy(false)
    }
  }

  useEffect(() => {
    let stop = false
    let t = 0
    const loop = async () => {
      const keep = await refreshJobs()
      if (stop || !keep) return
      t = window.setTimeout(() => void loop(), 8000)
    }
    void loop()
    return () => {
      stop = true
      if (t) window.clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    let stop = false
    let timer = 0
    const load = () => {
      void window.homeai
        .thinkList()
        .then((rows) => {
          if (stop) return
          const list = Array.isArray(rows) ? rows : []
          const docs = list.slice(0, 8).map((x) => ({
            path: stripActivityText(String((x as { path?: string }).path ?? ''), 80),
            status: stripActivityText(String((x as { status?: string }).status ?? ''), 24),
            title: stripActivityText(String((x as { title?: string }).title ?? ''), 80),
            files: Array.isArray((x as { files?: string[] }).files)
              ? (x as { files: string[] }).files.slice(0, 12).map((f) => stripActivityText(f, 80))
              : []
          }))
          setThinkDocs(docs)
          useWorkbench.setState({ thinkHint: docs.some((d) => d.status === 'ready') ? 'ready' : docs[0]?.status || '' })
        })
        .catch(() => {
          if (stop) return
          setThinkDocs([])
          useWorkbench.setState({ thinkHint: '' })
        })
    }
    load()
    if (w.busy || w.agentMode === 'think') timer = window.setInterval(load, 4000)
    return () => {
      stop = true
      if (timer) window.clearInterval(timer)
    }
  }, [w.busy, w.agentMode])

  useEffect(() => {
    if (!w.waitingShell && !w.busy) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [w.waitingShell, w.busy])

  useEffect(() => {
    if (w.pending.length === 0) useWorkbench.setState({ reviewOpen: false })
  }, [w.pending.length])

  const submit = (forceSteer = false, stick = false) => {
    const t = text.trim()
    if (!t) return
    if (t.startsWith('/goal ')) {
      const g = t.slice(6)
      void window.homeai.setGoal(g)
      useWorkbench.setState({ goal: g })
      setText('')
      return
    }
    if (stick && t.startsWith('/')) {
      const name = t.slice(1).split(/\s+/)[0]?.replace(/!$/, '') ?? ''
      if (name && name !== 'goal') void w.pinSkill(name)
    }
    setText('')
    useWorkbench.setState({ modeMenu: false })
    const spoken = t.startsWith('/') ? t : `${t}\n${effortLine(effort)}`
    if (w.busy && forceSteer) w.steer(spoken)
    else if (w.busy) w.enqueue(spoken)
    else w.run(stick && spoken.startsWith('/') ? spoken.replace(/^\/([A-Za-z0-9_-]+)/, '/$1!') : spoken)
  }

  const setMind = (raw: string) => {
    const mind = takeMind(raw)
    if (!mind) return
    void window.homeai.profileSet({ defaultProvider: mind })
    useWorkbench.setState({ provider: mind })
  }

  const onChange = async (v: string) => {
    setText(v)
    if (v.startsWith('/') && !v.includes(' ')) {
      const q = v.slice(1).toLowerCase()
      setSlash(
        w.skills
          .filter((s) => !q || s.slash?.includes(q) || s.name.toLowerCase().includes(q))
          .slice(0, 8)
          .map((s) => s.slash || s.name)
      )
      setMentions([])
      return
    }
    setSlash([])
    const at = v.lastIndexOf('@')
    if (at >= 0 && !v.slice(at).includes(' ')) {
      const q = v.slice(at + 1)
      const specials = ['codebase', 'git', 'diff', 'Terminals', 'Chats', 'Browser']
      const hits = [
        ...specials.filter((s) => s.toLowerCase().includes(q.toLowerCase())),
        ...((await window.homeai.quickOpen(q)) as string[])
      ]
      setMentions(hits.slice(0, 10))
    } else setMentions([])
  }

  const runReview = async (depth: 'quick' | 'deep') => {
    setReviewMenu(false)
    setReviewBusy(true)
    try {
      const res = await window.homeai.agentReview(depth)
      useWorkbench.setState({ reviewText: res.text })
    } catch (err) {
      useWorkbench.setState({ reviewText: err instanceof Error ? err.message : String(err) })
    } finally {
      setReviewBusy(false)
    }
  }

  const attach = async (file: File | null) => {
    if (!file) return
    const dest = await saveBlob(file)
    setText((cur) => `${cur}${cur && !cur.endsWith(' ') ? ' ' : ''}@${dest} `)
    inputRef.current?.focus()
  }

  const lastWaitId = [...w.log].reverse().find((x) => x.kind === 'wait')?.id
  const fileN = w.pending.length || w.gitDirty.size
  const dens = w.busy && w.density !== 'spacious' ? 'compact' : w.density
  const groups = useMemo(() => groupActivity(w.log, { density: dens }), [w.log, dens])
  const foldAt = foldMin(dens)
  const shownGroups = useMemo(() => filterTranscript(groups, transcript), [groups, transcript])
  const phase = workflowForgeStep(w.log, w.workflow)
  const phaseIdx = forgePhaseIndex(phase)
  const cloudRunning = jobs.filter((j) => jobTone(j.status) === 'run').length
  const runningN = countRunningTasks({
    busy: w.busy,
    waitingShell: w.waitingShell,
    subRunning: w.subagents.filter((a) => a.status === 'running').length,
    cloudRunning,
    ptyCount: w.ptyCount,
    queueLen: w.queue.length
  })
  const thinkReady = thinkPick(thinkDocs)
  const llm = w.boot?.llm
  const runMs = w.busy || w.waitingShell ? now - (w.thoughtAt || now) : 0
  const forgeLive = Boolean(w.busy || w.waitingShell)
  const visibleChats = useMemo(() => {
    const q = sessQ.trim().toLowerCase()
    return w.chats
      .filter((c) => {
        if (c.archived) return false
        if (!q) return true
        return c.title.toLowerCase().includes(q) || sessionPreview(c.log).toLowerCase().includes(q)
      })
      .slice()
      .sort((a, b) => Number(w.pinnedChats.includes(b.id)) - Number(w.pinnedChats.includes(a.id)))
  }, [w.chats, sessQ, w.pinnedChats])

  useEffect(() => {
    if (runningN > 0 && shownGroups.length === 0 && !bgNudged.current) {
      bgNudged.current = true
      setBgOpen(true)
    }
  }, [runningN, shownGroups.length])

  useEffect(() => {
    const name = toolCallName(w.focusTool)
    if (!name) return
    for (const g of shownGroups) {
      const hit = g.items.some((it) => {
        const t = 'tool' in it ? String(it.tool || '') : ''
        const text = typeof it.text === 'string' ? it.text : ''
        return t === name || text.includes(name)
      })
      if (hit) {
        const gid = g.items[0]?.id
        if (gid) setOpenGroups((m) => ({ ...m, [gid]: true }))
        break
      }
    }
    const frame = window.requestAnimationFrame(() => {
      const el = logRef.current?.querySelector(`[data-tool="${name}"]`)
      el?.scrollIntoView({ block: 'nearest' })
      if (useWorkbench.getState().focusTool) useWorkbench.setState({ focusTool: undefined })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [w.focusTool, shownGroups])
  const activeSess = w.chats.find((c) => c.id === w.activeChat && !c.archived)
  const proj = projectTag(w.boot?.workspace)
  const openCp = async (cpId: string) => {
    const full = (await window.homeai.checkpointGet(cpId)) as Checkpoint | null
    setCpView(full)
  }

  const openJob = (id: string) => {
    void window.homeai
      .cursorGet(id)
      .then((d) => {
        const job = d as CloudJob
        const line = `cloud ${job.id} · ${job.status} · ${job.name}${job.summary ? ` · ${job.summary}` : ''}`
        useWorkbench.setState({
          log: [
            ...useWorkbench.getState().log,
            { id: Math.random().toString(36).slice(2, 10), kind: 'status', text: line.slice(0, 240) }
          ]
        })
      })
      .catch((err) => {
        useWorkbench.setState({
          log: [
            ...useWorkbench.getState().log,
            { id: Math.random().toString(36).slice(2, 10), kind: 'error', text: String(err) }
          ]
        })
      })
  }

  const finishAsk = async (text: string) => {
    if (pinNode && w.question) {
      try {
        const map = (await window.homeai.mapPin({
          nodeId: pinNode,
          title: (w.question.questions[0]?.prompt ?? text).slice(0, 80)
        })) as { nodes: typeof w.map.nodes; edges: typeof w.map.edges }
        useWorkbench.setState({ map })
      } catch {
        /* map pin optional */
      }
    }
    if (w.runId) window.homeai.answerAgent(w.runId, text)
    setAnswer('')
    setPinNode('')
    useWorkbench.setState({ question: undefined })
    void w.refreshGrounds()
  }

  const arLine = lastAutoReviewLine(w.log)

  return (
    <div className="agents-win" data-density={dens} data-route={chromeRoute(w.activity, w.cowork)}>
      <div className={`agents-body ${bgOpen ? '' : 'no-bg'} ${bgWide && bgOpen ? 'bg-wide' : ''}`}>
        <aside className="agents-sessions">
          <StagePills />
          <StageGo
            onUseSkill={(slash) => {
              setText(`/${slash} `)
              setSlash([])
              inputRef.current?.focus()
            }}
          />
          <div className="sess-actions">
            <button type="button" onClick={() => w.setActivity('library')}>
              Artifacts
            </button>
            <button
              type="button"
              onClick={() => {
                setKebab(kebab ? null : w.activeChat)
                setTransOpen(false)
                setOpenIn(false)
              }}
            >
              More
            </button>
          </div>
          <input
            className="sess-filter"
            value={sessQ}
            placeholder="Filter sessions"
            onChange={(e) => setSessQ(e.target.value.replace(/[<>]/g, '').slice(0, 80))}
          />
          <div className="sess-proj">
            <span>{proj}</span>
          </div>
          {visibleChats.length === 0 ? (
            <HxEmpty
              compact
              title={sessQ.trim() ? 'No matching sessions' : 'No sessions yet'}
              body={
                sessQ.trim()
                  ? 'Nothing matches that filter. The query stays text, not HTML.'
                  : 'New starts a session. Filter applies when you have more than one.'
              }
            />
          ) : null}
          {visibleChats.map((c) => {
            const preview = sessionPreview(c.log)
            const live = w.busy && c.id === w.activeChat
            const ts = (w.boot?.threads ?? []).find((t) => t.id === c.id)?.updatedAt
            return (
              <div key={c.id} className={`sess-item ${c.id === w.activeChat ? 'active' : ''}`}>
                {renameId === c.id ? (
                  <input
                    className="sess-rename"
                    value={renameVal}
                    maxLength={80}
                    autoFocus
                    onChange={(e) => setRenameVal(e.target.value.slice(0, 80))}
                    onBlur={() => {
                      w.renameChat(c.id, renameVal)
                      setRenameId(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        w.renameChat(c.id, renameVal)
                        setRenameId(null)
                      }
                      if (e.key === 'Escape') setRenameId(null)
                    }}
                  />
                ) : (
                  <div className="sess-row-wrap">
                    <button type="button" className="sess-row" onClick={() => w.selectChat(c.id)}>
                      <span className="sess-title">
                        {live ? <span className="sess-dot" /> : null}
                        {c.source === 'telegram' || c.source === 'both' ? <span className="sess-src">TG</span> : null}
                        {sessionTitle(c.title)}
                        {ts ? <span className="sess-ago">{formatAgo(ts, now)}</span> : null}
                      </span>
                      {preview ? <span className="sess-preview">{preview}</span> : null}
                    </button>
                    <button
                      type="button"
                      className="ghost tiny"
                      title={w.pinnedChats.includes(c.id) ? 'Unpin' : 'Pin'}
                      onClick={() => {
                        const on = w.pinnedChats.includes(c.id)
                        const next = on ? w.pinnedChats.filter((id) => id !== c.id) : [...w.pinnedChats, c.id].slice(0, 24)
                        useWorkbench.setState({ pinnedChats: next })
                      }}
                    >
                      {w.pinnedChats.includes(c.id) ? '★' : '☆'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </aside>
        <div className="agents-center">
          <div className="chat-head">
            <div className="chat-head-titles">
              <p className="hx-kicker">Hex AI</p>
              {renameId === w.activeChat ? (
                <input
                  className="sess-rename"
                  value={renameVal}
                  maxLength={80}
                  autoFocus
                  onChange={(e) => setRenameVal(e.target.value.slice(0, 80))}
                  onBlur={() => {
                    w.renameChat(w.activeChat, renameVal)
                    setRenameId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      w.renameChat(w.activeChat, renameVal)
                      setRenameId(null)
                    }
                    if (e.key === 'Escape') setRenameId(null)
                  }}
                />
              ) : (
                <h2>{sessionTitle(activeSess?.title)}</h2>
              )}
            </div>
            <div className="chat-head-actions" ref={kebabRef}>
              <button
                type="button"
                className="ghost tiny"
                title="Copy session link"
                onClick={() => {
                  const href = chatLink(w.activeChat)
                  if (href) void navigator.clipboard?.writeText(href)
                  setToast(href ? 'Link copied' : 'No link')
                }}
              >
                <Share2 size={14} />
              </button>
              <button
                type="button"
                className="sess-kebab"
                aria-label="Session menu"
                onClick={() => {
                  setKebab(kebab ? null : w.activeChat)
                  setTransOpen(false)
                  setOpenIn(false)
                }}
              >
                <MoreVertical size={14} />
              </button>
              {kebab ? (
                <div className="sess-menu">
                  <button type="button" onClick={() => { w.setActivity('library'); setKebab(null) }}>
                    Artifacts
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBgOpen((v) => !v)
                      setKebab(null)
                    }}
                  >
                    Background tasks{bgOpen ? ' ✓' : ''}
                  </button>
                  <div className="sess-sub">
                    <button type="button" onClick={() => setOpenIn((v) => !v)}>
                      Open in
                    </button>
                    {openIn ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setToast('stays in this window')
                            setOpenIn(false)
                            setKebab(null)
                          }}
                        >
                          This window
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            useWorkbench.setState({ layoutMode: 'stage', chatOpen: true })
                            setOpenIn(false)
                            setKebab(null)
                          }}
                        >
                          Agents Stage
                        </button>
                      </>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRenameId(w.activeChat)
                      setRenameVal(activeSess?.title || '')
                      setKebab(null)
                    }}
                  >
                    Rename
                  </button>
                  <div className="sess-sub">
                    <button type="button" onClick={() => setTransOpen((v) => !v)}>
                      Transcript view
                    </button>
                    {transOpen
                      ? (['normal', 'thinking', 'verbose', 'summary'] as const).map((k) => (
                          <button
                            key={k}
                            type="button"
                            className={transcript === k ? 'on' : ''}
                            onClick={() => {
                              setTranscript(k)
                              setTransOpen(false)
                              setKebab(null)
                            }}
                          >
                            {transcript === k ? '✓ ' : ''}
                            {k[0].toUpperCase() + k.slice(1)}
                          </button>
                        ))
                      : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const href = chatLink(w.activeChat)
                      if (href) void navigator.clipboard?.writeText(href)
                      setToast(href ? 'Link copied' : 'No link')
                      setKebab(null)
                    }}
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      w.archiveChat(w.activeChat)
                      setKebab(null)
                    }}
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      if (window.confirm('Delete this session?')) w.closeChat(w.activeChat)
                      setKebab(null)
                    }}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="agent-hero">
            <div className="hero-route">
              <button
                type="button"
                className={w.provider === 'local' || w.agentMode === 'think' ? 'on' : ''}
                onClick={() => setMind('local')}
              >
                {w.agentMode === 'think' ? 'Think · local 2B' : 'Local 2B'}
              </button>
              <button
                type="button"
                className={w.provider !== 'local' && w.agentMode !== 'think' ? 'on' : ''}
                disabled={w.agentMode === 'think'}
                title={w.agentMode === 'think' ? 'Think always runs local. Implement uses cloud if a key exists.' : 'Cloud'}
                onClick={() => setMind(w.provider === 'local' ? 'openrouter' : w.provider)}
              >
                Cloud
              </button>
              {w.busy ? <span className="live-pill">{w.jobSource === 'telegram' ? 'Telegram' : 'Live'}</span> : null}
              {w.telegramOnline && !w.busy ? (
                <button type="button" className="live-pill" onClick={() => w.setActivity('telegram')}>
                  TG ready
                </button>
              ) : null}
              {w.customSkill ? (
                <span className="custom-badge">
                  Custom · /{w.customSkill}
                  <button type="button" className="tab-x" title="Dismiss custom mode" onClick={() => void w.clearSkill()}>
                    ×
                  </button>
                </span>
              ) : null}
              {w.goal ? (
                <span className="custom-badge">
                  Goal · {stripActivityText(w.goal, 32)}
                  <button
                    type="button"
                    className="tab-x"
                    title="Clear goal"
                    onClick={() => {
                      void window.homeai.setGoal('')
                      useWorkbench.setState({ goal: '' })
                    }}
                  >
                    ×
                  </button>
                </span>
              ) : null}
              <label className="dens-ctrl">
                Density
                <select
                  value={w.density}
                  title="Conversation density"
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === 'compact' || v === 'comfortable' || v === 'spacious') {
                      useWorkbench.setState({ density: v })
                    }
                  }}
                >
                  <option value="compact">compact</option>
                  <option value="comfortable">comfortable</option>
                  <option value="spacious">spacious</option>
                </select>
              </label>
            </div>
            {w.ring ? <RingMeter ring={w.ring} /> : null}
          </div>
          {forgeLive && !thinkReady ? (
          <div className="live-rail">
            <span>Forge {phase || 'live'}</span>
            {w.pending.length ? <span>{w.pending.length} files</span> : null}
          </div>
          ) : null}
          {!forgeLive && runningN > 0 && shownGroups.length === 0 ? (
            <button type="button" className="hx-bg-nudge" onClick={() => setBgOpen(true)}>
              {runningN} background {runningN === 1 ? 'task' : 'tasks'} — open rail
            </button>
          ) : null}
          <StageTrustRow />
          {(thinkReady || w.busy) ? (
            <div
              className="wf-card"
              role="button"
              tabIndex={0}
              onClick={() => {
                const p = thinkReady?.path
                if (p && w.boot?.workspace) void w.openFile(`${w.boot.workspace}/${p}`)
              }}
            >
              <div className="wf-card-head">{thinkReady?.title || thinkReady?.path || lastUser(w.log) || 'Forge'}</div>
              <div className="wf-goal">
                Goal · {stripActivityText(w.goal || lastUser(w.log) || thinkReady?.title || 'Forge', 80)}
              </div>
              <div className="wf-card-meta">
                Think · {thinkReady?.status || (w.busy ? 'live' : 'draft')}
                {w.busy ? ` · ${formatDuration(runMs)}` : ''}
                {thinkReady?.files?.length ? ` · Map ${thinkReady.files.length}` : ''}
                {phase === 'verify' || phase === 'remember' ? ` · Verify ${phase === 'verify' ? 'live' : 'done'}` : ''}
              </div>
              <div className="wf-rail">
                {FORGE_STEPS.map((s) => (
                  <span
                    key={s}
                    className={s === phase ? 'on' : forgePhaseIndex(s) < phaseIdx ? 'done' : ''}
                  >
                    {s}
                  </span>
                ))}
              </div>
              {thinkReady?.files?.length ? (
                <div className="think-files">
                  {thinkReady.files.slice(0, 6).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className="ghost tiny"
                      onClick={(e) => {
                        e.stopPropagation()
                        const ws = w.boot?.workspace
                        if (ws) void w.openFile(`${ws}/${f}`)
                      }}
                    >
                      {stripActivityText(f.split('/').pop() || f, 40)}
                    </button>
                  ))}
                </div>
              ) : null}
              {thinkReady && (thinkReady.status === 'ready' || thinkReady.status === 'implementing') ? (
                <button
                  type="button"
                  className="ghost tiny"
                  onClick={(e) => {
                    e.stopPropagation()
                    void w.implementThink(thinkReady.path)
                  }}
                >
                  {thinkReady.status === 'implementing' ? 'Resume' : 'Implement'}
                </button>
              ) : null}
            </div>
          ) : null}
          {w.queue.length > 0 ? (
            <div className="queue-bar">
              {w.queue.map((q, i) => (
                <span key={`${i}-${q.slice(0, 12)}`} className="chip">
                  queued · {q.slice(0, 48)}
                </span>
              ))}
            </div>
          ) : null}
          <div className="chat-log agents-log" ref={logRef}>
            {transcript === 'summary' ? (
              <div className="sum-card">
                <div className="sum-head">
                  <h3>{sessionTitle(activeSess?.title)}</h3>
                  <span className="chat-proj">{proj}</span>
                  <span>
                    {w.log.filter((x) => x.kind === 'user').length} turns · {w.stats.tools} tool calls
                    {runMs ? ` · ${formatDuration(runMs)}` : ''}
                    {w.ring ? ` · ${w.ring.total} tokens` : ''}
                  </span>
                  <span className="sum-btns">
                    <button type="button" className="ghost tiny" onClick={() => setTranscript('verbose')}>
                      View transcript
                    </button>
                    <button type="button" className="ghost tiny" onClick={() => setTranscript('normal')}>
                      Exit summary
                    </button>
                  </span>
                </div>
                <p>{stripActivityText(lastUser(w.log) || 'No user turn yet', 200)}</p>
                {w.log.some((x) => x.kind === 'error') ? (
                  <button
                    type="button"
                    className="ghost tiny sum-err"
                    onClick={() => {
                      const t = lastUser(w.log)
                      if (t) w.run(t)
                    }}
                  >
                    Couldn&apos;t generate summary — click to retry
                  </button>
                ) : null}
              </div>
            ) : shownGroups.length === 0 ? (
              <HxEmpty
                title="What should Hex AI do?"
                body="Type in the composer below. New starts a session. Pin a skill from the rail, or type / then Alt+click to pin. Local 2B is the default mind."
                actions={
                  <>
                    <button
                      type="button"
                      className="ghost primary"
                      onClick={() => {
                        w.newChat()
                        useWorkbench.setState({ chatOpen: true })
                      }}
                    >
                      New session
                    </button>
                    <button type="button" className="ghost" onClick={() => w.setActivity('mods')}>
                      Skills
                    </button>
                  </>
                }
              />
            ) : (
            shownGroups.map((g, gi) => {
              const gid = g.items[0]?.id ?? String(gi)
              const isLast = gi === shownGroups.length - 1
              const foldable =
                ((g.type === 'commands' || g.type === 'edits' || (g.type === 'thought' && dens === 'compact')) &&
                  g.items.length >= foldAt &&
                  transcript !== 'verbose')
              const opened =
                openGroups[gid] != null ? openGroups[gid] : foldable ? Boolean(w.busy && isLast) : true
              if (!foldable) {
                return (
                  <div key={gid} className="act-block">
                    {g.items.map((item) => (
                      <ActivityLine
                        key={item.id}
                        item={item as LogItem}
                        waitingShell={w.waitingShell}
                        lastWaitId={lastWaitId}
                        waitingUntil={w.waitingUntil}
                        now={now}
                        onCheckpoint={(id) => void openCp(id)}
                        duration={toolDur(item, w.subagents, now)}
                      />
                    ))}
                  </div>
                )
              }
              return (
                <div key={gid} className="act-fold">
                  <button
                    type="button"
                    className="act-fold-head"
                    onClick={() => setOpenGroups((m) => ({ ...m, [gid]: !opened }))}
                  >
                    <span className={`caret ${opened ? 'open' : ''}`}>›</span>
                    {g.label}
                  </button>
                  {opened
                    ? g.items.map((item) => (
                        <ActivityLine
                          key={item.id}
                          item={item as LogItem}
                          waitingShell={w.waitingShell}
                          lastWaitId={lastWaitId}
                          waitingUntil={w.waitingUntil}
                          now={now}
                          onCheckpoint={(id) => void openCp(id)}
                          duration={toolDur(item, w.subagents, now)}
                        />
                      ))
                    : null}
                </div>
              )
            })
            )}
          </div>
        </div>
        {bgOpen ? (
          <BackgroundTasks
            wide={bgWide}
            now={now}
            phase={phase}
            phaseIdx={phaseIdx}
            runMs={runMs}
            logRef={logRef}
            jobs={jobs}
            jobsOpen={jobsOpen}
            jobsBusy={jobsBusy}
            jobsErr={jobsErr}
            onWide={() => setBgWide((v) => !v)}
            onClose={() => setBgOpen(false)}
            onToggleJobs={() => setJobsOpen((v) => !v)}
            onRefreshJobs={() => void refreshJobs()}
            onOpenJob={openJob}
          />
        ) : null}
      </div>

      {w.checkpoints.length > 0 && (
        <div className="cp-rail">
          {w.checkpoints.slice(-4).map((c) => (
            <button
              key={c.id}
              className="ghost tiny"
              onClick={async () => {
                const paths = await window.homeai.restore(c.id)
                await w.refreshPending()
                for (const p of paths) {
                  try {
                    const content = await window.homeai.read(p)
                    useWorkbench.setState({
                      tabs: useWorkbench.getState().tabs.map((t) => (t.path === p ? { ...t, content, dirty: false } : t))
                    })
                  } catch {
                    /* gone */
                  }
                }
              }}
            >
              restore {c.id.slice(-4)}
            </button>
          ))}
        </div>
      )}

      {w.question && (
        <div className="ask-box">
          <strong>{w.question.questions[0]?.prompt}</strong>
          {w.map.nodes.length > 0 ? (
            <label className="pin-map">
              Pin to map
              <select value={pinNode} onChange={(e) => setPinNode(e.target.value)}>
                <option value="">(none)</option>
                {w.map.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title.slice(0, 48)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {(w.question.questions[0]?.options ?? []).map((o) => (
              <button key={o} className="ghost tiny" onClick={() => void finishAsk(o)}>
                {o}
              </button>
            ))}
          </div>
          <div className="composer" style={{ border: 0, padding: '8px 0 0' }}>
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Or type an answer…" />
            <button className="send" onClick={() => void finishAsk(answer || '(empty)')}>
              Answer
            </button>
          </div>
        </div>
      )}

      {cpView ? (
        <div className="cp-preview">
          <div className="review-list-head">
            <span>Restore preview · {cpView.label}</span>
            <span className="spacer" />
            <button
              className="keep-btn"
              onClick={async () => {
                const paths = await window.homeai.restore(cpView.id)
                await w.refreshPending()
                for (const p of paths) {
                  try {
                    const content = await window.homeai.read(p)
                    useWorkbench.setState({
                      tabs: useWorkbench.getState().tabs.map((t) => (t.path === p ? { ...t, content, dirty: false } : t))
                    })
                  } catch {
                    /* gone */
                  }
                }
                setCpView(null)
              }}
            >
              Restore
            </button>
            <button className="icon-btn" onClick={() => setCpView(null)}>
              <X size={14} />
            </button>
          </div>
          {cpView.files.slice(0, 4).map((f) => (
            <MiniDiff key={f.path} path={f.path} name={f.path.split('/').pop() ?? f.path} before={f.before} after={f.after} />
          ))}
        </div>
      ) : null}

      {w.reviewOpen && w.pending.length > 0 && (
        <div className="review-list">
          <div className="review-list-head">
            <span>{w.pending.length} files to review</span>
            <span className="spacer" />
            <button
              className="keep-btn"
              onClick={async () => {
                await window.homeai.acceptAll()
                await w.refreshPending()
                await w.refreshGit()
                useWorkbench.setState({ reviewOpen: false })
              }}
            >
              Keep all
            </button>
            <button
              className="ghost tiny"
              onClick={async () => {
                const paths = (await window.homeai.undoAll()) as string[]
                await w.refreshPending()
                for (const p of paths) {
                  try {
                    const content = await window.homeai.read(p)
                    useWorkbench.setState({
                      tabs: useWorkbench.getState().tabs.map((t) => (t.path === p ? { ...t, content, dirty: false } : t))
                    })
                  } catch {
                    /* gone */
                  }
                }
                await w.refreshGit()
                useWorkbench.setState({ reviewOpen: false })
              }}
            >
              Undo all
            </button>
            <button className="icon-btn" title="Close" onClick={() => useWorkbench.setState({ reviewOpen: false })}>
              <X size={14} />
            </button>
          </div>
          {w.pending.map((p) => (
            <div key={p.path} className="review-row">
              <button className="review-name" onClick={() => void w.openFile(p.path)}>
                {p.path.split('/').pop()}
              </button>
              <button className="keep-btn" onClick={() => void w.keepFile(p.path)}>
                Keep
              </button>
              <button className="ghost tiny" onClick={() => void w.undoFile(p.path)}>
                Undo
              </button>
            </div>
          ))}
        </div>
      )}

      {arLine ? <p className="auto-review-line">{arLine}</p> : null}

      {w.reviewText ? (
        <div className="agent-review">
          <div className="review-list-head">
            <span>Agent Review · local 2B</span>
            <span className="spacer" />
            <button className="icon-btn" onClick={() => useWorkbench.setState({ reviewText: '' })}>
              <X size={14} />
            </button>
          </div>
          <div className="review-hunks">
            {parseReviewHunks(w.reviewText).map((h, i) => (
              <button
                key={`${h.path}-${i}`}
                type="button"
                className="review-hunk"
                onClick={() => {
                  if (!h.path || !w.boot?.workspace) return
                  void w.openFile(`${w.boot.workspace}/${h.path}`)
                }}
              >
                {h.line}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {(w.busy || w.pending.length > 0 || w.waitingShell) && (
        <div className="agents-meta">
          {w.ptyCount > 0 ? (
            <span>
              {w.ptyCount} background terminal{w.ptyCount === 1 ? '' : 's'}
            </span>
          ) : (
            <span />
          )}
          <span className="spacer" />
          <span className="meta-files">{fileN} Files</span>
          {(w.pending.length > 0 || w.busy) && (
            <button
              className="review-btn"
              onClick={() => {
                useWorkbench.setState({ reviewOpen: !w.reviewOpen })
                const p = w.pending[0]
                if (p) void w.openFile(p.path)
              }}
            >
              Pending diffs
            </button>
          )}
          {w.busy ? (
            <button className="icon-btn stop" title="Stop Ctrl+Shift+Q" onClick={() => w.stop()}>
              <Square size={12} fill="currentColor" />
            </button>
          ) : null}
        </div>
      )}

      {w.agentMode === 'plan' && !w.busy && lastUser(w.log) && (
        <div className="agents-foot-row">
          <button
            className="ghost tiny"
            onClick={() => {
              const last = lastUser(w.log)
              if (!last) return
              useWorkbench.setState({ agentMode: 'agent' })
              w.run(`Build this plan. Follow RAG/plans if present.\n\nOriginal: ${last}`)
            }}
          >
            Build plan
          </button>
        </div>
      )}
      {w.agentMode === 'think' && !w.busy && (
        <div className="agents-foot-row">
          <button className="ghost tiny" onClick={() => void w.implementThink()}>
            Implement
          </button>
        </div>
      )}

      {(mentions.length > 0 || slash.length > 0) && (
        <div className="mention-pop">
          {slash.map((m) => (
            <button
              key={m}
              className="hit"
              title="Click to insert · Alt+click to pin Custom Mode"
              onClick={(e) => {
                if (e.altKey) {
                  void w.pinSkill(m)
                  setSlash([])
                  setText('')
                  return
                }
                setText(`/${m} `)
                setSlash([])
                inputRef.current?.focus()
              }}
            >
              /{m}
            </button>
          ))}
          {mentions.map((m) => (
            <button
              key={m}
              className="hit"
              onClick={() => {
                const at = text.lastIndexOf('@')
                setText(`${text.slice(0, at)}@${m} `)
                if (m.toLowerCase() === 'browser') w.setActivity('browser')
                setMentions([])
                inputRef.current?.focus()
              }}
            >
              @{m}
            </button>
          ))}
        </div>
      )}

      <div className="agents-foot">
        {w.modeMenu && (
          <div className="mode-pop">
            {AGENT_MODES.map((m) => (
              <button
                key={m}
                className={m === w.agentMode ? 'on' : ''}
                onClick={() => useWorkbench.setState({ agentMode: m, modeMenu: false })}
              >
                {m === w.agentMode ? <Check size={14} /> : <span className="mode-gap" />}
                <span className="mode-copy">
                  <b>{modeLabel(m)}</b>
                  <small>{modeHint(m)}</small>
                </span>
              </button>
            ))}
          </div>
        )}
        {draftMentions(text).length > 0 ? (
          <div className="mention-chips">
            {draftMentions(text).map((m) => (
              <span key={m} className="chip">
                @{m}
              </span>
            ))}
          </div>
        ) : null}
        {(w.kernelPulse?.llama === 'missing' || w.kernelPulse?.llama === 'off') && !llm?.running ? (
          <div className="offline-card">
            <span>Local 2B is offline. This session will reconnect when the model is back.</span>
            <button type="button" className="ghost tiny" onClick={() => useWorkbench.setState({ llamaOpen: true })}>
              View details
            </button>
          </div>
        ) : null}
        <div className="follow-up">
          <textarea
            ref={inputRef}
            id="composer-input"
            value={text}
            placeholder="Ask Hex AI, or type / for a skill"
            onChange={(e) => void onChange(e.target.value)}
            onPaste={(e) => {
              const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'))
              if (!item) return
              const file = item.getAsFile()
              if (!file) return
              e.preventDefault()
              void attach(file)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                submit(true)
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit(false, e.altKey)
              }
            }}
          />
            <div className="follow-bar" ref={popRef}>
            <button className="mode-btn" onClick={() => useWorkbench.setState({ modeMenu: !w.modeMenu })}>
              {modeLabel(w.agentMode)}
              <span className="mode-model"> — {providerLabel(w.provider)}</span>
            </button>
            <div className="follow-sec">
            <div className="effort-wrap">
              <button
                type="button"
                className="follow-ctrl"
                title={`Effort · ${EFFORT_LABELS[takeEffort(effort)]} (UI density, not a model)`}
                onClick={() => {
                  setEffortOpen((v) => !v)
                  setReviewMenu(false)
                }}
              >
                Effort
              </button>
              {effortOpen ? (
                <div className="effort-pop">
                  <div className="effort-head">
                    Effort <b>{EFFORT_LABELS[takeEffort(effort)]}</b>
                  </div>
                  <div className="effort-ends">
                    <span>Faster</span>
                    <span>Ultracode</span>
                  </div>
                  <div className="effort-track">
                    {EFFORT_LABELS.map((label, i) => (
                      <button
                        key={label}
                        type="button"
                        className={`effort-pip${i <= takeEffort(effort) ? ' fill' : ''}${i === takeEffort(effort) ? ' on' : ''}`}
                        title={label}
                        onClick={() => setEffort(takeEffort(i))}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <select
              className="follow-select"
              value={w.provider}
              title="Mind"
              onChange={(e) => setMind(e.target.value)}
            >
              {MODEL_ROWS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <div className="effort-wrap">
              <button
                type="button"
                className="follow-ctrl"
                disabled={reviewBusy}
                title="Agent Review on the git diff"
                onClick={() => {
                  setReviewMenu((v) => !v)
                  setEffortOpen(false)
                }}
              >
                {reviewBusy ? '…' : 'Review'}
              </button>
              {reviewMenu ? (
                <div className="model-pop">
                  <button type="button" onClick={() => void runReview('quick')}>
                    Quick hunks
                    <em>git diff · local 2B</em>
                  </button>
                  <button type="button" onClick={() => void runReview('deep')}>
                    Deep
                    <em>diff + RAG</em>
                  </button>
                </div>
              ) : null}
            </div>
            </div>
            <span className="spacer" />
            {w.busy ? (
              <button className="icon-btn stop" title="Stop Ctrl+Shift+Q" onClick={() => w.stop()}>
                <Square size={12} fill="currentColor" />
              </button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={(e) => {
                void attach(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
            <input
              ref={imgRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void attach(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
            <button className="icon-btn" title="Attach file" onClick={() => fileRef.current?.click()}>
              <Paperclip size={14} />
            </button>
            <button className="icon-btn" title="Attach image" onClick={() => imgRef.current?.click()}>
              <ImageIcon size={14} />
            </button>
            <button className="send-round" onClick={() => submit(false)} title="Send">
              {w.busy ? <Square size={11} fill="currentColor" /> : <ArrowUp size={16} />}
            </button>
          </div>
        </div>
      </div>
      {toast ? <div className="sess-toast">{toast}</div> : null}
    </div>
  )
}

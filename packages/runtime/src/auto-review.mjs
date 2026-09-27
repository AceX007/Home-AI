import { stripActivityText } from './activity.mjs'
import { extraRootWriteAsks, parseHttpUrl, urlAllowed } from './policy.mjs'
export { lastAutoReviewLine } from './auto-review-line.mjs'

const REASONS = new Set([
  'safe-git',
  'safe-read',
  'safe-test',
  'safe-npx',
  'safe-life',
  'safe-compute',
  'workspace-write',
  'read',
  'net-allow',
  'extra-root',
  'unmodeled',
  'env',
  'quote',
  'pipe',
  'powershell',
  'cd',
  'sudo',
  'destructive',
  'abs-path',
  'secrets',
  'block-instruction',
  'allow-instruction',
  'axes',
  'json',
  'llama-off',
  'net-unknown',
  'bad-url'
])

const RISK = new Set(['low', 'high', 'too_destructive'])
const AUTH = new Set(['explicitly_no', 'neutral', 'explicitly_yes'])
const CORR = new Set(['ok', 'quoting_error', 'unknown'])

function reasonToken(raw) {
  const s = String(raw || '')
  return REASONS.has(s) ? s : 'unmodeled'
}

function emptyAxes() {
  return { risk: '', authorization: '', correctness: '' }
}

export function reportOf(stage, verdict, reason, extra) {
  const x = extra && typeof extra === 'object' ? extra : emptyAxes()
  const v = verdict === 'allow' || verdict === 'deny' ? verdict : 'ask'
  const st = stage === 'reviewer' ? 'reviewer' : 'judge'
  const risk = x.risk === 'too_destructive' || x.risk === 'low' || x.risk === 'high' ? x.risk : v === 'deny' && reasonToken(reason) === 'destructive' ? 'too_destructive' : ''
  return {
    stage: st,
    verdict: v,
    reason: reasonToken(reason),
    risk: risk || '',
    authorization: AUTH.has(x.authorization) ? x.authorization : '',
    correctness: CORR.has(x.correctness) ? x.correctness : ''
  }
}

export function publicAutoReviewLine(report) {
  const r = report && typeof report === 'object' ? report : {}
  const stage = r.stage === 'reviewer' ? 'reviewer' : 'judge'
  const verdict = r.verdict === 'allow' || r.verdict === 'deny' ? r.verdict : 'ask'
  const reason = reasonToken(r.reason)
  return stripActivityText(`auto-review · ${stage} · ${verdict} · ${reason}`, 80)
}

export function takeRelativePath(s) {
  const t = String(s ?? '').trim()
  if (!t || t === '-') return null
  if (t.length > 240) return null
  if (t.startsWith('/') || t.startsWith('~')) return null
  if (t.includes('..') || t.includes('\0')) return null
  if (/^[A-Za-z]:/.test(t)) return null
  if (t.includes('<>') || /[<>]/.test(t)) return null
  if (/(^|\/)data\/secrets(\/|$)/.test(t) || t.includes('data/secrets')) return null
  return t
}

function readableFileOrStdin(s) {
  if (s === '-') return '-'
  return takeRelativePath(s)
}

export function splitSafeAnd(command) {
  const t = String(command ?? '').trim()
  if (!t) return null
  const probe = t.replace(/&&/g, ' ')
  if (/[;|`$<>\n\r]/.test(probe) || probe.includes('$(') || probe.includes('${')) return null
  if (!t.includes('&&')) return [t]
  const segs = t.split('&&').map((p) => p.trim())
  if (segs.length < 2 || segs.length > 4) return null
  if (segs.some((s) => !s)) return null
  return segs
}

function tokenize(cmd) {
  const out = []
  let cur = ''
  let q = ''
  const s = String(cmd ?? '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (q) {
      if (ch === q) q = ''
      else cur += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      q = ch
      continue
    }
    if (/\s/.test(ch)) {
      if (cur) {
        out.push(cur)
        cur = ''
      }
      continue
    }
    cur += ch
  }
  if (q) return { tokens: null, unknown: 'quote' }
  if (cur) out.push(cur)
  if (out.length > 24) return { tokens: null, unknown: 'unmodeled' }
  return { tokens: out, unknown: null }
}

function gitCommitish(s) {
  const t = String(s ?? '')
  if (!t || t.startsWith('-')) return false
  return /^[A-Za-z0-9._/~^:-]{1,80}$/.test(t)
}

function gitForbidden(t) {
  if (t === '-c' || t === '--exec-path' || t === '--git-dir' || t === '--work-tree') return true
  if (t === '--output' || t.startsWith('--output=')) return true
  return false
}

const STATUS_FLAGS = new Set(['--short', '-s', '--branch', '-b', '--porcelain', '-sb', '--untracked-files=no', '-uno', '--'])
const DIFF_FLAGS = new Set(['--check', '--stat', '--name-only', '--name-status', '--no-ext-diff', '--cached', '--staged', '-w', '--'])
const LOG_FLAGS = new Set(['--oneline', '--decorate', '--', '-n'])
const BRANCH_FLAGS = new Set(['-a', '--show-current', '-v', '--'])
const SHOW_FLAGS = new Set(['--stat', '--'])
const REV_FLAGS = new Set(['--abbrev-ref', '--'])
const CAT_FLAGS = new Set(['-n', '-b', '-s', '-A', '-E', '-T'])
const HEAD_FLAGS = new Set(['-n'])
const LS_FLAGS = new Set(['-l', '-a', '-la', '-al', '-1', '-h', '-R'])
const WC_FLAGS = new Set(['-l', '-c', '-w'])
const GREP_FLAGS = new Set(['-n', '-i', '-E', '-F', '-c', '-l', '-r'])
const RG_FLAGS = new Set(['-n', '-i', '-F', '-l'])
const PYTEST_FLAGS = new Set(['-q', '--tb=short'])

function logDashN(t) {
  return /^-(?:[1-9]|[1-9][0-9])$/.test(t)
}

function matchGit(tokens) {
  if (tokens.some(gitForbidden)) return { verdict: 'ask', reason: 'unmodeled' }
  const sub = tokens[1]
  const rest = tokens.slice(2)
  const allow = new Set(['status', 'diff', 'log', 'branch', 'show', 'rev-parse', 'merge-base', 'worktree'])
  if (!allow.has(sub)) return { verdict: 'ask', reason: 'unmodeled' }
  if (sub === 'worktree') {
    if (rest[0] !== 'list' || rest.length !== 1) return { verdict: 'ask', reason: 'unmodeled' }
    return { verdict: 'allow', reason: 'safe-git' }
  }
  if (sub === 'status') {
    for (const t of rest) {
      if (t.startsWith('-')) {
        if (!STATUS_FLAGS.has(t)) return { verdict: 'ask', reason: 'unmodeled' }
      } else if (t !== '.') return { verdict: 'ask', reason: 'unmodeled' }
    }
    return { verdict: 'allow', reason: 'safe-git' }
  }
  if (sub === 'diff') {
    for (const t of rest) {
      if (t.startsWith('-')) {
        if (!DIFF_FLAGS.has(t)) return { verdict: 'ask', reason: 'unmodeled' }
      } else if (t !== '.' && !gitCommitish(t)) return { verdict: 'ask', reason: 'unmodeled' }
    }
    return { verdict: 'allow', reason: 'safe-git' }
  }
  if (sub === 'log') {
    for (let i = 0; i < rest.length; i++) {
      const t = rest[i]
      if (t === '-n') {
        const n = rest[i + 1]
        if (!n || !/^[1-9][0-9]?$/.test(n)) return { verdict: 'ask', reason: 'unmodeled' }
        i += 1
        continue
      }
      if (t.startsWith('-')) {
        if (logDashN(t) || LOG_FLAGS.has(t)) continue
        return { verdict: 'ask', reason: 'unmodeled' }
      }
      if (t !== '.' && !gitCommitish(t)) return { verdict: 'ask', reason: 'unmodeled' }
    }
    return { verdict: 'allow', reason: 'safe-git' }
  }
  if (sub === 'branch') {
    for (const t of rest) {
      if (t.startsWith('-')) {
        if (!BRANCH_FLAGS.has(t)) return { verdict: 'ask', reason: 'unmodeled' }
      } else return { verdict: 'ask', reason: 'unmodeled' }
    }
    return { verdict: 'allow', reason: 'safe-git' }
  }
  if (sub === 'show') {
    for (const t of rest) {
      if (t.startsWith('-')) {
        if (!SHOW_FLAGS.has(t)) return { verdict: 'ask', reason: 'unmodeled' }
      } else if (!gitCommitish(t)) return { verdict: 'ask', reason: 'unmodeled' }
    }
    return { verdict: 'allow', reason: 'safe-git' }
  }
  if (sub === 'rev-parse') {
    for (const t of rest) {
      if (t.startsWith('-')) {
        if (!REV_FLAGS.has(t)) return { verdict: 'ask', reason: 'unmodeled' }
      } else if (!gitCommitish(t) && t !== 'HEAD' && t !== 'main') return { verdict: 'ask', reason: 'unmodeled' }
    }
    return { verdict: 'allow', reason: 'safe-git' }
  }
  if (sub === 'merge-base') {
    if (rest.length !== 2 || !gitCommitish(rest[0]) || !gitCommitish(rest[1])) {
      return { verdict: 'ask', reason: 'unmodeled' }
    }
    return { verdict: 'allow', reason: 'safe-git' }
  }
  return { verdict: 'ask', reason: 'unmodeled' }
}

function globby(t) {
  return /[*?[]/.test(t)
}

function tsBuildInfoOk(p) {
  const rel = takeRelativePath(p)
  if (!rel) return false
  if (rel.startsWith('.scratchpad/')) return true
  return /\.tsbuildinfo$/i.test(rel)
}

function matchReadBin(tokens) {
  const bin = tokens[0]
  const rest = tokens.slice(1)
  if (rest.some(globby)) return { verdict: 'ask', reason: 'unmodeled' }
  if (bin === 'pwd') {
    if (tokens.length !== 1) return { verdict: 'ask', reason: 'unmodeled' }
    return { verdict: 'allow', reason: 'safe-read' }
  }
  if (bin === 'ls') {
    for (const t of rest) {
      if (t.startsWith('-')) {
        if (!LS_FLAGS.has(t)) return { verdict: 'ask', reason: 'unmodeled' }
      } else if (!takeRelativePath(t)) return { verdict: 'ask', reason: 'unmodeled' }
    }
    return { verdict: 'allow', reason: 'safe-read' }
  }
  if (bin === 'wc') {
    for (const t of rest) {
      if (t.startsWith('-')) {
        if (!WC_FLAGS.has(t)) return { verdict: 'ask', reason: 'unmodeled' }
      } else if (!takeRelativePath(t)) return { verdict: 'ask', reason: 'unmodeled' }
    }
    return { verdict: 'allow', reason: 'safe-read' }
  }
  if (bin === 'cat') {
    let files = 0
    for (const t of rest) {
      if (t.startsWith('-') && t !== '-') {
        if (!CAT_FLAGS.has(t)) return { verdict: 'ask', reason: 'unmodeled' }
      } else {
        if (!readableFileOrStdin(t) || (t !== '-' && !takeRelativePath(t))) return { verdict: 'ask', reason: 'unmodeled' }
        files += 1
        if (files > 8) return { verdict: 'ask', reason: 'unmodeled' }
      }
    }
    return { verdict: 'allow', reason: 'safe-read' }
  }
  if (bin === 'head') {
    for (let i = 0; i < rest.length; i++) {
      const t = rest[i]
      if (t === '-n') {
        const n = rest[i + 1]
        if (!n || !/^[1-9][0-9]{0,3}$/.test(n)) return { verdict: 'ask', reason: 'unmodeled' }
        i += 1
        continue
      }
      if (t.startsWith('-') && t !== '-') return { verdict: 'ask', reason: 'unmodeled' }
      if (!readableFileOrStdin(t) || (t !== '-' && !takeRelativePath(t))) return { verdict: 'ask', reason: 'unmodeled' }
    }
    return { verdict: 'allow', reason: 'safe-read' }
  }
  if (bin === 'grep' || bin === 'rg') {
    const flags = bin === 'rg' ? RG_FLAGS : GREP_FLAGS
    let pattern = false
    for (const t of rest) {
      if (!pattern && t.startsWith('-')) {
        if (!flags.has(t)) return { verdict: 'ask', reason: 'unmodeled' }
        continue
      }
      if (!pattern) {
        if (t.startsWith('-') || t.length > 120) return { verdict: 'ask', reason: 'unmodeled' }
        pattern = true
        continue
      }
      if (!takeRelativePath(t)) return { verdict: 'ask', reason: 'unmodeled' }
    }
    if (!pattern) return { verdict: 'ask', reason: 'unmodeled' }
    return { verdict: 'allow', reason: 'safe-read' }
  }
  return null
}

function matchTestBin(tokens) {
  const bin = tokens[0]
  if (bin === 'npm') {
    if (tokens[1] === 'test') {
      const extra = tokens.slice(2)
      if (extra.length > 4) return { verdict: 'ask', reason: 'unmodeled' }
      for (const t of extra) {
        if (t === '--silent' || t === '--') continue
        if (!/^[\w.=/-]+$/.test(t)) return { verdict: 'ask', reason: 'unmodeled' }
      }
      return { verdict: 'allow', reason: 'safe-test' }
    }
    if (tokens[1] === 'run') {
      const script = tokens[2]
      if (!script || !/^[\w.-]+$/.test(script)) return { verdict: 'ask', reason: 'unmodeled' }
      if (script === 'publish' || script === 'prepublish' || script === 'install' || script === 'env') {
        return { verdict: 'ask', reason: 'unmodeled' }
      }
      if (tokens.length > 4) return { verdict: 'ask', reason: 'unmodeled' }
      if (tokens[3] && tokens[3] !== '--silent') return { verdict: 'ask', reason: 'unmodeled' }
      return { verdict: 'allow', reason: 'safe-test' }
    }
    return { verdict: 'ask', reason: 'unmodeled' }
  }
  if (bin === 'npx' && tokens[1] === 'tsc') {
    const rest = tokens.slice(2)
    for (let i = 0; i < rest.length; i++) {
      const t = rest[i]
      if (t === '--noEmit' || t === '--incremental' || t === '--pretty' || t === 'false') continue
      if (t === '-p') {
        const p = rest[i + 1]
        if (!p || !takeRelativePath(p)) return { verdict: 'ask', reason: 'unmodeled' }
        i += 1
        continue
      }
      if (t === '--tsBuildInfoFile') {
        const p = rest[i + 1]
        if (!tsBuildInfoOk(p)) return { verdict: 'ask', reason: 'unmodeled' }
        i += 1
        continue
      }
      return { verdict: 'ask', reason: 'unmodeled' }
    }
    return { verdict: 'allow', reason: 'safe-npx' }
  }
  if (bin === 'npx' && tokens[1] === 'vitest') {
    const rest = tokens.slice(2)
    if (rest.some((t) => t !== '--run')) return { verdict: 'ask', reason: 'unmodeled' }
    return { verdict: 'allow', reason: 'safe-npx' }
  }
  if (bin === 'pytest') {
    for (const t of tokens.slice(1)) {
      if (t.startsWith('-')) {
        if (!PYTEST_FLAGS.has(t)) return { verdict: 'ask', reason: 'unmodeled' }
      } else if (!takeRelativePath(t)) return { verdict: 'ask', reason: 'unmodeled' }
    }
    return { verdict: 'allow', reason: 'safe-test' }
  }
  if (bin === 'node') {
    if (tokens.length === 2 && (tokens[1] === '--version' || tokens[1] === '-v' || tokens[1] === '--help')) {
      return { verdict: 'allow', reason: 'safe-npx' }
    }
    return { verdict: 'ask', reason: 'unmodeled' }
  }
  return null
}

function destructiveReason(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ')
  const low = s.toLowerCase()
  if (/\brm\s+-rf\s+\/(?:\s|$)/.test(low) || low.includes('rm -rf --no-preserve-root')) return 'destructive'
  if (/\brm\s+-rf\s+(~|\$home|~\/)/i.test(low)) return 'destructive'
  if (/\bmkfs\b/.test(low)) return 'destructive'
  if (/\bdd\s+if=/.test(low)) return 'destructive'
  if (low.includes(':(){ :|:& };:')) return 'destructive'
  if (/\bchmod\s+(?:-r\s+)?777\s+\//.test(low)) return 'destructive'
  if (/\b(curl|wget)\b/.test(low) && /\|/.test(s) && /\b(sh|bash)\b/.test(low)) return 'destructive'
  if (/\bdata\/secrets\b/.test(s)) return 'secrets'
  if (/\b(cat|head|grep|rg)\b/.test(low) && /(^|\s)\/(etc|root)\//.test(s)) return 'abs-path'
  return ''
}

function powershellish(raw) {
  return /Get-ChildItem|Select-String|ForEach-Object|\$files|\$_\./.test(raw)
}

function hasEnvAssign(raw) {
  if (/(?:^|\s)export\s/.test(raw)) return true
  return /(?:^|\s)[A-Za-z_][A-Za-z0-9_]+=/.test(raw)
}

function judgeOne(raw) {
  const cmd = String(raw || '').trim()
  if (powershellish(cmd)) return { verdict: 'ask', reason: 'powershell' }
  if (/(?:^|\s)sudo(?:\s|$)/.test(cmd) || cmd.startsWith('sudo ')) return { verdict: 'ask', reason: 'sudo' }
  if (hasEnvAssign(cmd)) return { verdict: 'ask', reason: 'env' }
  const tok = tokenize(cmd)
  if (tok.unknown === 'quote') return { verdict: 'ask', reason: 'quote' }
  if (!tok.tokens || !tok.tokens.length) return { verdict: 'ask', reason: 'unmodeled' }
  if (tok.tokens.some((t) => t.startsWith('$'))) return { verdict: 'ask', reason: 'unmodeled' }
  if (tok.tokens[0] === 'cd') return { verdict: 'ask', reason: 'cd' }
  if (tok.tokens[0].includes('/') || tok.tokens[0].startsWith('.')) return { verdict: 'ask', reason: 'unmodeled' }
  if (tok.tokens[0] === 'git') return matchGit(tok.tokens)
  const read = matchReadBin(tok.tokens)
  if (read) return read
  const test = matchTestBin(tok.tokens)
  if (test) return test
  return { verdict: 'ask', reason: 'unmodeled' }
}

export function judgeShell(command) {
  const raw = String(command ?? '').trim()
  if (!raw) return { verdict: 'ask', reason: 'unmodeled' }
  if (raw.length > 2000) return { verdict: 'ask', reason: 'unmodeled' }
  const dest = destructiveReason(raw)
  if (dest) {
    return { verdict: 'deny', reason: dest, risk: dest === 'destructive' ? 'too_destructive' : '' }
  }
  const parts = splitSafeAnd(raw)
  if (!parts) {
    if (/\|/.test(raw)) return { verdict: 'ask', reason: 'pipe' }
    return { verdict: 'ask', reason: 'unmodeled' }
  }
  if (parts.length > 1) {
    let reason = 'safe-git'
    let risk = ''
    for (const p of parts) {
      const inner = destructiveReason(p)
      if (inner) return { verdict: 'deny', reason: inner, risk: inner === 'destructive' ? 'too_destructive' : '' }
      const j = judgeOne(p)
      if (j.verdict === 'deny') return j
      if (j.verdict !== 'allow') return { verdict: 'ask', reason: j.reason || 'unmodeled' }
      reason = j.reason
      if (j.risk) risk = j.risk
    }
    return { verdict: 'allow', reason, risk }
  }
  return judgeOne(raw)
}

const LIFE = new Set(['speak', 'inbox_stt', 'inbox_ocr'])
const TEST_KIND = new Set(['auto', 'npm', 'pytest', 'test_run', 'npm test', ''])

function namedExec(tool, detail) {
  const name = String(tool || '')
  const d = String(detail ?? '').trim()
  if (name === 'test_run' && TEST_KIND.has(d)) return { verdict: 'allow', reason: 'safe-test' }
  if (LIFE.has(name) && (d === name || d === '')) return { verdict: 'allow', reason: 'safe-life' }
  if (name === 'compute_run' && /^compute_run (python|node)$/.test(d)) {
    return { verdict: 'allow', reason: 'safe-compute' }
  }
  if (name === 'task') return { verdict: 'ask', reason: 'unmodeled' }
  if (name === 'git_worktree' && d.startsWith('git worktree add')) {
    return { verdict: 'ask', reason: 'unmodeled' }
  }
  return null
}

export function instructionHit(detail, list) {
  if (!Array.isArray(list) || !list.length) return false
  const hay = String(detail ?? '').toLowerCase()
  if (!hay) return false
  return list.some((x) => typeof x === 'string' && x.trim() && hay.includes(x.trim().toLowerCase()))
}

export function instructionAuthorization(detail, perms) {
  const review = perms && perms.autoReview && typeof perms.autoReview === 'object' ? perms.autoReview : {}
  const run = perms && perms.autoRun && typeof perms.autoRun === 'object' ? perms.autoRun : {}
  if (instructionHit(detail, review.block_instructions) || instructionHit(detail, run.block_instructions)) {
    return 'explicitly_no'
  }
  if (instructionHit(detail, review.allow_instructions) || instructionHit(detail, run.allow_instructions)) {
    return 'explicitly_yes'
  }
  return 'neutral'
}

export function parseReviewerAxes(text) {
  let s = String(text ?? '').trim()
  s = s.replace(/^```[\w+-]*\n?/, '').replace(/\n?```\s*$/, '').trim()
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  let src
  try {
    src = JSON.parse(s.slice(a, b + 1))
  } catch {
    return null
  }
  if (!src || typeof src !== 'object' || Array.isArray(src)) return null
  const own = (k) => Object.prototype.hasOwnProperty.call(src, k)
  if (!own('risk')) return null
  const risk = src.risk
  if (!RISK.has(risk)) return null
  const out = Object.create(null)
  out.risk = risk
  out.authorization = own('authorization') && AUTH.has(src.authorization) ? src.authorization : 'neutral'
  out.correctness = own('correctness') && CORR.has(src.correctness) ? src.correctness : 'unknown'
  return out
}

export function takeReviewerTranscript(raw) {
  const lines = String(raw ?? '').split('\n')
  const user = []
  const other = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (/^\s*[\[{]/.test(t)) continue
    if (/tool_call/i.test(t)) continue
    if (/^(tool|system)\s*:/i.test(t)) continue
    if (/^(ok|err)\s+\S/.test(t)) continue
    const um = t.match(/^(user)\s*:\s*(.*)$/i)
    const am = t.match(/^(assistant)\s*:\s*(.*)$/i)
    if (um) {
      const bit = stripActivityText(um[2], 400)
      if (bit) user.push(bit)
      continue
    }
    if (am) {
      const bit = stripActivityText(am[2], 400)
      if (bit) other.push(bit)
      continue
    }
  }
  const takeEnd = (arr, cap) => {
    let n = 0
    const out = []
    for (let i = arr.length - 1; i >= 0; i--) {
      const piece = arr[i]
      if (n + piece.length > cap) break
      out.push(piece)
      n += piece.length + 1
    }
    return out.reverse().join('\n')
  }
  return { user: takeEnd(user, 2000), other: takeEnd(other, 2000) }
}

export function reviewerSystemPrompt() {
  return [
    'You classify a shell command. You do not decide to run it.',
    'Reply with one JSON object only, keys risk, authorization, correctness.',
    'risk: low | high | too_destructive (worst case).',
    'authorization: explicitly_no | neutral | explicitly_yes (did the human ask for this command).',
    'correctness: ok | quoting_error | unknown.',
    'Do not mention allow, deny, or a passing score.'
  ].join('\n')
}

export function reviewerUserPrompt(command, transcript) {
  const t =
    transcript && typeof transcript === 'object' && !Array.isArray(transcript)
      ? { user: String(transcript.user || ''), other: String(transcript.other || '') }
      : takeReviewerTranscript(transcript)
  const cmd = stripActivityText(command, 400)
  return [`command: ${cmd}`, 'user:', t.user || '(none)', 'assistant:', t.other || '(none)'].join('\n')
}

function biasAxes(axes, detail, perms) {
  const next = {
    risk: axes.risk,
    authorization: axes.authorization || 'neutral',
    correctness: axes.correctness || 'unknown',
    instructionAuth: instructionAuthorization(detail, perms)
  }
  const auth = next.instructionAuth
  if (auth === 'explicitly_no') next.authorization = 'explicitly_no'
  else if (auth === 'explicitly_yes' && next.authorization === 'neutral') next.authorization = 'explicitly_yes'
  return next
}

export function combineAxes(axes, baseReport) {
  const base = reportOf(baseReport?.stage || 'reviewer', baseReport?.verdict || 'ask', baseReport?.reason || 'axes', baseReport)
  const a = axes && typeof axes === 'object' ? axes : {}
  const risk = RISK.has(a.risk) ? a.risk : ''
  const authorization = AUTH.has(a.authorization) ? a.authorization : 'neutral'
  const correctness = CORR.has(a.correctness) ? a.correctness : 'unknown'
  const instructedYes = a.instructionAuth === 'explicitly_yes'
  if (base.verdict === 'deny') {
    return reportOf('judge', 'deny', base.reason, {
      risk: base.risk || (base.reason === 'destructive' ? 'too_destructive' : ''),
      authorization,
      correctness
    })
  }
  if (risk === 'too_destructive' || base.risk === 'too_destructive') {
    return reportOf('reviewer', 'deny', 'destructive', { risk: 'too_destructive', authorization, correctness })
  }
  if (correctness === 'quoting_error') {
    return reportOf('reviewer', 'ask', 'axes', { risk, authorization, correctness })
  }
  if (risk === 'low' && authorization !== 'explicitly_no') {
    const reason = instructedYes ? 'allow-instruction' : 'axes'
    return reportOf('reviewer', 'allow', reason, { risk, authorization, correctness })
  }
  if (risk === 'high' && authorization === 'explicitly_yes') {
    return reportOf('reviewer', 'allow', instructedYes ? 'allow-instruction' : 'axes', { risk, authorization, correctness })
  }
  const reason = authorization === 'explicitly_no' ? 'block-instruction' : 'axes'
  return reportOf('reviewer', 'ask', reason, { risk, authorization, correctness })
}

export function runAutoReviewPipeline(opts) {
  const o = opts && typeof opts === 'object' ? opts : {}
  const perms = o.perms && typeof o.perms === 'object' ? o.perms : {}
  const permission = o.permission
  const tool = String(o.tool || '')
  const detail = String(o.detail ?? '')
  if (extraRootWriteAsks(permission, o.extraRoot)) {
    return reportOf('judge', 'ask', 'extra-root')
  }
  if (permission === 'read') return reportOf('judge', 'allow', 'read')
  if (permission === 'write') return reportOf('judge', 'allow', 'workspace-write')
  if (permission === 'net') {
    const allow = urlAllowed(detail, perms.netAllowlist)
    if (allow) return reportOf('judge', 'allow', 'net-allow')
    if (!parseHttpUrl(detail)) return reportOf('judge', 'deny', 'bad-url')
    const askNet = reportOf('judge', 'ask', 'net-unknown')
    if (o.axes) return combineAxes(biasAxes(o.axes, detail, perms), askNet)
    return askNet
  }
  if (permission === 'exec') {
    const named = namedExec(tool, detail)
    const judged = named || judgeShell(detail)
    if (judged.verdict === 'deny') {
      return reportOf('judge', 'deny', judged.reason, { risk: judged.risk || (judged.reason === 'destructive' ? 'too_destructive' : '') })
    }
    if (judged.verdict === 'allow') {
      if (instructionHit(detail, perms.autoReview?.block_instructions)) {
        const blocked = reportOf('reviewer', 'ask', 'block-instruction', { authorization: 'explicitly_no' })
        if (o.axes) return combineAxes(biasAxes(o.axes, detail, perms), blocked)
        return blocked
      }
      return reportOf('judge', 'allow', judged.reason)
    }
    const ask = reportOf('judge', 'ask', judged.reason || 'unmodeled')
    if (o.axes) return combineAxes(biasAxes(o.axes, detail, perms), ask)
    return ask
  }
  return reportOf('judge', 'allow', 'read')
}

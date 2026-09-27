import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { redactCloudText } from './think.mjs'

const ARGV = ['diff', '--no-ext-diff', '--', '.', ':(exclude)data/secrets', ':(exclude)data/secrets/*']

/** Workspace-only git diff for VERIFY. Extra-root and data/secrets never appear. */
export function takeVerifyDiff(workspaceRoot) {
  const r = typeof workspaceRoot === 'string' ? workspaceRoot.trim() : ''
  if (!r || r.includes('\0') || /[\n\r]/.test(r)) return ''
  if (!existsSync(join(r, '.git'))) return ''
  let raw = ''
  try {
    const out = spawnSync('git', ARGV, {
      cwd: r,
      encoding: 'utf8',
      timeout: 8000,
      maxBuffer: 2_000_000,
      env: {
        PATH: process.env.PATH || '/usr/bin:/bin',
        LANG: process.env.LANG || 'C.UTF-8',
        GIT_OPTIONAL_LOCKS: '0',
        GIT_TERMINAL_PROMPT: '0'
      }
    })
    if (out.error) return ''
    raw = String(out.stdout || '')
    const err = String(out.stderr || '')
    if (/not a git repository/i.test(raw) || /not a git repository/i.test(err)) return ''
  } catch {
    return ''
  }
  if (!raw.trim()) return ''
  const s = redactCloudText(raw.replace(/[<>]/g, ''))
    .split('\n')
    .filter((line) => !/(^|\/)data\/secrets(\/|$)/.test(line.replace(/\\/g, '/')))
    .join('\n')
    .slice(0, 1800)
  return s.trim()
}

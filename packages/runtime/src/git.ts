import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GitFileStatus, GitSnapshot } from '@homeai/core'
import { gitPathspecs } from './paths.mjs'
import { gitPullArgv, gitPushArgv, parseGitLineChanges } from './git-safe.mjs'
import { acpWorktreeName } from './compiler-os.mjs'

export { parseGitLineChanges }

function run(cwd: string, args: string[], timeoutMs = 20_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, env: process.env })
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
      resolve(out || `(exit ${code})`)
    })
    child.on('error', (e) => {
      clearTimeout(t)
      reject(e)
    })
  })
}

export function gitBranch(root: string): string | undefined {
  try {
    const head = readFileSync(join(root, '.git', 'HEAD'), 'utf8').trim()
    if (head.startsWith('ref:')) return head.split('/').pop()
    return head.slice(0, 8)
  } catch {
    return undefined
  }
}

export async function gitSnapshot(root: string): Promise<GitSnapshot> {
  if (!existsSync(join(root, '.git'))) {
    return { porcelain: '', files: [] }
  }
  const porcelain = await run(root, ['status', '--porcelain=v1', '-b'])
  const files: GitFileStatus[] = []
  for (const line of porcelain.split('\n')) {
    if (!line || line.startsWith('##')) continue
    const xy = line.slice(0, 2)
    const path = line.slice(3).trim()
    if (!path) continue
    files.push({ path, xy, staged: xy[0] !== ' ' && xy[0] !== '?' })
  }
  const branchLine = porcelain.split('\n').find((l) => l.startsWith('##')) ?? ''
  return {
    branch: gitBranch(root),
    porcelain,
    files,
    aheadBehind: branchLine
  }
}

export async function gitDiff(root: string, staged = false): Promise<string> {
  return run(root, staged ? ['diff', '--cached'] : ['diff'])
}

export async function gitLog(root: string, n = 12): Promise<string> {
  return run(root, ['log', `-${n}`, '--oneline', '--decorate'])
}

export async function gitCommit(root: string, message: string): Promise<string> {
  const msg = message.trim()
  if (!msg) throw new Error('empty commit message')
  return run(root, ['commit', '-m', msg])
}

export async function gitAdd(root: string, paths: string[]): Promise<string> {
  if (!paths.length) return '(nothing to add)'
  const specs = gitPathspecs(root, paths)
  return run(root, ['add', '--', ...specs])
}

export async function gitUnstage(root: string, paths: string[]): Promise<string> {
  if (!paths.length) return '(nothing to unstage)'
  const specs = gitPathspecs(root, paths)
  return run(root, ['restore', '--staged', '--', ...specs])
}

export async function gitWorktreeAdd(root: string, name: string): Promise<string> {
  const dest = join(root, '.cursor', 'worktrees', acpWorktreeName(name))
  return run(root, ['worktree', 'add', '--detach', dest])
}

export async function gitWorktreeList(root: string): Promise<string> {
  return run(root, ['worktree', 'list'])
}

export async function gitPullFfOnly(root: string): Promise<string> {
  const out = await run(root, gitPullArgv(), 60_000)
  return String(out).slice(0, 4000)
}

export async function gitPushUpstream(root: string): Promise<string> {
  const out = await run(root, gitPushArgv(), 60_000)
  return String(out).slice(0, 4000)
}

export async function gitLineChanges(
  root: string,
  path: string
): Promise<{ added: number[]; removed: number[] }> {
  const specs = gitPathspecs(root, [path])
  const diff = await run(root, ['diff', '-U0', '--', ...specs])
  const all = parseGitLineChanges(diff)
  return all[specs[0]] || { added: [], removed: [] }
}

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type HookEvent =
  | 'preToolUse'
  | 'afterFileEdit'
  | 'beforeShellExecution'
  | 'afterShellExecution'

interface HookCmd {
  command: string
}

interface HooksFile {
  hooks?: Partial<Record<HookEvent, HookCmd[]>>
}

export function loadHooks(workspace: string): HooksFile {
  const files = [
    join(workspace, '.cursor', 'hooks.json'),
    join(workspace, '.homeai', 'hooks.json'),
    join(homedir(), '.cursor', 'hooks.json')
  ]
  for (const f of files) {
    if (!existsSync(f)) continue
    try {
      return JSON.parse(readFileSync(f, 'utf8')) as HooksFile
    } catch {
      /* skip */
    }
  }
  return {}
}

export async function runHooks(
  workspace: string,
  event: HookEvent,
  payload: Record<string, unknown>
): Promise<{ permission?: 'allow' | 'deny'; message?: string }> {
  const file = loadHooks(workspace)
  const cmds = file.hooks?.[event] ?? []
  let permission: 'allow' | 'deny' | undefined
  let message: string | undefined
  for (const spec of cmds) {
    if (!spec.command) continue
    const result = await spawnJson(workspace, spec.command, { hook_event_name: event, ...payload })
    if (result?.permission === 'deny') return { permission: 'deny', message: result.message }
    if (result?.permission === 'allow') permission = 'allow'
    if (result?.message) message = result.message
  }
  return { permission, message }
}

function spawnJson(
  cwd: string,
  command: string,
  payload: Record<string, unknown>
): Promise<{ permission?: 'allow' | 'deny'; message?: string } | null> {
  return new Promise((resolve) => {
    const child = spawn('bash', ['-lc', command], { cwd, env: process.env })
    let out = ''
    const t = setTimeout(() => {
      child.kill('SIGKILL')
      resolve(null)
    }, 8_000)
    child.stdout?.on('data', (d) => {
      out += String(d)
    })
    child.stdin?.write(JSON.stringify(payload))
    child.stdin?.end()
    child.on('close', () => {
      clearTimeout(t)
      try {
        const json = JSON.parse(out.trim() || '{}') as { permission?: 'allow' | 'deny'; message?: string }
        resolve(json)
      } catch {
        resolve(null)
      }
    })
    child.on('error', () => {
      clearTimeout(t)
      resolve(null)
    })
  })
}

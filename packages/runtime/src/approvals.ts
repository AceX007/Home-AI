import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ApprovalMode, PermissionsFile } from '@homeai/core'
import {
  extraRootWriteDecision,
  extraRootWriteAsks,
  applyLoadedPatch,
  pinWorkspaceInstructions,
  takePermissionsPatch,
  urlAllowed
} from './policy.mjs'
import { runAutoReviewPipeline } from './auto-review.mjs'

export const DEFAULT_PERMISSIONS: PermissionsFile = {
  approvalMode: 'allowlist',
  terminalAllowlist: [
    'git status',
    'git diff',
    'git log',
    'git branch',
    'git show',
    'git rev-parse',
    'git worktree list',
    'npm test',
    'npm run',
    'npx tsc',
    'npx vitest',
    'pytest',
    'ls',
    'pwd',
    'rg ',
    'grep ',
    'cat ',
    'head ',
    'wc '
  ],
  mcpAllowlist: [],
  fsExtraRoots: [],
  netAllowlist: [
    'http://127.0.0.1',
    'http://localhost',
    'https://127.0.0.1',
    'https://localhost',
    'https://html.duckduckgo.com'
  ]
}

function parse(raw: string): Partial<PermissionsFile> {
  const stripped = raw.replace(/^\uFEFF/, '').replace(/\/\/.*$/gm, '')
  return JSON.parse(stripped) as Partial<PermissionsFile>
}

export function loadPermissions(workspace: string): PermissionsFile {
  const merged: PermissionsFile = {
    ...DEFAULT_PERMISSIONS,
    terminalAllowlist: [...DEFAULT_PERMISSIONS.terminalAllowlist],
    mcpAllowlist: [...DEFAULT_PERMISSIONS.mcpAllowlist],
    netAllowlist: [...DEFAULT_PERMISSIONS.netAllowlist],
    fsExtraRoots: [...(DEFAULT_PERMISSIONS.fsExtraRoots ?? [])]
  }
  const paths = [
    join(homedir(), '.homeai', 'permissions.json'),
    join(workspace, 'data', 'permissions.json'),
    join(workspace, '.cursor', 'permissions.json'),
    join(workspace, '.homeai', 'permissions.json')
  ]
  const workspaceFile = join(workspace, 'data', 'permissions.json')
  let workspaceTaken: ReturnType<typeof takePermissionsPatch> | null = null
  for (const p of paths) {
    if (!existsSync(p)) continue
    try {
      const next = parse(readFileSync(p, 'utf8'))
      const taken = takePermissionsPatch(next)
      applyLoadedPatch(merged, taken)
      if (p === workspaceFile) workspaceTaken = taken
    } catch {
      /* skip bad json */
    }
  }
  if (workspaceTaken) pinWorkspaceInstructions(merged, workspaceTaken)
  return merged
}

export function seedPermissions(workspace: string): void {
  const dest = join(workspace, 'data', 'permissions.json')
  if (existsSync(dest)) return
  mkdirSync(join(workspace, 'data'), { recursive: true })
  writeFileSync(dest, JSON.stringify(DEFAULT_PERMISSIONS, null, 2), 'utf8')
}

export function savePermissions(workspace: string, file: PermissionsFile): PermissionsFile {
  const dest = join(workspace, 'data', 'permissions.json')
  mkdirSync(join(workspace, 'data'), { recursive: true })
  const taken = takePermissionsPatch({
    approvalMode: file?.approvalMode ?? 'allowlist',
    terminalAllowlist: file?.terminalAllowlist ?? [],
    mcpAllowlist: file?.mcpAllowlist ?? [],
    netAllowlist: file?.netAllowlist ?? [],
    fsExtraRoots: file?.fsExtraRoots ?? [],
    autoRun: file?.autoRun,
    autoReview: file?.autoReview
  })
  const next: PermissionsFile = {
    approvalMode: taken.approvalMode ?? 'allowlist',
    terminalAllowlist: taken.terminalAllowlist ?? [],
    mcpAllowlist: taken.mcpAllowlist ?? [],
    netAllowlist: taken.netAllowlist ?? [],
    fsExtraRoots: taken.fsExtraRoots ?? []
  }
  if (taken.autoRun) next.autoRun = taken.autoRun
  if (taken.autoReview) next.autoReview = taken.autoReview
  writeFileSync(
    dest,
    JSON.stringify(
      {
        ...next,
        autoRun: taken.autoRun ?? null,
        autoReview: taken.autoReview ?? null
      },
      null,
      2
    ),
    'utf8'
  )
  return loadPermissions(workspace)
}

export function commandAllowed(cmd: string, allow: string[]): boolean {
  const c = cmd.trim().replace(/^sudo\s+/, '')
  return allow.some((p) => {
    const pat = p.trim()
    if (!pat) return false
    if (pat === '*') return true
    return c === pat || c.startsWith(pat)
  })
}

export { urlAllowed }

export function mcpToolAllowed(server: string, tool: string, allow: string[]): boolean {
  const key = `${server}:${tool}`
  return allow.some((p) => {
    if (p === '*:*') return true
    if (p === `${server}:*`) return true
    if (p === `*:${tool}`) return true
    return p === key
  })
}

export function decideTool(opts: {
  perms: PermissionsFile
  permission: 'read' | 'write' | 'net' | 'exec'
  tool: string
  detail: string
  extraRoot?: boolean
}): 'allow' | 'deny' | 'ask' {
  if (opts.permission === 'read') return 'allow'
  if (extraRootWriteAsks(opts.permission, opts.extraRoot)) return extraRootWriteDecision()
  if (opts.perms.approvalMode === 'auto-review') {
    return runAutoReviewPipeline({
      perms: opts.perms,
      permission: opts.permission,
      tool: opts.tool,
      detail: opts.detail,
      extraRoot: opts.extraRoot
    }).verdict
  }
  if (opts.perms.approvalMode === 'unrestricted') return 'allow'
  if (opts.perms.approvalMode === 'manual') {
    if (opts.permission === 'write' && (opts.tool === 'fs_write' || opts.tool === 'str_replace')) return 'allow'
    return 'ask'
  }
  if (opts.permission === 'exec') {
    return commandAllowed(opts.detail, opts.perms.terminalAllowlist) ? 'allow' : 'ask'
  }
  if (opts.permission === 'net') {
    return urlAllowed(opts.detail, opts.perms.netAllowlist) ? 'allow' : 'ask'
  }
  return 'allow'
}

export type { ApprovalMode }

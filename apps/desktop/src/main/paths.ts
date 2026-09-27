import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_MODEL_NAME } from '@homeai/core'
import {
  takeAppRoots,
  takeLastWorkspaceFile,
  takeModelPath,
  takeRootsState,
  takeWorkspaceJail
} from '@homeai/runtime'

const here = dirname(fileURLToPath(import.meta.url))

export type HexRoots = ReturnType<typeof takeAppRoots> & {
  onboardDone: boolean
  crashOptIn: 'local' | 'off'
}

let cached: HexRoots | null = null

function operatorFallback(): string {
  if (process.env.HOME_AI_ROOT) return resolve(process.env.HOME_AI_ROOT)
  const candidates = [
    process.cwd(),
    join(process.cwd(), '..'),
    resolve(here, '../../../..'),
    resolve(here, '../../..')
  ]
  for (const c of candidates) {
    if (existsSync(join(c, 'package.json'))) return c
  }
  for (const c of candidates) {
    if (existsSync(join(c, DEFAULT_MODEL_NAME))) return c
  }
  return process.cwd()
}

export function loadRoots(force = false): HexRoots {
  if (cached && !force) return cached
  const ready = app.isReady()
  const userData = ready ? takeWorkspaceJail(app.getPath('userData')) : ''
  const home = ready ? takeWorkspaceJail(app.getPath('home')) : ''
  const lastFile = takeLastWorkspaceFile(userData)
  let state = { workspace: '', onboardDone: false as boolean, crashOptIn: 'off' as const | 'local' }
  try {
    if (lastFile && existsSync(lastFile)) {
      state = takeRootsState(JSON.parse(readFileSync(lastFile, 'utf8')))
    }
  } catch {
    /* ignore bad json */
  }
  const packaged = ready ? app.isPackaged : false
  const taken = takeAppRoots({
    packaged,
    userData,
    home,
    cwd: operatorFallback(),
    appPath: ready ? app.getAppPath() : operatorFallback(),
    envRoot: process.env.HOME_AI_ROOT || '',
    lastWorkspace: state.workspace,
    resourcesPath: ready ? process.resourcesPath : ''
  })
  cached = { ...taken, onboardDone: state.onboardDone, crashOptIn: state.crashOptIn }
  return cached
}

export function saveRootsPatch(patch: { workspace?: string; onboardDone?: boolean; crashOptIn?: 'local' | 'off' }): HexRoots {
  const cur = loadRoots()
  const next = takeRootsState({
    workspace: patch.workspace ?? cur.workspace,
    onboardDone: patch.onboardDone ?? cur.onboardDone,
    crashOptIn: patch.crashOptIn ?? cur.crashOptIn
  })
  const profile = cur.profile
  if (profile) {
    mkdirSync(profile, { recursive: true, mode: 0o700 })
    const dest = takeLastWorkspaceFile(profile)
    if (dest) writeFileSync(dest, JSON.stringify(next), { encoding: 'utf8', mode: 0o600 })
  }
  cached = { ...cur, ...next, workspace: next.workspace || cur.workspace }
  return cached
}

export function clearRootsCache(): void {
  cached = null
}

/** App resources (vendor, renderer). Not the user workspace when packaged. */
export function projectRoot(): string {
  return loadRoots().appResources || operatorFallback()
}

export function profileDir(): string {
  return loadRoots().profile
}

export function modelPath(_root?: string): string {
  return takeModelPath(loadRoots(), existsSync, DEFAULT_MODEL_NAME)
}

export function dataDir(root: string): string {
  const p = loadRoots().profile
  if (p) return p
  return join(root, 'data')
}

export function secretsDir(_root?: string): string {
  return loadRoots().secretsDir || join(operatorFallback(), 'data', 'secrets')
}

export function ragDbPath(_root?: string): string {
  const p = loadRoots().profile
  return join(p || join(operatorFallback(), 'data'), 'rag.db')
}

export function vendorDir(_root?: string): string {
  return loadRoots().vendorDir || join(operatorFallback(), 'vendor')
}

export function defaultWorkspace(): string {
  return loadRoots().workspace || operatorFallback()
}

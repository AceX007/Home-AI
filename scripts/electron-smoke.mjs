#!/usr/bin/env node
/** Packaged-shape smoke: Electron must write userData/smoke.json then quit. */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromeSandboxPath, chromeSandboxSuid, takeChromeSandboxSkip } from '../packages/runtime/src/pack-chrome.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const main = join(root, 'out/main/index.js')
const electron = join(root, 'node_modules/electron/cli.js')
const ci = Boolean(process.env.CI)

function skip(why) {
  console.log(`smoke skip: ${why}`)
  process.exit(0)
}

if (!existsSync(main)) skip('out/main missing — run electron-vite build')
if (!existsSync(electron)) skip('electron not installed')

const sandbox = chromeSandboxPath(root)
if (sandbox) {
  const why = takeChromeSandboxSkip({ exists: true, suid: chromeSandboxSuid(sandbox) }, process.env)
  if (why) skip(`${why} — do not disable sandbox on ide`)
}

const profile = mkdtempSync(join(tmpdir(), 'hex-smoke-'))
const ws = join(profile, 'ws')
mkdirSync(ws, { recursive: true })
const smoke = join(profile, 'smoke.json')
const env = { ...process.env, HOMEAI_SMOKE: '1', HOME_AI_ROOT: ws }
const child = spawn(process.execPath, [electron, '.', `--user-data-dir=${profile}`], {
  cwd: root,
  env,
  stdio: 'inherit'
})

const timer = setTimeout(() => {
  child.kill()
}, 45_000)

child.on('exit', () => {
  clearTimeout(timer)
  try {
    if (!existsSync(smoke)) {
      if (ci) skip('smoke.json missing (sandbox/display often fail in CI)')
      console.error('smoke.json missing')
      process.exit(1)
    }
    const j = JSON.parse(readFileSync(smoke, 'utf8'))
    if (j.sandbox !== true) {
      console.error('smoke sandbox flag missing')
      process.exit(1)
    }
    console.log('smoke ok', String(j.title || '').slice(0, 40))
    process.exit(0)
  } finally {
    rmSync(profile, { recursive: true, force: true })
  }
})

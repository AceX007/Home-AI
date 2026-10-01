#!/usr/bin/env node
/** Fresh-clone check. Prints the command that opens Hex AI. Does not disable the sandbox. */
import { createRequire } from 'node:module'
import { existsSync, watch } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  chromeSandboxPath,
  chromeSandboxSuid,
  takeInstallPlan,
  takeLlamaAsset,
  takeWatchHint
} from '../packages/runtime/src/pack-chrome.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))

function nativeOk() {
  try {
    require('better-sqlite3')
    require('node-pty')
    return true
  } catch {
    return false
  }
}

const sandbox = chromeSandboxPath(root)
const llama =
  existsSync(join(root, 'vendor/bin/llama-server')) || existsSync(join(root, 'vendor/bin/llama-server.exe'))
const plan = takeInstallPlan({
  nodeMajor: Number(process.versions.node.split('.')[0]),
  platform: process.platform,
  sandboxSuid: sandbox ? chromeSandboxSuid(sandbox) : process.platform !== 'linux',
  electron: existsSync(join(root, 'node_modules/electron/cli.js')),
  llama,
  nativeOk: nativeOk()
})

console.log('Hex AI install check')
console.log(`node ${process.versions.node} · llama asset ${takeLlamaAsset(process.platform, process.arch) || 'unsupported arch'}`)
if (plan.blockers.length) {
  for (const line of plan.blockers) console.error(`blocked: ${line}`)
  console.error('On Linux/macOS install build tools (python3, make, g++) then run npm install again.')
  process.exit(1)
}
let watchCode = ''
try {
  const probe = watch(root, { persistent: false }, () => {})
  probe.close()
} catch (err) {
  watchCode = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
}
const watches = takeWatchHint(watchCode)
console.log(`open with: ${plan.command}`)
if (watches) console.log(`wait: ${watches}`)
for (const step of plan.steps) {
  if (step !== plan.command) console.log(`then: ${step}`)
}
if (!llama) console.log('The window opens without a model. Chat stays offline until llama-server and the GGUF are present.')

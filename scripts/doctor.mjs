#!/usr/bin/env node
/** Fresh-clone check. Prints the command that opens Hex AI. Does not disable the sandbox. */
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, readlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  chromeSandboxPath,
  chromeSandboxSuid,
  takeInstallPlan,
  takeLlamaAsset
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
let watches = ''
if (process.platform === 'linux') {
  try {
    const max = Number(readFileSync('/proc/sys/fs/inotify/max_user_instances', 'utf8'))
    let used = 0
    for (const pid of readdirSync('/proc')) {
      if (!/^\d+$/.test(pid)) continue
      let fds = []
      try {
        fds = readdirSync(`/proc/${pid}/fd`)
      } catch {
        continue
      }
      for (const fd of fds) {
        try {
          if (readlinkSync(`/proc/${pid}/fd/${fd}`) === 'anon_inode:inotify') used += 1
        } catch {
          /* fd vanished */
        }
      }
    }
    if (Number.isFinite(max) && used >= max) {
      watches = `file watches are full (${used}/${max}). Close other apps, then run the command again.`
    }
  } catch {
    /* not a Linux procfs */
  }
}
console.log(`open with: ${plan.command}`)
if (watches) console.log(`wait: ${watches}`)
for (const step of plan.steps) {
  if (step !== plan.command) console.log(`then: ${step}`)
}
if (!llama) console.log('The window opens without a model. Chat stays offline until llama-server and the GGUF are present.')

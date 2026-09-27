import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  NodeDebugHost,
  takeDebugContinue,
  takeDebugEval,
  takeDebugLaunch,
  takeDebugBreakpoint,
  takeInspectWs,
  takeTestFailure
} from './index.mjs'

const roots = []
const hosts = []
const here = dirname(fileURLToPath(import.meta.url))

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'hex-debug-'))
  roots.push(root)
  writeFileSync(
    join(root, 'hit.mjs'),
    'const local = 42\nfunction hold() {\n  const value = local\n  return value\n}\nhold()\n'
  )
  return root
}

afterEach(async () => {
  for (const host of hosts.splice(0)) {
    try {
      await host.stop()
    } catch {
      /* tmp */
    }
  }
  for (const root of roots.splice(0)) {
    try {
      rmSync(root, { recursive: true, force: true })
    } catch {
      /* tmp */
    }
  }
})

describe('Node Inspector jail — T-128', () => {
  it('denies extra-root launch, public inspector URLs, and side-effect evaluate', () => {
    assert.equal(takeDebugLaunch({ path: '../secret.mjs' }), null)
    assert.equal(takeDebugLaunch({ path: 'hit.mjs', args: [';id'] }), null)
    assert.equal(takeDebugLaunch({ path: 'hit.mjs', args: ['--inspect'] }), null)
    assert.equal(takeDebugLaunch({ path: 'hit.mjs' })?.path, 'hit.mjs')
    assert.equal(takeInspectWs('ws://0.0.0.0:9229/abcd'), null)
    assert.match(takeInspectWs('Debugger listening on ws://127.0.0.1:41234/abcdef'), /^ws:\/\/127\.0\.0\.1:41234\//)
    assert.equal(takeDebugEval('process.exit()'), null)
    assert.equal(takeDebugEval('require("fs")'), null)
    assert.equal(takeDebugEval('local'), 'local')
    assert.equal(takeDebugEval({ expression: '1+1' }), '1+1')
    assert.equal(takeDebugBreakpoint({ path: '../x.js', line: 3 }), null)
    assert.equal(takeDebugContinue('eval'), null)
    assert.equal(takeDebugContinue('stepOver'), 'stepOver')
    assert.equal(takeTestFailure("location: '/tmp/x/hit.test.mjs:12:3'").line, 12)
    assert.equal(takeTestFailure('at ../etc/passwd:1'), null)
    assert.equal(takeTestFailure('at hold (hit.test.mjs:12:3)').line, 12)
    assert.equal(takeTestFailure('at hold (file:///tmp/x/hit.test.mjs:12:3)').path, '/tmp/x/hit.test.mjs')
    assert.equal(takeTestFailure('at hold (https://evil.example/hit.test.mjs:12:3)'), null)
    const src = readFileSync(join(here, 'index.mjs'), 'utf8')
    assert.match(src, /from 'node:child_process'/)
    assert.match(src, /inspect-brk=127\.0\.0\.1/)
    assert.equal(src.includes('node-pty'), false)
    assert.equal(src.includes('pty-host'), false)
    assert.equal(src.includes('--inspect-brk=0.0.0.0'), false)
    assert.match(src, /throwOnSideEffect:\s*true/)
    assert.equal((src.match(/evaluateOnCallFrame/g) || []).length, 1)
  })

  it('hits a jailed breakpoint, exposes a primitive, continues, and stops', { timeout: 20_000 }, async () => {
    const root = fixture()
    const host = new NodeDebugHost(root)
    hosts.push(host)
    const file = join(root, 'hit.mjs')
    await assert.rejects(() => host.start({ path: '/etc/passwd' }), /workspace jail/)
    await host.breakpoint({ path: file, line: 3 })
    const paused = await host.start({ path: file })
    assert.equal(paused.status, 'paused')
    assert.equal(paused.path, 'hit.mjs')
    assert.ok(paused.frames.some((row) => row.path === 'hit.mjs'))
    assert.ok(paused.locals.some((row) => row.name === 'local' && String(row.value).includes('42')))
    const value = await host.evaluate('local')
    assert.equal(value, '42')
    await host.continue({ kind: 'continue' })
    const stopped = await host.stop()
    assert.equal(stopped.status, 'exited')
    assert.equal(stopped.port, null)
  })
})

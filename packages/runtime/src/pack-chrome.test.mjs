import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  GGUF_RELEASE,
  PACK_EXCLUDE,
  builderExcludes,
  checksumMatches,
  modelDownloadPlan,
  publicDiagnostics,
  releaseScriptsOk,
  takeBuilderFiles,
  takeCrashOptIn,
  takeGgufUrl,
  takeHardwareGate,
  takeHuntPreventDiff,
  takeGgufReady,
  takeLlamaAsset,
  takePartialDest,
  takePreloadBridge,
  takeRangeHeader,
  sha256File,
  takeRetryAfterMs,
  takeStoreListing,
  takeUpdateFeed,
  takeUpdateProvider,
  takeChromeSandboxSkip,
  chromeSandboxSuid,
  assertGgufSize
} from './pack-chrome.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('pack chrome jail — T-107', () => {
  it('GGUF URL is huggingface https with the default filename', () => {
    assert.equal(takeGgufUrl('http://evil.test/x.gguf'), '')
    assert.equal(takeGgufUrl('https://evil.test/Qwen3.5-2B-Q8_0.gguf'), '')
    assert.ok(takeGgufUrl(GGUF_RELEASE.url).startsWith('https://huggingface.co/'))
    assert.ok(takeGgufUrl(GGUF_RELEASE.url).endsWith('Qwen3.5-2B-Q8_0.gguf'))
    assert.equal(checksumMatches('ab', ''), true)
    assert.equal(checksumMatches('aa'.repeat(32), 'bb'.repeat(32)), false)
    const plan = modelDownloadPlan('/tmp/ud/models')
    assert.ok(plan.dest.endsWith('Qwen3.5-2B-Q8_0.gguf'))
    assert.equal(plan.dest.includes('..'), false)
  })

  it('hardware gate and diagnostics drop tokens', () => {
    const low = takeHardwareGate({ totalMem: 1e9, freeDisk: 1e9 })
    assert.equal(low.ok, false)
    const ok = takeHardwareGate({ totalMem: 8e9, freeDisk: 4e9 })
    assert.equal(ok.ok, true)
    const d = publicDiagnostics({
      version: '<b>1</b>',
      llama: 'missing',
      packaged: true,
      sandbox: true,
      model: true,
      crashOptIn: 'local',
      ports: [
        { name: 'llama', port: 8765 },
        { name: 'telegram-token', port: 9 }
      ]
    })
    assert.equal(d.version.includes('<'), false)
    assert.equal(d.llama, 'missing')
    assert.equal(d.ports.some((p) => /token/i.test(p.name)), false)
    assert.equal(takeCrashOptIn('local'), 'local')
    assert.equal(takeCrashOptIn('sentry'), 'off')
  })

  it('update feed, llama assets, store listing stay local-first', async () => {
    assert.equal(takeUpdateFeed(), 'https://github.com/hex-ai/workbench/releases')
    assert.deepEqual(takeUpdateProvider(), { provider: 'github', owner: 'hex-ai', repo: 'workbench' })
    assert.equal(takePartialDest('/tmp/ud/models/Qwen3.5-2B-Q8_0.gguf'), '/tmp/ud/models/Qwen3.5-2B-Q8_0.gguf.partial')
    assert.equal(takePartialDest('/tmp/../etc.gguf'), '')
    assert.equal(takeRangeHeader(0), '')
    assert.equal(takeRangeHeader(1024), 'bytes=1024-')
    assert.equal(assertGgufSize(200e6, 100e6), true)
    assert.equal(assertGgufSize(10, 100e6), false)
    assert.equal(takeGgufReady({ dest: '/tmp/ud/models/Qwen3.5-2B-Q8_0.gguf', bytes: 200e6, minBytes: 100e6, gotSha: '', wantSha: '' }).ok, true)
    assert.equal(takeGgufReady({ dest: '/tmp/../etc.gguf', bytes: 200e6, minBytes: 100e6 }).ok, false)
    assert.equal(takeGgufReady({ dest: '/tmp/ud/models/Qwen3.5-2B-Q8_0.gguf', bytes: 10, minBytes: 100e6 }).hint, 'file too small')
    assert.equal(
      takeGgufReady({
        dest: '/tmp/ud/models/Qwen3.5-2B-Q8_0.gguf',
        bytes: 200e6,
        minBytes: 100e6,
        gotSha: 'aa'.repeat(32),
        wantSha: 'bb'.repeat(32)
      }).hint,
      'checksum'
    )
    const dir = join(tmpdir(), 'hex-gguf-hash')
    mkdirSync(dir, { recursive: true })
    const sample = join(dir, 'Qwen3.5-2B-Q8_0.gguf')
    writeFileSync(sample, 'hex-gguf')
    const digest = await sha256File(sample)
    assert.equal(digest.length, 64)
    assert.equal(await sha256File('../etc/passwd'), '')
    assert.equal(await sha256File('/etc/passwd'), '')
    assert.equal(takeUpdateFeed({ owner: '../x', repo: 'y' }), '')
    assert.equal(takeLlamaAsset('linux', 'x64'), 'ubuntu-vulkan-x64')
    assert.equal(takeLlamaAsset('darwin', 'arm64'), 'macos-arm64')
    assert.equal(takeLlamaAsset('win32', 'x64'), 'win-cpu-x64')
    assert.equal(takeLlamaAsset('sunos', 'x64'), '')
    const stores = takeStoreListing()
    assert.equal(stores.githubReleases, true)
    assert.equal(stores.flathub, false)
    assert.equal(stores.winget, false)
  })

  it('release scripts must not disable Chromium sandbox; builder excludes operator trees', () => {
    assert.equal(releaseScriptsOk({ ide: 'electron-vite build && electron .', preview: 'electron-vite preview' }), true)
    assert.equal(releaseScriptsOk({ ide: 'ELECTRON_DISABLE_SANDBOX=1 electron .' }), false)
    assert.equal(builderExcludes(takeBuilderFiles()), true)
    assert.ok(PACK_EXCLUDE.includes('AI Resources'))
    assert.ok(PACK_EXCLUDE.includes('data/secrets'))
  })

  it('preload expose is homeai only; hunt diffs need a prevent artifact — T-108', () => {
    const preload = readFileSync(join(repo, 'apps/desktop/src/preload/index.ts'), 'utf8')
    const bridge = takePreloadBridge(preload)
    assert.equal(bridge.onlyHomeai, true)
    assert.equal(bridge.noWindowIpc, true)
    assert.deepEqual(takeHuntPreventDiff('diff --git a/foo b/foo\n+ok'), { ok: true, reason: 'no hunt surface' })
    assert.equal(takeHuntPreventDiff('diff --git a/skills/hunt-xss/SKILL.md b/x\n+payload').ok, false)
    assert.equal(
      takeHuntPreventDiff(
        'diff --git a/skills/hunt-xss/SKILL.md b/x\ndiff --git a/data/bug-memory/anti-patterns.md\n+AP-20260904-99'
      ).ok,
      true
    )
    assert.equal(takeRetryAfterMs('2', {}), 2000)
    assert.equal(takeRetryAfterMs('', { parameters: { retry_after: 5 } }), 5000)
    assert.equal(takeRetryAfterMs('99999', {}), 120000)
  })

  it('smoke skips when chrome-sandbox is not SUID — T-132', () => {
    assert.equal(takeChromeSandboxSkip({ exists: true, suid: false }), 'chrome-sandbox is not SUID')
    assert.equal(takeChromeSandboxSkip({ exists: true, suid: true }), '')
    assert.equal(takeChromeSandboxSkip({ exists: true, suid: false }, { ELECTRON_DISABLE_SANDBOX: '1' }), '')
    assert.equal(chromeSandboxSuid('/no/such/chrome-sandbox'), false)
    const smoke = readFileSync(join(repo, 'scripts/electron-smoke.mjs'), 'utf8')
    assert.match(smoke, /takeChromeSandboxSkip/)
    assert.match(smoke, /do not disable sandbox on ide/)
    assert.equal(smoke.includes('ELECTRON_DISABLE_SANDBOX=1'), false)
  })
})

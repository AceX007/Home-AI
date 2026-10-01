import { createHash } from 'node:crypto'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { DEFAULT_GGUF_NAME, takeWorkspaceJail, takeGgufDest } from './app-roots.mjs'

export const PACK_EXCLUDE = [
  'AI Resources',
  'Repos',
  'data/secrets',
  '*.gguf',
  '.git',
  'cursor_*.deb',
  'cursor_*.AppImage'
]

/** Hugging Face only; filename must be the default GGUF. Checksum may be empty until pinned. */
export const GGUF_RELEASE = {
  url: 'https://huggingface.co/Qwen/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q8_0.gguf',
  sha256: '',
  minBytes: 100 * 1024 * 1024
}

export const UPDATE_FEED = {
  provider: 'github',
  owner: 'hex-ai',
  repo: 'workbench'
}

export function takeGgufUrl(raw) {
  const s = String(raw || GGUF_RELEASE.url)
  let u
  try {
    u = new URL(s)
  } catch {
    return ''
  }
  if (u.protocol !== 'https:') return ''
  if (u.hostname !== 'huggingface.co') return ''
  if (u.pathname.includes('..') || u.username || u.password) return ''
  if (!u.pathname.endsWith('/' + DEFAULT_GGUF_NAME) && !u.pathname.endsWith(DEFAULT_GGUF_NAME)) return ''
  return u.toString()
}

export function takeSha256(raw) {
  const s = String(raw || '').trim().toLowerCase()
  return /^[0-9a-f]{64}$/.test(s) ? s : ''
}

export function checksumMatches(got, want) {
  const w = takeSha256(want)
  if (!w) return true
  return takeSha256(got) === w
}

export function takeHardwareGate(raw = {}) {
  const ram = Number(raw.totalMem) || 0
  const disk = Number(raw.freeDisk) || 0
  const needRam = 6 * 1024 * 1024 * 1024
  const needDisk = 3 * 1024 * 1024 * 1024
  const ramOk = ram >= needRam
  const diskOk = disk >= needDisk
  return {
    ramOk,
    diskOk,
    ok: ramOk && diskOk,
    hint: !ramOk
      ? 'This machine is under 6 GB RAM. Local 2B Q8 may page. Cloud keys are optional.'
      : !diskOk
        ? 'Need about 3 GB free for the GGUF. Download skipped until there is room.'
        : 'RAM and disk look enough for a local 2B.'
  }
}

export function publicDiagnostics(raw = {}) {
  const llama = raw.llama === 'on' || raw.llama === 'off' || raw.llama === 'missing' ? raw.llama : 'off'
  const ports = Array.isArray(raw.ports)
    ? raw.ports
        .slice(0, 12)
        .map((p) => ({
          name: String(p?.name || '')
            .replace(/[<>]/g, '')
            .slice(0, 32),
          port: Number(p?.port) || 0
        }))
        .filter((p) => p.port > 0 && p.port < 65536 && !/key|token|secret/i.test(p.name))
    : []
  const version = String(raw.version || '')
    .replace(/[<>]/g, '')
    .slice(0, 16)
  return {
    version,
    llama,
    packaged: Boolean(raw.packaged),
    sandbox: raw.sandbox === true,
    model: raw.model === true,
    crashOptIn: raw.crashOptIn === 'local' ? 'local' : 'off',
    ports
  }
}

export function takeCrashOptIn(raw) {
  return raw === 'local' || raw === true ? 'local' : 'off'
}

export function takePartialDest(dest) {
  const d = takeWorkspaceJail(dest)
  if (!d || !d.endsWith('.gguf')) return ''
  return `${d}.partial`
}

export function takeGgufReady(raw = {}) {
  const dest = takeWorkspaceJail(raw.dest)
  if (!dest || !dest.endsWith('.gguf')) return { ok: false, hint: 'bad dest' }
  if (!assertGgufSize(raw.bytes, raw.minBytes)) return { ok: false, hint: 'file too small' }
  if (!checksumMatches(raw.gotSha, raw.wantSha)) return { ok: false, hint: 'checksum' }
  return { ok: true, dest }
}

export async function sha256File(path) {
  const p = takeWorkspaceJail(path)
  if (!p) return ''
  if (!p.endsWith('.gguf') && !p.endsWith('.gguf.partial')) return ''
  const hash = createHash('sha256')
  await pipeline(createReadStream(p), hash)
  return hash.digest('hex')
}

export function takeRangeHeader(existingBytes) {
  const n = Math.max(0, Number(existingBytes) || 0)
  if (n <= 0) return ''
  return `bytes=${n}-`
}

export function assertGgufSize(bytes, minBytes) {
  const n = Number(bytes) || 0
  const min = Number(minBytes) || 0
  return n >= min
}

export function takeUpdateProvider(raw) {
  const feed = takeUpdateFeed(raw)
  if (!feed) return null
  const o = raw && typeof raw === 'object' ? raw : UPDATE_FEED
  const owner = String(o.owner || UPDATE_FEED.owner).replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64)
  const repo = String(o.repo || UPDATE_FEED.repo).replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64)
  if (!owner || !repo) return null
  return { provider: 'github', owner, repo }
}

export function takeUpdateFeed(raw) {
  const o = raw && typeof raw === 'object' ? raw : UPDATE_FEED
  const owner = String(o.owner || '')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 64)
  const repo = String(o.repo || '')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 64)
  if (!owner || !repo || owner.includes('..') || repo.includes('..')) return ''
  return `https://github.com/${owner}/${repo}/releases`
}

export function takeLlamaAsset(platform, arch) {
  const p = String(platform || '')
  const a = String(arch || '')
  if (p === 'linux' && (a === 'x64' || a === 'x86_64')) return 'ubuntu-vulkan-x64'
  if (p === 'win32' && a === 'x64') return 'win-cpu-x64'
  if (p === 'darwin' && (a === 'arm64' || a === 'aarch64')) return 'macos-arm64'
  if (p === 'darwin' && a === 'x64') return 'macos-x64'
  return ''
}

export function releaseScriptsOk(scripts) {
  const s = scripts && typeof scripts === 'object' ? scripts : {}
  for (const key of ['ide', 'preview', 'start', 'telegram', 'pack', 'release', 'dist']) {
    const v = String(s[key] || '')
    if (v.includes('ELECTRON_DISABLE_SANDBOX')) return false
  }
  return true
}

export function builderExcludes(files) {
  const list = Array.isArray(files) ? files.map(String) : []
  const blob = list.join('\n')
  return PACK_EXCLUDE.every((bit) => blob.includes(bit) || blob.includes(`!${bit}`) || blob.includes(`!**/${bit}`))
}

export function takePreloadBridge(src) {
  const s = String(src || '')
  return {
    onlyHomeai: /exposeInMainWorld\(\s*['"]homeai['"]/.test(s) && !/exposeInMainWorld\(\s*['"]electron['"]/.test(s),
    noWindowIpc: !/window\.ipcRenderer/.test(s) && !/globalThis\.ipcRenderer/.test(s),
    noNodeRequire: !/nodeIntegration:\s*true/.test(s)
  }
}

export function takeHuntPreventDiff(diff) {
  const d = String(diff || '')
  const hunts = /(?:^|\n)diff --git .*(?:hunt-|full-stack-hunt-prevent)/m.test(d) || /skills\/hunt-/.test(d)
  if (!hunts) return { ok: true, reason: 'no hunt surface' }
  const hasAp = /anti-patterns\.md/.test(d) && /AP-\d{8}-\d+/.test(d)
  const hasTest = /\.test\.mjs/.test(d)
  if (hasAp || hasTest) return { ok: true, reason: 'prevent artifact' }
  return { ok: false, reason: 'hunt edit without AP or test' }
}

export function takeRetryAfterMs(header, json) {
  const h = Number(header)
  if (Number.isFinite(h) && h > 0) {
    return Math.min(120_000, Math.floor(h * 1000))
  }
  const p = Number(json?.parameters?.retry_after)
  if (Number.isFinite(p) && p > 0) return Math.min(120_000, Math.floor(p * 1000))
  return 0
}

export function takeStoreListing() {
  return { flathub: false, winget: false, homebrew: false, githubReleases: true }
}

export function modelDownloadPlan(modelsDir) {
  const dest = takeGgufDest(modelsDir, DEFAULT_GGUF_NAME)
  const url = takeGgufUrl(GGUF_RELEASE.url)
  if (!dest || !url) return null
  return { dest, url, minBytes: GGUF_RELEASE.minBytes, sha256: takeSha256(GGUF_RELEASE.sha256) }
}

export function takeBuilderFiles() {
  return [
    'out/**',
    'package.json',
    ...PACK_EXCLUDE.map((bit) => (bit.startsWith('*.') ? `!${bit}` : `!${bit}/**`))
  ]
}

export function chromeSandboxSuid(path) {
  if (!path || typeof path !== 'string' || path.includes('\0')) return false
  try {
    return (statSync(path).mode & 0o4000) !== 0
  } catch {
    return false
  }
}

export function takeChromeSandboxSkip(info, env = {}) {
  if (!info || typeof info !== 'object' || Array.isArray(info)) return ''
  if (String(env.ELECTRON_DISABLE_SANDBOX || '') === '1') return ''
  if (info.exists && !info.suid) return 'chrome-sandbox is not SUID'
  return ''
}

/** What a fresh clone should run. Never recommends disabling the sandbox on ide. */
export function takeInstallPlan(raw = {}) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const nodeMajor = Number(o.nodeMajor)
  const platform = String(o.platform || '')
  const blockers = []
  const steps = []
  if (!Number.isFinite(nodeMajor) || nodeMajor < 22) blockers.push('Node.js 22 or newer is required')
  if (!o.nativeOk) blockers.push('native modules did not build (better-sqlite3, node-pty)')
  if (!o.electron) blockers.push('Electron is not installed (npm install)')
  if (!o.llama) steps.push('npm run vendor:llama')
  steps.push('Settings → Hardware → Download GGUF (about 2 GB, not stored in git)')
  const linuxNeedsDev = platform === 'linux' && o.sandboxSuid !== true
  if (linuxNeedsDev) {
    steps.push('npm run dev')
    steps.push('npm run ide stays sandboxed and will not start until chrome-sandbox is setuid')
  } else {
    steps.push('npm run ide')
  }
  return {
    ok: blockers.length === 0,
    command: blockers.length ? '' : linuxNeedsDev ? 'npm run dev' : 'npm run ide',
    blockers,
    steps
  }
}

export function chromeSandboxPath(root) {
  const candidate = `${String(root || '').replace(/\/+$/, '')}/node_modules/electron/dist/chrome-sandbox`
  return existsSync(candidate) ? candidate : ''
}

export const PACK_EXCLUDE: string[]
export const GGUF_RELEASE: { url: string; sha256: string; minBytes: number }
export const UPDATE_FEED: { provider: string; owner: string; repo: string }
export function takeGgufUrl(raw?: unknown): string
export function takeSha256(raw: unknown): string
export function checksumMatches(got: unknown, want: unknown): boolean
export function takeHardwareGate(raw?: { totalMem?: number; freeDisk?: number }): {
  ramOk: boolean
  diskOk: boolean
  ok: boolean
  hint: string
}
export function publicDiagnostics(raw?: Record<string, unknown>): {
  version: string
  llama: string
  packaged: boolean
  sandbox: boolean
  model: boolean
  crashOptIn: 'local' | 'off'
  ports: Array<{ name: string; port: number }>
}
export function takeCrashOptIn(raw: unknown): 'local' | 'off'
export function takePartialDest(dest: unknown): string
export function takeGgufReady(raw?: {
  dest?: unknown
  bytes?: unknown
  minBytes?: unknown
  gotSha?: unknown
  wantSha?: unknown
}): { ok: boolean; hint?: string; dest?: string }
export function sha256File(path: unknown): Promise<string>
export function takeRangeHeader(existingBytes: unknown): string
export function assertGgufSize(bytes: unknown, minBytes: unknown): boolean
export function takeUpdateProvider(raw?: unknown): { provider: 'github'; owner: string; repo: string } | null
export function takeUpdateFeed(raw?: unknown): string
export function takeLlamaAsset(platform: unknown, arch: unknown): string
export function releaseScriptsOk(scripts: unknown): boolean
export function builderExcludes(files: unknown): boolean
export function takePreloadBridge(src: unknown): { onlyHomeai: boolean; noWindowIpc: boolean; noNodeRequire: boolean }
export function takeHuntPreventDiff(diff: unknown): { ok: boolean; reason: string }
export function takeRetryAfterMs(header: unknown, json?: unknown): number
export function takeStoreListing(): { flathub: boolean; winget: boolean; homebrew: boolean; githubReleases: boolean }
export function modelDownloadPlan(modelsDir: unknown): { dest: string; url: string; minBytes: number; sha256: string } | null
export function takeBuilderFiles(): string[]
export function chromeSandboxSuid(path: unknown): boolean
export function takeChromeSandboxSkip(
  info: unknown,
  env?: { ELECTRON_DISABLE_SANDBOX?: string }
): string
export function chromeSandboxPath(root: unknown): string
export function takeInstallPlan(raw?: {
  nodeMajor?: number
  platform?: string
  sandboxSuid?: boolean
  electron?: boolean
  llama?: boolean
  nativeOk?: boolean
}): { ok: boolean; command: string; blockers: string[]; steps: string[] }

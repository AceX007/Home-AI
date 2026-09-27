export function bugMemoryDirName(): string
export function ragIngestAllowed(rel: unknown): boolean
export function needsPerceivePack(mode: unknown): boolean
export function composePerceivePack(parts: unknown): string
export function fleetReceiptLine(snap: unknown): string
export function promoteRel(stamp: unknown): string
export function promoteDiscovery(input: unknown): {
  apply: boolean
  kind: string
  slug: string
  rel: string
  body: string
}
export function starterTrustRules(serverIds?: unknown): string[]
export function mergeStarterAllowlist(existing: unknown, serverIds?: unknown): string[]
export function designThinkRel(slug: unknown): string
export function designThinkMarkdown(opts: unknown): {
  ok: boolean
  errors: string[]
  rel: string
  markdown: string
  slug: string
  file: string
}
export function registerKernelRun(id: unknown, source: unknown, abort?: () => void): string
export function stopKernelRun(id: unknown): boolean
export function kernelRunOwner(id: unknown): string
export function forgetKernelRun(id: unknown): boolean
export function resetKernelRuns(): void
export function kernelRunCount(): number
export function kernelSurface(raw: unknown): 'desktop' | 'telegram' | 'miniapp'
export function scanDiscoveryDrafts(names: unknown): string[]
export function bootCurate(
  names: unknown,
  existing: unknown
): { apply: boolean; slug: string; body: string }
export function mergeGraphHits(fts: unknown, mcp?: unknown): Array<{ symbol: string }>
export function freezeToolList(defs: unknown): { names: readonly string[]; defs: unknown[]; hash: string }
export function filterFrozenTools(frozen: unknown, next: unknown): unknown[]
export function parseStructuralIndex(text: unknown, path: unknown): { path: string; symbols: string[]; imports: string[] }
export function impactBeforeEdit(
  index: unknown,
  path: unknown
): { warn: boolean; fanIn: number; callers: string[]; path: string }
export function curateSkillProposal(input: unknown): { apply: boolean; slug: string; body: string }
export function harnessRel(): string
export function takeHarness(raw: unknown): Record<string, unknown> | null
export function mintHarness(
  fingerprint: unknown,
  extra?: unknown
): { rel: string; harness: Record<string, unknown> | null; evolve: boolean }
export function graphRel(): string
export function takeStructuralGraph(raw: unknown): { nodes: Array<{ path: string; symbols: string[]; imports: string[]; callers: string[] }> }
export function buildStructuralGraph(files: unknown): { nodes: Array<{ path: string; symbols: string[]; imports: string[]; callers: string[] }> }
export function queryGraph(
  graph: unknown,
  query: unknown
): Array<{ path: string; symbol: string; callers: string[] }>
export function designFidelityReport(before: unknown, after: unknown, task: unknown): string
export function lspQuery(
  text: unknown,
  path: unknown,
  kind: unknown
): { ok: boolean; kind: string; rows: Array<Record<string, unknown>> }
export function takeDapEvidence(raw: unknown): Record<string, unknown> | null
export function dapEvidenceRel(id: unknown): string
export function gitImpactHunks(
  diff: unknown,
  index: unknown
): Array<{ path: string; fanIn: number; warn: boolean; callers: string[] }>
export function chromeDevtoolsDepth(name: unknown): boolean
export function designMeshRoute(task: unknown): string
export function sceneIrJail(raw: unknown): { rel: string; scene: Record<string, unknown> } | null
export function acpWorktreeName(raw: unknown): string
export function hitlStep(raw: unknown): { action: string; ms: number; reason: string; wait: boolean }
export function gatewayContinuity(surface: unknown, threadId: unknown): { surface: string; threadId: string }
export function dnaPlanRel(slug: unknown): string
export function dnaPlanFromRecipes(slugs: unknown, statusLine?: unknown): { ok: boolean; rel: string; markdown: string }
export function takeRecipeMeta(markdown: unknown): { id: string; title: string; stack: string; status: string }
export function takeRecipeMechanism(markdown: unknown): string
export function takeRecipePorts(markdown: unknown): Record<string, string>
export function dnaAppRel(slug: unknown, file: unknown): string
export function dnaIrRel(slug: unknown): string
export function dnaCliRel(slug: unknown): string
export function dnaApiRel(slug: unknown, file: unknown): string
export function dnaDesktopRel(slug: unknown, file: unknown): string
export function dnaArtifactAllowed(rel: unknown, slug: unknown): boolean
export function takeCapabilityIr(raw: unknown): Record<string, unknown> | null
export function validateCapabilityIr(
  raw: unknown
): { ok: boolean; errors: string[]; ir: Record<string, unknown> | null }
export function compileCapabilityIr(
  slugs: unknown,
  statusLine?: unknown,
  recipeDocs?: Array<{ slug?: unknown; markdown?: unknown }>
): { ok: boolean; errors: string[]; ir: Record<string, unknown> | null }
export function emitWebStatic(raw: unknown): Array<{ rel: string; body: string }>
export function emitCliRunner(raw: unknown): Array<{ rel: string; body: string }>
export function takeComposeRequest(raw: unknown): { action: 'compose' } | null
export function composeCapabilityResult(raw: unknown): Record<string, unknown> | null
export function emitApiLoopback(raw: unknown): Array<{ rel: string; body: string }>
export function emitDesktopShell(raw: unknown): Array<{ rel: string; body: string }>
export function dnaScaffoldFromRecipes(
  slugs: unknown,
  statusLine?: unknown,
  recipeDocs?: Array<{ slug?: unknown; markdown?: unknown }>
): { apply: boolean; ok: boolean; files: Array<{ rel: string; body: string }> }
export function outcomeRoute(input: unknown): 'local' | 'sidecar' | 'cloud'
export function harvestPortKind(kind: unknown): string | null
export function compilerOsHarvestIds(): string[]
export function meshKind(raw: unknown): string
export function sessionHits(hits: unknown): unknown[]

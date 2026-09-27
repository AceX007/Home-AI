export const FORGE_STEPS: readonly string[]

export function stripActivityText(s: string, max?: number): string
export function takeCrumbPrefix(rel: unknown, index: unknown): string | null
export function takeBufferOutline(text: unknown, query?: unknown): Array<{ line: number; label: string }>
export function countDiffLines(before: string, after: string): { adds: number; dels: number }

export interface ActivityItem {
  id?: string
  kind: string
  text?: string
  caption?: string
  tool?: string
  path?: string
  before?: string
  after?: string
  step?: string
}

export interface ActivityGroup {
  type: 'commands' | 'edits' | 'thought' | 'wait' | 'user' | 'assistant' | 'checkpoint' | 'error' | 'other'
  items: ActivityItem[]
  label: string
}

export function groupActivity(items: ActivityItem[], opts?: { density?: string }): ActivityGroup[]
export function takeActivityDensity(raw: unknown): 'compact' | 'comfortable' | 'spacious'
export function foldMin(density: unknown): number
export function formatAgo(ts: number, now: number): string
export function parseReviewHunks(text: string): Array<{ path: string; line: string }>
export function laneBuckets(rows: unknown): {
  running: Array<{ id: string; name: string; status: string; started: number; ended: number; tokens: string }>
  done: Array<{ id: string; name: string; status: string; started: number; ended: number; tokens: string }>
  error: Array<{ id: string; name: string; status: string; started: number; ended: number; tokens: string }>
}
export function publicTokens(raw: unknown): string
export function formatPublicTokens(n: unknown): string
export function parsePublicTokens(raw: unknown): number
export function takeSseUsage(json: unknown): number
export function takeUsageTotal(raw: unknown): number
export function lastForgeStep(items: ActivityItem[]): string
export function workflowForgeStep(log: ActivityItem[], wf?: { step?: string } | null): string
export function desktopOwnsAgentChunk(runId: unknown, rid: unknown, jobSource: unknown): boolean
export function forgePhaseIndex(step: string): number
export function formatDuration(ms: number): string
export function countRunningTasks(p: {
  busy?: boolean
  waitingShell?: boolean
  subRunning?: number
  cloudRunning?: number
  ptyCount?: number
  queueLen?: number
}): number
export function sessionPreview(log: ActivityItem[]): string
export const EFFORT_LABELS: readonly string[]
export function sessionTitle(raw: unknown): string
export function chatLink(id: unknown): string
export function projectTag(ws: unknown): string
export function takeEffort(n: unknown): number
export function filterTranscript(groups: ActivityGroup[], view: unknown): ActivityGroup[]
export function splitHuntVerify(rows: unknown): {
  hunt: Array<{ id: string; name: string; status: string; started: number; ended: number; tokens: string }>
  verify: Array<{ id: string; name: string; status: string; started: number; ended: number; tokens: string }>
}
export function chromeRoute(activity: unknown, cowork: unknown): 'design' | 'cowork' | 'code'
export function thinkPick(docs: unknown): {
  path: string
  status: string
  title: string
  files: string[]
} | null
export function lastForgeError(items: unknown): string
export function forgeIsFault(items: unknown): boolean
export const GO_TABS: readonly string[]
export function takeGoTab(raw: unknown): 'session' | 'mode' | 'stack' | 'skills' | null
export function publicSkillPeek(rows: unknown): Array<{ slash: string; name: string; hint: string }>
export function publicStackPeek(rows: unknown): Array<{ name: string }>
export function phasePips(done: unknown, total: unknown, cap?: number, running?: number): Array<'on' | 'off' | 'run'>
export function toolCallName(raw: unknown): string | null
export function publicToolCall(call: { id?: string; name?: string; arguments?: Record<string, unknown> } | null): {
  id: string
  name: string
  arguments: Record<string, never>
} | null

export type WorkflowLane = 'hunt' | 'verify' | 'critic' | 'trust'
export type WorkflowStatus = 'running' | 'done' | 'error' | 'stopped'

export interface WorkflowAgent {
  id: string
  name: string
  lane: WorkflowLane
  model: string
  tokens: string
  status: 'running' | 'done' | 'error'
  started: number
  ended: number
}

export interface WorkflowDto {
  id: string
  status: WorkflowStatus
  title: string
  description: string
  model: string
  started: number
  ended: number
  tokens: string
  tokensKind: '' | 'usage' | 'context'
  usageTotal: number
  pendingUsage: number
  criticSkipped: boolean
  criticLive: boolean
  step: string
  agents: WorkflowAgent[]
  fleet: string
}

export interface WorkflowPhaseCount {
  done: number
  total: number
  skipped: boolean
}

export function workflowId(raw: unknown): string
export function takeWorkflowModel(raw: unknown): string
export function takeWorkflowLane(raw: unknown, name?: unknown, step?: unknown, criticLive?: unknown): WorkflowLane
export function emptyWorkflow(): WorkflowDto
export function takeWorkflow(prev: WorkflowDto | null | undefined, chunk: unknown, meta?: {
  runId?: unknown
  task?: unknown
  title?: unknown
  goal?: unknown
  description?: unknown
  model?: unknown
  now?: unknown
}): WorkflowDto
export function reduceWorkflowChunks(chunks: unknown, meta?: {
  runId?: unknown
  task?: unknown
  title?: unknown
  goal?: unknown
  description?: unknown
  model?: unknown
  now?: unknown
}): WorkflowDto
export function splitWorkflowPhases(wf: unknown): {
  hunt: WorkflowAgent[]
  verify: WorkflowAgent[]
  critic: WorkflowAgent[]
  trust: WorkflowAgent[]
}
export function workflowPhases(wf: unknown): {
  trust: WorkflowPhaseCount
  hunt: WorkflowPhaseCount
  verify: WorkflowPhaseCount
  critic: WorkflowPhaseCount
}
export function workflowPhaseLine(wf: unknown): string
export function workflowTokenLabel(wf: unknown): string
export function workflowToSubagents(wf: unknown): Array<{
  id: string
  name: string
  started: number
  ended?: number
  tokens: string
  status: 'running' | 'done' | 'error'
  hint: string
  lane: WorkflowLane
  model: string
}>
export function workflowPips(rows: unknown): Array<'on' | 'off' | 'run'>

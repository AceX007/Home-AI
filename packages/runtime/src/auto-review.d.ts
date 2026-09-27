export type AutoReviewVerdict = 'allow' | 'ask' | 'deny'
export type AutoReviewStage = 'judge' | 'reviewer'
export type AutoReviewRisk = '' | 'low' | 'high' | 'too_destructive'
export type AutoReviewAuth = '' | 'explicitly_no' | 'neutral' | 'explicitly_yes'
export type AutoReviewCorrectness = '' | 'ok' | 'quoting_error' | 'unknown'
export type ReasonToken =
  | 'safe-git'
  | 'safe-read'
  | 'safe-test'
  | 'safe-npx'
  | 'safe-life'
  | 'safe-compute'
  | 'workspace-write'
  | 'read'
  | 'net-allow'
  | 'extra-root'
  | 'unmodeled'
  | 'env'
  | 'quote'
  | 'pipe'
  | 'powershell'
  | 'cd'
  | 'sudo'
  | 'destructive'
  | 'abs-path'
  | 'secrets'
  | 'block-instruction'
  | 'allow-instruction'
  | 'axes'
  | 'json'
  | 'llama-off'
  | 'net-unknown'
  | 'bad-url'

export interface AutoReviewReport {
  stage: AutoReviewStage
  verdict: AutoReviewVerdict
  reason: ReasonToken
  risk: AutoReviewRisk
  authorization: AutoReviewAuth
  correctness: AutoReviewCorrectness
}

export interface ReviewerAxes {
  risk: 'low' | 'high' | 'too_destructive'
  authorization: 'explicitly_no' | 'neutral' | 'explicitly_yes'
  correctness: 'ok' | 'quoting_error' | 'unknown'
}

export function reportOf(
  stage: string,
  verdict: string,
  reason: string,
  extra?: { risk?: string; authorization?: string; correctness?: string }
): AutoReviewReport
export function publicAutoReviewLine(report: unknown): string
export function lastAutoReviewLine(log: unknown): string
export function takeRelativePath(s: unknown): string | null
export function splitSafeAnd(command: unknown): string[] | null
export function judgeShell(command: unknown): { verdict: AutoReviewVerdict; reason: string; risk?: string }
export function instructionHit(detail: unknown, list: unknown): boolean
export function instructionAuthorization(detail: unknown, perms: unknown): 'explicitly_no' | 'neutral' | 'explicitly_yes'
export function parseReviewerAxes(text: unknown): ReviewerAxes | null
export function takeReviewerTranscript(raw: unknown): { user: string; other: string }
export function reviewerSystemPrompt(): string
export function reviewerUserPrompt(command: unknown, transcript: unknown): string
export function combineAxes(axes: unknown, baseReport: unknown): AutoReviewReport
export function runAutoReviewPipeline(opts: {
  perms?: unknown
  permission?: 'read' | 'write' | 'net' | 'exec'
  tool?: string
  detail?: string
  extraRoot?: boolean
  axes?: unknown
}): AutoReviewReport

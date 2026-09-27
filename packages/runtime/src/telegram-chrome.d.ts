export const RULE: string
export function plainLine(raw: unknown, max?: number): string
export function plainBlock(raw: unknown, max?: number): string
export function formatConsole(lines: unknown, meta?: { state?: string; kicker?: string }): string
export function phaseTrack(step: string): string
export function welcomeCard(profile?: { displayName?: string }): string
export function helpCard(info?: { approvalMode?: string }): string
export function needPairCard(group?: boolean): string
export function pairOkCard(): string
export function pairFailCard(): string
export function pairDmCard(): string
export function groupHelloCard(): string
export function menuCard(info?: { approvalMode?: string }): string
export function manageCard(info?: {
  online?: boolean
  mode?: string
  mind?: string
  llama?: string
  keys?: string
  cursor?: string
  peers?: number
  live?: string
  glass?: boolean
}): string
export function statusDashboard(info?: {
  live?: string
  doing?: string[]
  threadTitle?: string
  mode?: string
  provider?: string
  surface?: string
  busy?: boolean
  git?: string
  llama?: string
  keys?: string
  cursor?: string
}): string
export function trustLine(mode?: unknown): string
export function stageCard(info?: {
  phase?: string
  step?: string
  think?: string
  thinkStatus?: string
  thinkTitle?: string
  docs?: unknown
  waiting?: boolean
  hold?: boolean
  approval?: string
  llama?: string
  keys?: string
  error?: string
  items?: unknown
  chunks?: unknown
  lanes?: unknown
  tools?: unknown
  busy?: boolean
  runId?: string
  title?: string
  workflow?: unknown
  approvalMode?: string
  autoReviewLine?: string
}): string
export function catalogCard(title: string, body: string, state?: string): string
export function noticeCard(text: string, state?: string, kicker?: string): string
export function dockKind(text: unknown): string | null
export function dockKeyboard(): { keyboard: Array<Array<{ text: string }>>; resize_keyboard: boolean; is_persistent: boolean }
export function glassAppKeyboard(url: unknown): {
  keyboard: Array<Array<{ text: string; web_app?: { url: string } }>>
  resize_keyboard: boolean
  is_persistent: boolean
}
export function menuInlineKeyboard(): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }
export function manageInlineKeyboard(): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }
export function liveKeyboard(runId: string): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }
export function doneKeyboard(runId: string): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }
export function takeMode(raw: unknown): string | null
export function takeNav(raw: unknown): string | null
export function safeCallbackId(raw: unknown): string
export function stripParseMode(extra: unknown): Record<string, unknown>

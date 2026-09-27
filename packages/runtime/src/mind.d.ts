export const MINDS: readonly string[]
export function takeMind(raw: unknown): 'local' | 'openai' | 'openrouter' | 'cursor' | null
export function pickForgeProvider(opts?: {
  mind?: unknown
  mode?: unknown
  thinkPath?: boolean
  localOk?: boolean
  verifyOk?: boolean
  hasSidecar?: boolean
  keys?: { openai?: boolean; openrouter?: boolean; cursor?: boolean }
}): 'local' | 'openai' | 'openrouter' | 'cursor'
export function designMind(raw: unknown): 'local' | 'openai' | 'openrouter'
export function taskNeedsDesignTools(task: unknown, flag?: boolean): boolean
export function forgeForDesign(
  picked: unknown,
  keys?: { openai?: boolean; openrouter?: boolean; cursor?: boolean }
): 'local' | 'openai' | 'openrouter'
export function forgeFallbackNote(
  mind: unknown,
  keys?: { openai?: boolean; openrouter?: boolean; cursor?: boolean }
): string
export function forgeTurnCap(needsTools: unknown): 12 | 20
export function forgeActHint(mode: unknown, task: unknown, needsTools?: boolean): string
export function takeKernelHealth(raw: unknown): {
  llama: 'on' | 'off' | 'missing'
  openai: boolean
  openrouter: boolean
  cursor: boolean
  cursorJobs: Array<{ id: string; status: string; name: string; summary: string }>
}
export function healthPulse(raw: unknown): { llama: string; keys: string; cursor: string }
export function publicMindError(err: unknown): string

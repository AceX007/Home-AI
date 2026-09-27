import type { StreamChunk } from '@homeai/core'

export function rememberMiniRun(id: string, meta?: { title?: string; mode?: string; startedAt?: number }): unknown
export function pushMiniChunk(id: string, chunk: StreamChunk | unknown): void
export function miniPulse(id: string): {
  runId: string
  title: string
  mode: string
  card: string
  done: boolean
  hold: boolean
  ask: boolean
  prompt: string
  options: string[]
  error: string
  phase: string
  tool: string
  tools: Array<{ name: string; status: string }>
  phases: string
  workflow: unknown
  autoReviewLine: string
} | null
export function forgetMiniRun(id: string): void
export function lastMiniRunId(): string

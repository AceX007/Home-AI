export type DebugStatus = 'idle' | 'running' | 'paused' | 'exited'

export interface DebugLaunch {
  path: string
  args: string[]
}

export interface DebugBreakpoint {
  path: string
  line: number
  enabled: boolean
}

export interface DebugFrame {
  path: string
  line: number
  name: string
}

export interface DebugLocal {
  name: string
  type: string
  value: string
}

export interface DebugSnapshot {
  status: DebugStatus
  path: string | null
  port: number | null
  frames: DebugFrame[]
  locals: DebugLocal[]
  watches: DebugLocal[]
  console: string[]
  testFailure: { path: string; line: number } | null
}

export function takeDebugLaunch(raw: unknown): DebugLaunch | null
export function takeDebugBreakpoint(raw: unknown): DebugBreakpoint | null
export function takeDebugEval(raw: unknown): string | null
export function takeDebugContinue(raw: unknown): 'continue' | 'stepOver' | 'stepInto' | 'stepOut' | null
export function takeInspectWs(raw: unknown): string | null
export function takeTestFailure(content: unknown): { path: string; line: number } | null
export function publicDebugError(err: unknown): string

export class NodeDebugHost {
  constructor(workspace: string)
  readonly root: string
  on(event: 'paused' | 'resumed' | 'exit', fn: (snap: DebugSnapshot) => void): this
  off(event: 'paused' | 'resumed' | 'exit', fn: (snap: DebugSnapshot) => void): this
  start(raw: unknown): Promise<DebugSnapshot>
  breakpoint(raw: unknown): Promise<DebugSnapshot>
  stack(): Promise<DebugSnapshot>
  evaluate(raw: unknown): Promise<string>
  continue(raw?: unknown): Promise<DebugSnapshot>
  stop(): Promise<DebugSnapshot>
  snapshot(): DebugSnapshot
  perceiveLine(): string
  noteTestFailure(raw: unknown): { path: string; line: number } | null
}

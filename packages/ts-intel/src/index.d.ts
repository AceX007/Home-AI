export type TsSeverity = 'error' | 'warning' | 'info' | 'hint'

export interface TsPositionRequest {
  path: string
  text?: string
  line?: number
  column?: number
  newName?: string
  version?: number
}

export interface TsRange {
  path: string
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}

export interface TsDiagnostic extends TsRange {
  code: number
  severity: TsSeverity
  message: string
}

export interface TsSymbol extends TsRange {
  name: string
  kind: string
  container: string
}

export interface TsTextEdit extends TsRange {
  text: string
}

export interface TsCompletion {
  label: string
  kind: string
  sortText: string
  insertText: string
  source?: string
}

export interface TsHover {
  kind: string
  display: string
  documentation: string
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}

export interface TsRenameResult {
  edits: TsTextEdit[]
  pending: Array<{ path: string; before: string; after: string; origin: string }>
}

export function takeTsQuery(raw: unknown): string
export function takeTsRequest(raw: unknown): TsPositionRequest | null
export function takeTsCallMethod(raw: unknown): 'diagnostics' | 'symbols' | 'definitions' | 'references' | 'hover' | 'completions' | 'format' | null
export function publicTsError(err: unknown): string
export function applyTextEdits(text: string, edits: TsTextEdit[]): string
export function tsWorkspaceWorkerPath(): string | null

export class TsIntelligence {
  constructor(workspace: string, options?: { maxFiles?: number; maxFileBytes?: number })
  readonly root: string
  readonly generation: number
  update(path: string, text: string, version?: number): boolean
  close(path: string): void
  jail(path: string, mustExist?: boolean): string | null
  snapshotText(path: string): string | null
  setGeneration(seq: number): number
  cancelled(seq: number): boolean
  cancel(): number
  diagnostics(request: TsPositionRequest): TsDiagnostic[]
  symbols(request: TsPositionRequest): TsSymbol[]
  workspaceSymbols(query?: string, opts?: { seq?: number }): TsSymbol[]
  workspaceSymbolsIsolated(query?: string): Promise<TsSymbol[]>
  callIsolated(method: string, request: TsPositionRequest): Promise<unknown>
  definitions(request: TsPositionRequest): TsRange[]
  references(request: TsPositionRequest): TsRange[]
  hover(request: TsPositionRequest): TsHover | null
  completions(request: TsPositionRequest): TsCompletion[]
  format(request: TsPositionRequest): TsTextEdit[]
  rename(request: TsPositionRequest & { newName: string }): TsTextEdit[]
  dispose(): void
}

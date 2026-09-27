export function takeComputeRuntime(raw: unknown): 'python' | 'node'
export function takeComputeCode(raw: unknown): string | null
export function computeScriptRel(id: string, runtime: string): string
export function computePlotRel(id: string): string
export function computeHookRel(id: string): string
export function computeShimRel(id: string): string
export function computePromisesShimRel(id: string): string
export function assertPlotInside(root: string, rel: string): string
export function runCompute(
  root: string,
  args: { runtime?: string; code?: string; timeoutMs?: number }
): Promise<string>

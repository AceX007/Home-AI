import type { ToolCall, ToolDef, ToolResult } from '@homeai/core'

export const SUBAGENT_KINDS: string[]
export const SUBAGENT_TOOLS: Record<string, string[]>
export function normalizeSubagentKind(raw: unknown): string | null
export function toolsForSubagent(kind: string, builtins: ToolDef[]): ToolDef[]
export function nestedExploreForgeFlags(): { skipVerify: true; skipRemember: true; maxTurns: 2 }
export function digestSubagent(kind: string, results: ToolResult[]): string
export function parseTaskCall(
  args: unknown,
  opts?: { think?: boolean }
): Array<{ name: string; kind: string; query: string; path: string }>
export function runSubagentJobs(
  jobs: Array<{ name: string; kind: string; query: string; path: string }>,
  runChildTool: (call: ToolCall) => Promise<ToolResult>,
  opts?: {
    nestedForge?: (job: {
      name: string
      kind: string
      query: string
      path: string
    }) => Promise<ToolResult | ToolResult[]>
    think?: boolean
  }
): Promise<string>

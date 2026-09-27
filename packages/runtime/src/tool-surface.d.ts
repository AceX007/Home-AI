import type { AgentMode, ToolDef } from '@homeai/core'
import type { McpServerInfo } from './mcp'

export const WRITE_TOOLS: Set<string>
export const ASK_BLOCK: Set<string>
export const THINK_TOOLS: Set<string>
export const PLAN_BLOCK: Set<string>
export const DESIGN_LOOP: Set<string>
export const VERIFY_TOOLS: Set<string>
export function toolsForDesign(builtins: ToolDef[]): ToolDef[]
export function designToolChoice(tools: unknown): 'auto' | 'required'
export function toolsForMode(
  mode: AgentMode | string,
  builtins: ToolDef[],
  mcpTools: ToolDef[],
  opts?: {
    packs?: string[]
    task?: string
    skills?: Array<{ name?: string; description?: string }>
    lifeBins?: { ocr?: boolean; stt?: boolean; tts?: boolean }
  }
): ToolDef[]
export function mcpPublicRows(listed: unknown): Array<{ id: string; ok: boolean; tools: string[]; transport?: string }>
export function formatToolSurface(
  mode: string,
  builtins: ToolDef[],
  mcpTools: ToolDef[],
  listed: unknown,
  opts?: {
    packs?: string[]
    task?: string
    skills?: Array<{ name?: string; description?: string }>
    lifeBins?: { ocr?: boolean; stt?: boolean; tts?: boolean }
  }
): string
export function isFullToolMode(mode: string): boolean
export function verifyToolDefs(tools: ToolDef[]): ToolDef[]
export function takeVerifyCalls<T extends { name?: string }>(calls: T[] | unknown): T[]
export function takeVerifyPatch(extra: unknown, workspaceRoot: unknown): string
export function verifyUserPrompt(toolTrace: unknown, patches?: unknown, diff?: unknown, extras?: unknown): string

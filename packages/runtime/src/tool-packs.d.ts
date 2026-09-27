export const TOOL_PACKS: string[]
export function packFromName(name: string): string
export function packOf(tool: { name?: string; pack?: string } | null | undefined): string
export function takePackName(raw: unknown): string | null
export function detectToolPacks(
  task: string,
  skills?: Array<{ name?: string; description?: string }>
): string[]
export function shrinkToolDef<T>(def: T, fullSchema: boolean): T
export function filterToolsByPack<T>(tools: T[] | unknown, packs: string[] | unknown): T[]
export function keepFullSchema(
  tool: { name?: string; pack?: string } | null | undefined,
  packs: string[] | unknown,
  mode?: string
): boolean
export const CORE_FULL_TOOLS: Set<string>
export const THINK_FULL_TOOLS: Set<string>

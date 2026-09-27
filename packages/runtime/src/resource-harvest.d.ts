export const HARVEST_KINDS: readonly string[]
export const COMPILER_OS_PORTS: readonly string[]
export const RESOURCE_HARVEST: ReadonlyArray<{ id: string; dir: string; kind: string }>
export function harvestDirKey(name: string): string
export function harvestKindForDir(name: string): string | null
export function harvestRow(id: string): { id: string; dir: string; kind: string } | null
export function starterForbidden(): readonly string[]

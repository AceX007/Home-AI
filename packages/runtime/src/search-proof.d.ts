export function ragWriteRel(folder: unknown, name: unknown): string | null
export function skipSkillFile(file: unknown): boolean
export function parseRuleAlwaysApply(md: unknown): boolean
export function takeGrepQuery(raw: unknown): string | null
export function compileGrepRe(raw: unknown): RegExp | null
export function publicGrepHits(rows: unknown): Array<{ path: string; line: number; text: string }>
export function takeHitRel(path: unknown, root?: unknown): string | null
export type LibraryMeters = {
  phase: string
  features: number
  testsDone: number
  testsRequired: number
  edgesTested: number
  edgesTracked: number
  updated: string
}
export function countTableStatus(md: unknown, want: unknown): number
export const EMPTY_METERS: LibraryMeters
export function parseLibraryStatus(md: unknown): LibraryMeters

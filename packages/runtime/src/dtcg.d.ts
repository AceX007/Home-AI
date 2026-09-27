export function designTokenRel(rel?: string): string
export function applyDtcgToIr(
  doc: unknown,
  dtcg: unknown,
  sourcePath?: string
): { doc: Record<string, unknown>; applied: string[]; skipped: string[] }

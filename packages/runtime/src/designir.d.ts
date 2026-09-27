export function defaultDesignIR(): Record<string, unknown>
export function validateDesignIR(doc: unknown): { ok: boolean; errors: string[] }
export function densityPatch(scale: number): { intentId: string; scope: string[]; patch: Array<{ op: string; path: string; value: unknown }> }
export function coerceDesignOps(list: unknown): Array<{ op: string; path: string; value?: unknown }>
export function publicDesignEnvelope(raw: unknown): Record<string, unknown>
export function applyDesignPatch(
  doc: unknown,
  envelope: unknown
): { doc: Record<string, unknown>; diagnostics: { ok: boolean; errors: string[] } }

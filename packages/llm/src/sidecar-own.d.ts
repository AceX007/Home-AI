export function shouldAttachExistingListener(opts: { sidecar?: boolean; portOpen?: boolean }): boolean
export function ownedLlamaPort(status: { running?: boolean; port?: number } | null | undefined): number | null
export function pickInfillPort(
  coder?: { running?: boolean; port?: number } | null,
  orchestrator?: { running?: boolean; port?: number } | null,
  fallback?: number
): number

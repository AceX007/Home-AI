export type ApprovalModeName = 'allowlist' | 'manual' | 'unrestricted' | 'auto-review'
export function clampApprovalMode(raw: unknown): ApprovalModeName
export function takeApprovalSave(mode: unknown, confirm: unknown): ApprovalModeName
export function sanitizeTerminalPrefix(s: string): string | null
export function sanitizeNetPrefix(s: string): string | null
export function sanitizeMcpRule(s: string): string | null
export function sanitizeExtraRoot(s: string): string | null
export function extraRootWriteDecision(): 'ask'
export function extraRootWriteAsks(permission: string, extraRoot: unknown): boolean
export function mcpApprovalDecision(mode: unknown, allowed: unknown): 'allow' | 'ask'
export function applyLoadedPatch(merged: object, taken: object): object
export function pinWorkspaceInstructions(merged: object, taken: object): object
export function takePermissionsPatch(file: unknown): {
  approvalMode?: ApprovalModeName
  terminalAllowlist?: string[]
  mcpAllowlist?: string[]
  netAllowlist?: string[]
  fsExtraRoots?: string[]
  autoRun?: { allow_instructions?: string[]; block_instructions?: string[] } | null
  autoReview?: { allow_instructions?: string[]; block_instructions?: string[] } | null
}
export function parseHttpUrl(raw: string): URL | null
export function urlAllowed(url: string, allow: unknown): boolean
export function mapAllowlist(xs: unknown, fn: (s: string) => string | null): string[]
export function instructionList(xs: unknown): string[] | undefined
export function takeInstructionPair(raw: unknown): {
  allow_instructions?: string[]
  block_instructions?: string[]
} | undefined
export const WEB_SEARCH_ENDPOINT: string
export function toolApprovalDetail(
  call: { name?: string; arguments?: Record<string, unknown> } | null | undefined,
  pageUrl?: string
): string

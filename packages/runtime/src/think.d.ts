export function thinkSlug(name: string): string
export function thinkRel(name: string): string
export function redactCloudText(s: string): string
export function parseThinkFront(md: string): { status: string; title: string; files: string[] }
export function validateThinkMarkdown(md: string): {
  ok: boolean
  errors: string[]
  status: string
  title: string
  files: string[]
}
export const THINK_HEADINGS: string[]
export function thinkRelFromOpen(path: string): string
export function shouldCloseThink(hadError: unknown): boolean
export function chunkIsForgeError(chunk: unknown): boolean
export function bumpThinkStatus(
  md: string,
  to: 'implementing' | 'done'
): { markdown: string; status: string; changed: boolean }

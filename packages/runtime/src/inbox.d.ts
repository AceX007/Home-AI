export function inboxName(raw: unknown): string | null
export function takeInboxBytes(raw: unknown): Buffer | null
export function inboxMatches(buf: Buffer, ext: string): boolean
export function takeInboxFile(name: unknown, base64: unknown): { name: string; bytes: Buffer } | null
export function saveInboxSafe(
  root: string,
  name: unknown,
  base64: unknown
): { rel: string; name: string; bytes: number } | null

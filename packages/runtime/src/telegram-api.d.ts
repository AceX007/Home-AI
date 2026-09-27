export function telegramTokenOk(raw: unknown): boolean
export function telegramCallUrl(token: string, method: string): string
export function telegramCall(
  token: string,
  method: string,
  body?: Record<string, unknown>,
  fetchImpl?: typeof fetch
): Promise<unknown>
export function nextBackoff(ms: number, retryAfterMs?: number): number
export function telegramFileId(raw: unknown): string | null
export function telegramFilePath(raw: unknown): string | null
export function telegramFileUrl(token: string, path: unknown): string
export function telegramDownloadFile(
  token: string,
  path: unknown,
  fetchImpl?: typeof fetch
): Promise<Buffer>

export const DEFAULT_MINIAPP_PORT: number
export function miniAppPort(raw?: unknown): number
export function loopbackMiniAppUrl(port?: unknown): string
export function resolveMiniAppUrl(raw: unknown, port?: unknown): string
export function miniMenuButton(
  url: unknown,
  text?: string
): { type: 'default' } | { type: 'web_app'; text: string; web_app: { url: string } }
export function takeMiniAppUrl(raw: unknown): string | null
export function validateTelegramInitData(
  token: string,
  raw: string,
  now?: number
): { userId: number } | null
export function takeMiniBody(raw: unknown): {
  action: string
  task?: string
  mode?: string
  runId?: string
  ok?: boolean
  text?: string
  title?: string
  path?: string
  threadId?: string
  name?: string
  data?: string
  pick?: number
  provider?: 'local' | 'openai' | 'openrouter' | 'cursor'
  url?: string
  id?: string
  rel?: string
  kind?: string
  fromId?: string
  recipe?: string
} | null

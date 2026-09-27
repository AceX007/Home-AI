export interface TelegramRoute {
  kind: string
  action?: string
  from?: number
  chatId?: number
  ack?: string
  callbackId?: string
  id?: string
  extra?: string
  code?: string | null
  threadId?: string
  text?: string
  mode?: string
  task?: string
  title?: string
  name?: string
  body?: string
  slug?: string
  topicId?: number
  surface?: 'private' | 'group'
  chatTitle?: string
  mind?: 'local' | 'openai' | 'openrouter' | 'cursor'
  fileId?: string
  name?: string
  caption?: string
  rel?: string
  fromId?: string
}

export function parseCallback(data: unknown): { kind: string; id: string; extra?: string } | null
export function botUsernameOf(ctx?: unknown): string
export function takeBotIdentity(raw: unknown): { id: number; username: string } | null
export function groupAddressed(update: unknown, ctx?: unknown): boolean
export function takeTelegramInbox(msg: unknown): { fileId: string; name: string; size: number } | null
export function routeTelegram(
  update: unknown,
  ctx?: {
    state?: unknown
    pending?: { kind: string; name: string } | null
    bot?: { id?: number; username?: string } | null
  }
): TelegramRoute

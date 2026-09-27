export interface TelegramPeer {
  id: number
  pairedAt: number
}

export interface TelegramPairing {
  hash: string
  exp: number
}

export interface TelegramState {
  peers: TelegramPeer[]
  pairing: TelegramPairing | null
  offset: number
  seen: number[]
}

export function telegramUserId(raw: unknown): number | null
export function normalizePairCode(raw: unknown): string | null
export function hashPairCode(code: string): string
export function defaultTelegramState(): TelegramState
export function takeTelegramState(raw: unknown): TelegramState
export function isPeer(state: unknown, userId: unknown): boolean
export function startPairing(state: unknown, now?: number): { state: TelegramState; code: string; exp: number }
export function consumePair(
  state: unknown,
  code: unknown,
  userId: unknown,
  now?: number
): { ok: boolean; reason?: string; state: TelegramState }
export function unpair(state: unknown, userId: unknown): TelegramState
export function rememberUpdate(state: unknown, updateId: unknown): { state: TelegramState; fresh: boolean }
export function loadTelegramState(root: string): TelegramState
export function saveTelegramState(root: string, state: unknown): void
export function telegramStatusView(
  state: unknown,
  configured: boolean,
  online: boolean,
  now?: number
): { configured: boolean; online: boolean; peers: number[]; pairing: { exp: number } | null }

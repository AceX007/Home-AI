import type { ConversationSummary, ConversationThread, ConversationTurn, ThreadSource } from '@homeai/core'

export const HOME_THREAD_ID: 'chat_home'
export function chatThreadId(raw: unknown): string | null
export function jobRunId(raw: unknown): string | null
export function telegramChatId(raw: unknown): number | null
export function isTelegramGroupChat(raw: unknown): boolean
export function newThreadId(): string
export function getThread(root: string, id: string): ConversationThread | null
export function ensureHomeThread(root: string): ConversationThread
export function listThreads(root: string): ConversationSummary[]
export function createThread(root: string, title?: string, source?: ThreadSource): ConversationThread
export function renameThread(root: string, id: string, title: string): ConversationThread
export function appendTurn(root: string, id: string, turn: Partial<ConversationTurn> & { role: ConversationTurn['role']; text: string }): ConversationThread
export function bindTelegram(root: string, id: string, chatId: number): ConversationThread
export function threadForTelegram(
  root: string,
  chatId: number,
  opts?: { title?: string; group?: boolean }
): ConversationThread | null
export function loadActiveThreadId(root: string): string
export function saveActiveThreadId(root: string, id: string): string
export function formatChatLog(thread: ConversationThread | null | undefined, n?: number): string
export function turnsToLogItems(thread: ConversationThread | null | undefined): Array<{ id: string; kind: string; text: string }>
export function ragExcerpt(thread: ConversationThread | null | undefined): string

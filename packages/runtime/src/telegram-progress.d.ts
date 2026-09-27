import type { StreamChunk } from '@homeai/core'

export function progressCard(
  chunks: StreamChunk[] | unknown,
  meta?: { title?: string; startedAt?: number; now?: number; mode?: string; provider?: string }
): string
export function chatAckKeyboard(draftId: string): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }
export function approvalKeyboard(runId: string): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }
export function questionKeyboard(
  runId: string,
  options?: string[]
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }
export function jobMarkup(
  id: string,
  chunks: StreamChunk[] | unknown
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }

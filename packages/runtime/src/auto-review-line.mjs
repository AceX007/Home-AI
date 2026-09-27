import { stripActivityText } from './activity.mjs'

export function lastAutoReviewLine(log) {
  const list = Array.isArray(log) ? log : []
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i]
    if (!it || typeof it !== 'object') continue
    const kind = it.kind || it.type
    if (kind !== 'status') continue
    const text = String(it.text || '')
    if (text.startsWith('auto-review ·')) return stripActivityText(text, 80)
  }
  return ''
}

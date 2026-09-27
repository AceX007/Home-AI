const MAX = 8_000

export function looksLikeHtml(raw, contentType) {
  const ct = String(contentType || '')
  if (/\bhtml\b/i.test(ct)) return true
  const s = String(raw || '')
    .replace(/^\uFEFF/, '')
    .trimStart()
    .slice(0, 256)
  return /^<!doctype html/i.test(s) || /^<html[\s>]/i.test(s)
}

export function extractHtml(html, url) {
  const raw = String(html ?? '')
  const titleM = raw.match(/<title[^>]*>([^<]{1,200})/i)
  const title = titleM ? titleM[1].replace(/\s+/g, ' ').trim().slice(0, 120) : ''
  let stripped = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const href = String(url || '').slice(0, 300)
  return `${title ? `title ${title}\n` : ''}${href ? `url ${href}\n` : ''}${stripped}`.slice(0, MAX)
}

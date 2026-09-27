import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertInside } from './paths.mjs'

const MAX = 2_000_000
const EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'txt', 'md', 'pdf', 'ogg', 'wav', 'mp3', 'webm', 'm4a'])

function extOf(name) {
  const m = String(name || '')
    .toLowerCase()
    .match(/\.([a-z0-9]{1,8})$/)
  return m ? m[1] : ''
}

export function inboxName(raw) {
  const rawS = String(raw || '')
  if (!rawS || rawS.includes('..') || rawS.includes('/') || rawS.includes('\\') || rawS.includes('\0')) return null
  const s = rawS.replace(/[^\w.-]/g, '_').replace(/^\.+/, '').slice(0, 64)
  const ext = extOf(s)
  if (!s || s.includes('..') || !EXT.has(ext)) return null
  return s
}

export function takeInboxBytes(raw) {
  const s = String(raw || '').replace(/\s+/g, '')
  if (s.length < 8 || s.length > 2_800_000) return null
  if (!/^[A-Za-z0-9+/=]+$/.test(s)) return null
  let buf
  try {
    buf = Buffer.from(s, 'base64')
  } catch {
    return null
  }
  if (!buf.length || buf.length > MAX) return null
  return buf
}

function looksText(buf) {
  if (buf.includes(0)) return false
  const head = buf.subarray(0, 256).toString('utf8')
  if (/<\s*(script|svg|html|iframe|!doctype|php)/i.test(head)) return false
  if (head.startsWith('<?')) return false
  return true
}

export function inboxMatches(buf, ext) {
  if (!buf || !buf.length || buf.length > MAX) return false
  const e = String(ext || '').toLowerCase()
  if (e === 'jpg' || e === 'jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
  if (e === 'png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  if (e === 'gif') return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38
  if (e === 'webp') {
    return buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP'
  }
  if (e === 'pdf') return buf.subarray(0, 4).toString('ascii') === '%PDF'
  if (e === 'ogg') return buf.length >= 4 && buf.subarray(0, 4).toString('ascii') === 'OggS'
  if (e === 'wav') {
    return buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WAVE'
  }
  if (e === 'mp3') {
    if (buf.length >= 3 && buf.subarray(0, 3).toString('ascii') === 'ID3') return true
    return buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0
  }
  if (e === 'webm') return buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3
  if (e === 'm4a') return buf.length >= 8 && buf.subarray(4, 8).toString('ascii') === 'ftyp'
  if (e === 'txt' || e === 'md') return looksText(buf)
  return false
}

export function takeInboxFile(name, base64) {
  const safe = inboxName(name)
  const bytes = takeInboxBytes(base64)
  if (!safe || !bytes) return null
  if (!inboxMatches(bytes, extOf(safe))) return null
  return { name: safe, bytes }
}

export function saveInboxSafe(root, name, base64) {
  const file = takeInboxFile(name, base64)
  if (!file) return null
  const rel = `data/inbox/${Date.now()}-${file.name}`
  if (rel.includes('..')) return null
  const abs = assertInside(root, rel)
  mkdirSync(join(root, 'data', 'inbox'), { recursive: true })
  writeFileSync(abs, file.bytes)
  return { rel, name: file.name, bytes: file.bytes.length }
}

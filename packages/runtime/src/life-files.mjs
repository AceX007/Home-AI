import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { assertInside } from './paths.mjs'

const NOTE_NAME = /^[\w][\w.-]{0,62}$/
const CAL_NAME = /^[\w][\w.-]{0,62}$/

export function notesRel(name) {
  const raw = String(name || '')
  if (raw.includes('..') || raw.includes('\0') || /[\n\r]/.test(raw)) return null
  let s = raw.replace(/\\/g, '/').split('/').pop() || ''
  s = s.replace(/\.md$/i, '')
  if (!NOTE_NAME.test(s)) return null
  return `notes/${s}.md`
}

export function calendarRel(name) {
  const raw = String(name || '')
  if (raw.includes('..') || raw.includes('\0') || /[\n\r]/.test(raw)) return null
  let s = raw.replace(/\\/g, '/').split('/').pop() || ''
  s = s.replace(/\.ics$/i, '')
  if (!CAL_NAME.test(s)) return null
  return `data/calendar/${s}.ics`
}

export function inboxOnly(root, path) {
  const abs = assertInside(root, path)
  const rel = relative(root, abs).replace(/\\/g, '/')
  if (!rel.startsWith('data/inbox/') || rel.includes('..')) throw new Error('inbox only')
  return abs
}

export function listNotes(root) {
  const dir = assertInside(root, 'notes')
  if (!existsSync(dir)) return []
  const out = []
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue
    const rel = notesRel(name)
    if (!rel) continue
    const abs = assertInside(root, rel)
    let st
    try {
      st = statSync(abs)
    } catch {
      continue
    }
    const text = readFileSync(abs, 'utf8')
    out.push({
      path: rel,
      title: name.replace(/\.md$/, ''),
      preview: text.slice(0, 160).replace(/\n/g, ' ').replace(/[<>]/g, ''),
      mtime: st.mtimeMs
    })
    if (out.length >= 64) break
  }
  return out.sort((a, b) => b.mtime - a.mtime)
}

export function writeNoteFile(root, name, content) {
  const rel = notesRel(name)
  if (!rel) throw new Error('bad note name')
  const abs = assertInside(root, rel)
  mkdirSync(join(root, 'notes'), { recursive: true })
  writeFileSync(abs, String(content ?? '').slice(0, 100_000), 'utf8')
  return rel
}

export function listCalendar(root) {
  const dir = assertInside(root, 'data/calendar')
  if (!existsSync(dir)) return []
  const out = []
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.ics')) continue
    const rel = calendarRel(name)
    if (!rel) continue
    const abs = assertInside(root, rel)
    out.push({ path: rel, bytes: statSync(abs).size })
    if (out.length >= 64) break
  }
  return out
}

export function takeVevent(args) {
  const a = args && typeof args === 'object' ? args : {}
  const summary = String(a.summary ?? a.title ?? 'event')
    .replace(/[<>]/g, '')
    .replace(/[\n\r,;]/g, ' ')
    .slice(0, 120)
  const dt = String(a.dtstart ?? a.start ?? '')
    .replace(/[^\dTZ]/g, '')
    .slice(0, 16)
  const dtend = String(a.dtend ?? a.end ?? '')
    .replace(/[^\dTZ]/g, '')
    .slice(0, 16)
  const uid = String(a.uid ?? `homeai-${Date.now()}`).replace(/[^\w.@-]/g, '').slice(0, 80)
  if (!summary) return null
  return { summary, dtstart: dt || '19700101T000000Z', dtend: dtend || '', uid }
}

export function upsertCalendar(root, name, args) {
  const rel = calendarRel(name)
  if (!rel) throw new Error('bad calendar name')
  const ev = takeVevent(args)
  if (!ev) throw new Error('bad event')
  const abs = assertInside(root, rel)
  mkdirSync(join(root, 'data', 'calendar'), { recursive: true })
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hex AI//EN',
    'BEGIN:VEVENT',
    `UID:${ev.uid}`,
    `DTSTAMP:${ev.dtstart}`,
    `DTSTART:${ev.dtstart}`,
    ev.dtend ? `DTEND:${ev.dtend}` : '',
    `SUMMARY:${ev.summary}`,
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ]
    .filter(Boolean)
    .join('\r\n')
  writeFileSync(abs, ics, 'utf8')
  return rel
}

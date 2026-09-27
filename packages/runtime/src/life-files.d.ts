export function notesRel(name: unknown): string | null
export function calendarRel(name: unknown): string | null
export function inboxOnly(root: string, path: string): string
export function listNotes(root: string): Array<{ path: string; title: string; preview: string; mtime: number }>
export function writeNoteFile(root: string, name: unknown, content: unknown): string
export function listCalendar(root: string): Array<{ path: string; bytes: number }>
export function takeVevent(args: unknown): { summary: string; dtstart: string; dtend: string; uid: string } | null
export function upsertCalendar(root: string, name: unknown, args: unknown): string

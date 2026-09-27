import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/** gitignore-style matcher. Small enough for a 2B's tools. */
export class IgnoreSet {
  private rules: Array<{ neg: boolean; re: RegExp; dirOnly: boolean }> = []

  addLine(line: string): void {
    let s = line.trim()
    if (!s || s.startsWith('#')) return
    const neg = s.startsWith('!')
    if (neg) s = s.slice(1)
    const dirOnly = s.endsWith('/')
    if (dirOnly) s = s.slice(0, -1)
    const anchored = s.startsWith('/')
    if (anchored) s = s.slice(1)
    const re = globLineToRegExp(s, anchored)
    this.rules.push({ neg, re, dirOnly })
  }

  addText(text: string): void {
    for (const line of text.split(/\r?\n/)) this.addLine(line)
  }

  ignored(relPosix: string, isDir: boolean): boolean {
    const path = relPosix.replace(/\\/g, '/').replace(/^\.\//, '')
    let hit = false
    for (const r of this.rules) {
      if (r.dirOnly && !isDir) continue
      if (r.re.test(path) || r.re.test(path.split('/').pop() ?? path)) {
        hit = !r.neg
      }
    }
    return hit
  }

  ignoredPath(root: string, abs: string): boolean {
    const rel = relative(root, abs).replace(/\\/g, '/')
    if (rel.startsWith('..')) return true
    let isDir = false
    try {
      isDir = statSync(abs).isDirectory()
    } catch {
      isDir = !rel.includes('.')
    }
    if (this.ignored(rel, isDir)) return true
    const parts = rel.split('/')
    let acc = ''
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i]
      if (this.ignored(acc, true)) return true
    }
    return false
  }
}

function globLineToRegExp(pat: string, anchored: boolean): RegExp {
  const escaped = pat
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DS::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DS::/g, '.*')
    .replace(/\?/g, '[^/]')
  const body = anchored ? `^${escaped}(?:/.*)?$` : `(^|/)${escaped}(?:/.*)?$`
  return new RegExp(body)
}

const HARD_SKIP = [
  'node_modules',
  '.git',
  'out',
  'dist',
  'vendor',
  'data',
  '.homeai',
  'cursor_3.17.21_amd64'
]

export function loadIgnore(workspace: string): IgnoreSet {
  const set = new IgnoreSet()
  for (const name of HARD_SKIP) set.addLine(name)
  set.addLine('*.gguf')
  set.addLine('*.deb')
  set.addLine('.env')
  set.addLine('.env.*')
  const files = [
    join(workspace, '.gitignore'),
    join(workspace, '.cursorignore'),
    join(workspace, '.cursorindexingignore'),
    join(workspace, '.homeaiignore')
  ]
  for (const f of files) {
    if (!existsSync(f)) continue
    try {
      set.addText(readFileSync(f, 'utf8'))
    } catch {
      /* skip */
    }
  }
  return set
}

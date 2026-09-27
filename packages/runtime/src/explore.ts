import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { IgnoreSet } from './ignore'
import { parseStructuralIndex } from './compiler-os.mjs'

const SKIP = new Set(['node_modules', '.git', 'out', 'dist', 'vendor', 'data', 'cursor_3.17.21_amd64'])

/**
 * Explore without a nested LLM. Grep + glob, then a tight digest.
 * This is how a 2B stays useful: the parent never sees 20k of hits.
 */
export function explore(
  root: string,
  query: string,
  ignore?: IgnoreSet
): { files: string[]; hits: string[]; summary: string } {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .filter((w) => w.length > 2)
    .slice(0, 8)
  const patterns = words.length ? words : [query]
  const hits: string[] = []
  const files = new Set<string>()
  walk(root, root, ignore, (rel, abs) => {
    if (hits.length >= 48) return false
    let st
    try {
      st = statSync(abs)
    } catch {
      return true
    }
    if (!st.isFile() || st.size > 400_000) return true
    const name = rel.toLowerCase()
    if (patterns.some((w) => name.includes(w))) files.add(rel)
    try {
      const text = readFileSync(abs, 'utf8')
      const lines = text.split('\n')
      lines.forEach((line, i) => {
        if (hits.length >= 48) return
        const l = line.toLowerCase()
        if (patterns.some((w) => l.includes(w))) {
          hits.push(`${rel}:${i + 1}:${line.trim().slice(0, 160)}`)
          files.add(rel)
        }
      })
    } catch {
      /* binary */
    }
    return hits.length < 48
  })
  const fileList = [...files].slice(0, 24)
  for (const rel of fileList.slice(0, 8)) {
    if (!rel || rel.includes('..')) continue
    try {
      const abs = join(root, rel)
      const text = readFileSync(abs, 'utf8').slice(0, 80_000)
      const idx = parseStructuralIndex(text, rel)
      const refs = idx.symbols.filter((s) =>
        patterns.some((w) => s.toLowerCase().includes(String(w).toLowerCase()))
      )
      if (refs.length) hits.push(`refs ${rel}: ${refs.slice(0, 8).join(', ')}`)
    } catch {
      /* skip */
    }
    if (hits.length >= 48) break
  }
  const summary = [
    `explore ${JSON.stringify(query)}`,
    `files ${fileList.length}: ${fileList.join(', ')}`,
    hits.slice(0, 30).join('\n') || '(no line hits)'
  ].join('\n')
  return { files: fileList, hits: hits.slice(0, 40), summary: summary.slice(0, 6000) }
}

function walk(
  root: string,
  dir: string,
  ignore: IgnoreSet | undefined,
  visit: (rel: string, abs: string) => boolean
): void {
  let names: string[] = []
  try {
    names = readdirSync(dir)
  } catch {
    return
  }
  for (const name of names) {
    if (SKIP.has(name) || name.startsWith('.')) continue
    const abs = join(dir, name)
    const rel = relative(root, abs).replace(/\\/g, '/')
    if (ignore?.ignoredPath(root, abs)) continue
    let st
    try {
      st = statSync(abs)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(root, abs, ignore, visit)
    else if (!visit(rel, abs)) return
  }
}

export function folderTree(root: string, dir: string, depth = 2): string {
  const lines: string[] = []
  const go = (d: string, n: number, prefix: string) => {
    if (n > depth) return
    let names: string[] = []
    try {
      names = readdirSync(d).filter((x) => !SKIP.has(x) && !x.startsWith('.'))
    } catch {
      return
    }
    for (const name of names.slice(0, 40)) {
      const p = join(d, name)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      lines.push(`${prefix}${st.isDirectory() ? name + '/' : name}`)
      if (st.isDirectory()) go(p, n + 1, prefix + '  ')
    }
  }
  go(existsSync(dir) ? dir : root, 0, '')
  return lines.slice(0, 80).join('\n')
}

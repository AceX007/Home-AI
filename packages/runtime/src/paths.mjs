import { existsSync, realpathSync } from 'node:fs'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'

const GENERIC_ESCAPE = 'path escapes workspace'

function insideRoot(rootResolved, target) {
  if (typeof target !== 'string' || !target.trim()) {
    throw new Error('path escapes workspace: (empty)')
  }
  if (target.includes('\0') || /[\n\r]/.test(target)) {
    throw new Error('path escapes workspace: (control)')
  }
  const resolved = resolve(isAbsolute(target) ? target : join(rootResolved, target))
  const rootReal = existsSync(rootResolved) ? realpathSync(rootResolved) : rootResolved
  const check = existsSync(resolved) ? realpathSync(resolved) : resolved
  const rel = relative(rootReal, check)
  if (rel.startsWith('..') || rel.includes(`..${sep}`)) {
    throw new Error(`path escapes workspace: ${target}`)
  }
  return resolved
}

/** Extra-root selector: folder basename only. Never a path. Empty = workspace. */
export function takeFsRootId(raw) {
  if (raw == null || raw === '') return ''
  if (typeof raw !== 'string') throw new Error(GENERIC_ESCAPE)
  const t = raw.trim()
  if (!t || t === 'workspace' || t === '.') return ''
  if (t.length > 64 || t.includes('\0') || /[\\/\n\r]/.test(t) || t.includes('..')) {
    throw new Error(GENERIC_ESCAPE)
  }
  if (t === '*' || t === '__proto__' || t === 'constructor' || t === 'prototype') {
    throw new Error(GENERIC_ESCAPE)
  }
  if (!/^[\w.-]{1,64}$/.test(t)) throw new Error(GENERIC_ESCAPE)
  return t
}

/** Map a root id onto exactly one listed extra root, or null for workspace. */
export function extraRootById(extraRoots, rootId) {
  const want = takeFsRootId(rootId)
  if (!want) return null
  const extras = Array.isArray(extraRoots) ? extraRoots : []
  const hits = extras.filter((e) => typeof e === 'string' && e && basename(resolve(e)) === want)
  if (hits.length !== 1) throw new Error(GENERIC_ESCAPE)
  return resolve(hits[0])
}

function jailUnderExtras(target, extraRoots) {
  const extras = Array.isArray(extraRoots) ? extraRoots : []
  if (!extras.length || !isAbsolute(String(target || ''))) return null
  for (const extra of extras) {
    try {
      return insideRoot(resolve(extra), target)
    } catch {
      /* next extra root */
    }
  }
  return null
}

/** Resolve `target` under workspace, or under an extra root (absolute or `root` id). */
export function jailPath(root, target, extraRoots, rootId) {
  const selected = extraRootById(extraRoots, rootId)
  if (selected) {
    try {
      return { path: insideRoot(selected, target), extra: true }
    } catch {
      throw new Error(GENERIC_ESCAPE)
    }
  }
  const rootResolved = resolve(root)
  try {
    return { path: insideRoot(rootResolved, target), extra: false }
  } catch (err) {
    const hit = jailUnderExtras(target, extraRoots)
    if (hit) return { path: hit, extra: true }
    throw err
  }
}

/** Resolve `target` under `root`. Rejects `..`, extra-root absolutes (unless listed), and symlink escapes. */
export function assertInside(root, target, extraRoots, rootId) {
  return jailPath(root, target, extraRoots, rootId).path
}

export function pathIsExtraRoot(root, resolved, extraRoots) {
  const check = resolve(resolved)
  try {
    insideRoot(resolve(root), check)
    return false
  } catch {
    const extras = Array.isArray(extraRoots) ? extraRoots : []
    return extras.some((extra) => {
      try {
        insideRoot(resolve(extra), check)
        return true
      } catch {
        return false
      }
    })
  }
}

/** Git pathspecs under `root`, relative POSIX, never the workspace root itself. */
export function gitPathspecs(root, paths) {
  if (!Array.isArray(paths)) throw new Error('paths must be an array')
  const rootResolved = resolve(root)
  const out = []
  for (const raw of paths) {
    if (typeof raw !== 'string') continue
    const t = raw.trim()
    if (!t) continue
    const abs = assertInside(rootResolved, t)
    const rel = relative(rootResolved, abs).replace(/\\/g, '/')
    if (!rel || rel === '.' || rel.startsWith('..')) {
      throw new Error('refuse workspace root as git pathspec')
    }
    out.push(rel)
  }
  if (!out.length) throw new Error('no paths inside workspace')
  return [...new Set(out)]
}

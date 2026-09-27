export function gitPullArgv(extra) {
  if (extra !== undefined && extra !== null) throw new Error('pull takes no extra args')
  return ['pull', '--ff-only']
}

/** https clone only. Dest is an allowlisted basename; cwd is the jailed parent. */
export function takeGitHttpsUrl(raw) {
  const s = String(raw || '').trim()
  if (!s || s.length > 240) return null
  if (/[\s\0\n\r]/.test(s) || s.includes('..') || s.includes('\\')) return null
  if (!/^https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9._/+-]+(?:\.git)?$/i.test(s)) return null
  if (s.includes('@')) return null
  return s
}

export function gitCloneHttpsArgv(url, destName) {
  const u = takeGitHttpsUrl(url)
  const d = String(destName || '')
  if (!u) throw new Error('bad clone url')
  if (!/^[a-z][a-z0-9-]{1,32}$/.test(d)) throw new Error('bad clone dest')
  return ['clone', '--depth', '1', '--', u, d]
}

/** Current branch to its upstream only. Renderer cannot pass a remote or ref. */
export function gitPushArgv(extra) {
  if (extra !== undefined && extra !== null) throw new Error('push takes no extra args')
  return ['push']
}

/** Unified diff added/removed line numbers. Paths with `..` or extra-root are dropped. */
export function parseGitLineChanges(diff) {
  const out = Object.create(null)
  let file = ''
  let newLine = 0
  for (const line of String(diff || '').split('\n')) {
    const head = line.match(/^diff --git a\/(.+) b\/(.+)$/)
    if (head) {
      const p = head[2]
      if (!p || p.includes('..') || p.startsWith('/') || p.includes('\0')) {
        file = ''
        continue
      }
      file = p
      if (!out[file]) out[file] = { added: [], removed: [] }
      continue
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunk && file) {
      newLine = Number(hunk[1])
      continue
    }
    if (!file) continue
    if (line.startsWith('+++') || line.startsWith('---')) continue
    if (line.startsWith('+')) {
      out[file].added.push(newLine)
      newLine += 1
    } else if (line.startsWith('-')) {
      out[file].removed.push(newLine)
    } else {
      newLine += 1
    }
  }
  return out
}

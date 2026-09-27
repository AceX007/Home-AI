const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function cleanVal(raw) {
  return String(raw || '')
    .replace(/[<>]/g, '')
    .trim()
}

/** Line-based YAML-ish front matter. Folds `>` / `>-` / `|` / `|-` scalars. */
export function parseSkillFrontMatter(md) {
  const text = String(md || '')
  if (!text.startsWith('---')) return { meta: Object.create(null), body: text }
  const end = text.indexOf('\n---', 3)
  if (end < 0) return { meta: Object.create(null), body: text }
  const raw = text.slice(3, end).trim()
  const body = text.slice(end + 4).replace(/^\s+/, '')
  const meta = Object.create(null)
  const lines = raw.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^([\w.-]+):\s*(.*)$/)
    if (!m) continue
    const key = m[1]
    if (BAD_KEYS.has(key)) continue
    let val = String(m[2] || '').trim()
    if (val === '>' || val === '>-' || val === '|' || val === '|-') {
      const folded = val.startsWith('|')
      const parts = []
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) {
        i += 1
        parts.push(lines[i].replace(/^\s+/, '').trimEnd())
      }
      val = parts.join(folded ? '\n' : ' ')
    } else {
      val = val.replace(/^['"]|['"]$/g, '')
    }
    meta[key] = cleanVal(val)
  }
  return { meta, body }
}

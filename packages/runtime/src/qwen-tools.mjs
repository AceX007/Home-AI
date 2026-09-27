const NAME = /^[\w.-]{1,64}$/
const BLOCK = new Set(['', '__proto__', 'constructor', 'prototype'])

function takeName(raw) {
  const n = String(raw || '').trim()
  if (!n || BLOCK.has(n) || n.includes('..') || !NAME.test(n)) return ''
  return n
}

function takeArgs(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const k of Object.getOwnPropertyNames(raw)) {
    if (BLOCK.has(k) || k.includes('__proto__')) continue
    out[k] = raw[k]
  }
  return out
}

function pushCall(out, name, args) {
  const n = takeName(name)
  if (!n) return
  if (out.length >= 8) return
  out.push({
    id: `qwen_${out.length}`,
    name: n,
    arguments: takeArgs(args)
  })
}

function parseObjectAt(src, start) {
  if (src[start] !== '{') return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < src.length && i < start + 12_000; i++) {
    const c = src[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(src.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function recoverQuoted(src, key) {
  const m = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`).exec(String(src || ''))
  if (!m) return ''
  const v = m[1].replace(/\\"/g, '"')
  if (!v || v.includes('..') || v.includes('__proto__') || v.includes('/') || v.includes('\\')) return ''
  return v.slice(0, 80)
}

function skipWsComma(src, i) {
  while (i < src.length && ' \t\n\r,'.includes(src[i])) i++
  return i
}

function spanObject(src, start) {
  if (src[start] !== '{') return -1
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < src.length && i < start + 12_000; i++) {
    const c = src[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return -1
}

function recoverCompleteObjects(src) {
  const text = String(src || '')
  const keyed = /"patch"\s*:\s*\[/.exec(text)
  let i = keyed ? keyed.index + keyed[0].length : -1
  if (i < 0) {
    const trimmed = text.trim()
    if (trimmed.startsWith('[')) i = text.indexOf('[') + 1
  }
  if (i < 0) return []
  const items = []
  while (i < text.length && items.length < 32) {
    i = skipWsComma(text, i)
    if (i >= text.length || text[i] === ']') break
    if (text[i] !== '{') break
    const obj = parseObjectAt(text, i)
    const end = spanObject(text, i)
    if (!obj || end < 0) break
    items.push(obj)
    i = end
  }
  return items
}

function jsonishValue(raw) {
  const s = String(raw || '').trim()
  if (!s) return s
  if (s[0] === '{' || s[0] === '[') {
    const parsed = parseToolArguments(s[0] === '[' ? `{"patch":${s}}` : s)
    if (s[0] === '[') return Array.isArray(parsed.patch) ? parsed.patch : []
    return parsed
  }
  return s
}

/** Native llama tool arguments are often truncated JSON or a node list, not RFC 6902. */
export function parseToolArguments(raw) {
  const src = String(raw || '')
  if (!src.trim()) return {}
  try {
    const v = JSON.parse(src)
    if (Array.isArray(v)) return { patch: v }
    if (v && typeof v === 'object') return takeArgs(v)
  } catch {
    /* recover complete objects from a cut-off stream */
  }
  const start = src.indexOf('{')
  if (start >= 0) {
    const obj = parseObjectAt(src, start)
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return takeArgs(obj)
  }
  const out = takeArgs({})
  const patch = recoverCompleteObjects(src)
  if (patch.length) out.patch = patch
  const id = recoverQuoted(src, 'id')
  const rev = recoverQuoted(src, 'baseRevision')
  if (id) out.id = id
  if (rev) out.baseRevision = rev
  return out
}

/** Local 2B emits XML / ✿ / tagged JSON, not always OpenAI native tool_calls. */
export function parseQwenToolCalls(text) {
  const src = String(text || '')
  const out = []

  const tagged = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g
  let m
  while ((m = tagged.exec(src))) {
    const body = m[1].trim()
    try {
      const json = JSON.parse(body)
      if (json && json.name) {
        pushCall(out, json.name, json.arguments ?? json.parameters ?? {})
        continue
      }
    } catch {
      /* name\n{args} */
    }
    const nl = body.indexOf('\n')
    const first = (nl === -1 ? body : body.slice(0, nl)).trim()
    const rest = nl === -1 ? '' : body.slice(nl).trim()
    let args = {}
    if (rest) args = parseToolArguments(rest)
    pushCall(out, first, args)
  }

  const fn = /<function=([\w.-]+)>([\s\S]*?)<\/function>/g
  while ((m = fn.exec(src))) {
    const args = {}
    const pre = /<parameter=([\w.-]+)>([\s\S]*?)<\/parameter>/g
    let p
    while ((p = pre.exec(m[2]))) {
      const key = p[1]
      if (BLOCK.has(key) || key.includes('__proto__')) continue
      const val = jsonishValue(p[2].trim())
      if (key === 'patch' && val && typeof val === 'object' && !Array.isArray(val) && Array.isArray(val.patch)) {
        args.patch = val.patch
      } else args[key] = val
    }
    pushCall(out, m[1], args)
  }

  const flower = /✿FUNCTION✿\s*([\w.-]+)\s*✿ARGS✿\s*(\{[\s\S]*?\})/g
  while ((m = flower.exec(src))) {
    pushCall(out, m[1], parseToolArguments(m[2]))
  }

  if (!out.length) {
    const needle = /"name"\s*:\s*"(design_get|design_patch|design_ingest_tokens)"/g
    while ((m = needle.exec(src))) {
      let start = m.index
      while (start > 0 && src[start] !== '{') start--
      const json = parseObjectAt(src, start)
      if (json && json.name) pushCall(out, json.name, json.arguments ?? json.parameters ?? {})
    }
  }

  return out
}

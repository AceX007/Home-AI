export const TOOL_PACKS = ['core', 'research', 'browser', 'design', 'life', 'mcp-domain']

const RESEARCH_TOOLS = new Set(['web_search', 'http_fetch', 'web_extract'])
const BROWSER_TOOLS = new Set([
  'browser_navigate',
  'browser_extract',
  'browser_click',
  'browser_type',
  'browser_screenshot',
  'browser_console'
])
const DESIGN_TOOLS = new Set(['design_get', 'design_patch', 'design_ingest_tokens'])
const LIFE_TOOLS = new Set([
  'notes_list',
  'notes_write',
  'calendar_list',
  'calendar_upsert',
  'inbox_ocr',
  'inbox_stt',
  'speak'
])

export function packFromName(name) {
  const n = String(name || '')
  if (n.startsWith('mcp_')) return 'mcp-domain'
  if (BROWSER_TOOLS.has(n)) return 'browser'
  if (DESIGN_TOOLS.has(n)) return 'design'
  if (RESEARCH_TOOLS.has(n)) return 'research'
  if (LIFE_TOOLS.has(n)) return 'life'
  return 'core'
}

export function packOf(tool) {
  const p = tool && typeof tool.pack === 'string' ? tool.pack : ''
  if (TOOL_PACKS.includes(p)) return p
  return packFromName(tool && tool.name)
}

export function takePackName(raw) {
  const t = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
  return TOOL_PACKS.includes(t) ? t : null
}

/** Slash `/pack research,browser` plus task/skill keywords. Always includes core. */
export function detectToolPacks(task, skills) {
  const packs = new Set(['core'])
  const text = String(task || '')
  const slash = text.match(/(?:^|\s)\/packs?\s+([\w,.\-\s]+)/i)
  if (slash) {
    for (const bit of slash[1].split(/[\s,]+/)) {
      const p = takePackName(bit)
      if (p) packs.add(p)
    }
  }
  const t = text.toLowerCase()
  if (/\b(search|research|http_fetch|web_search|cite|duckduckgo|fetch url)\b/.test(t)) packs.add('research')
  if (/\b(browser|navigate|screenshot|devtools|click selector)\b/.test(t)) packs.add('browser')
  if (/\b(designir|design_patch|canvas|dtcg)\b/.test(t)) packs.add('design')
  if (/\b(notes?|calendar|ics|inbox|ocr|taskboard|voice|whisper|piper|stt|tts|speak)\b/.test(t)) packs.add('life')
  if (/\b(mcp|home assistant|homeassistant|blender|chrome-devtools|codebase-memory)\b/.test(t)) {
    packs.add('mcp-domain')
  }
  const list = Array.isArray(skills) ? skills : []
  for (const s of list) {
    const hay = `${s && s.name ? s.name : ''} ${s && s.description ? s.description : ''}`.toLowerCase()
    if (/\bresearch\b/.test(hay) || /\bweb_search\b/.test(hay)) packs.add('research')
    if (/\bbrowser\b/.test(hay)) packs.add('browser')
    if (/\bdesignir\b/.test(hay) || /\bdesign_patch\b/.test(hay)) packs.add('design')
    if (
      /\bnotes?\b/.test(hay) ||
      /\bcalendar\b/.test(hay) ||
      /\blife pack\b/.test(hay) ||
      /\b(voice|whisper|piper|stt|tts|speak)\b/.test(hay)
    ) {
      packs.add('life')
    }
    if (/\bmcp\b/.test(hay)) packs.add('mcp-domain')
  }
  return [...packs]
}

export function shrinkToolDef(def, fullSchema) {
  if (!def || typeof def !== 'object') return def
  if (fullSchema) return def
  return {
    ...def,
    parameters: { type: 'object', properties: {} },
    description: String(def.description || def.name || '').split('\n')[0].slice(0, 160)
  }
}

export function filterToolsByPack(tools, packs) {
  const allowed = new Set(Array.isArray(packs) && packs.length ? packs : ['core'])
  allowed.add('core')
  const list = Array.isArray(tools) ? tools : []
  return list.filter((t) => t && typeof t.name === 'string' && allowed.has(packOf(t)))
}

/** Core tools that keep parameters even when an extra pack is on. */
export const CORE_FULL_TOOLS = new Set([
  'explore',
  'fs_read',
  'fs_list',
  'fs_write',
  'str_replace',
  'grep',
  'glob',
  'task',
  'ask_user',
  'rag_search',
  'rag_write',
  'plan_write',
  'debug_log',
  'test_run',
  'terminal_run',
  'compute_run',
  'code_outline',
  'debug_start',
  'debug_breakpoint',
  'debug_stack',
  'debug_evaluate',
  'debug_continue',
  'debug_stop'
])

/** Think keeps schemas only for perceive + handoff. */
export const THINK_FULL_TOOLS = new Set([
  'explore',
  'fs_read',
  'fs_list',
  'grep',
  'glob',
  'rag_search',
  'code_outline',
  'ask_user',
  'plan_write',
  'task',
  'design_get'
])

/** Full JSON schema for the active extra pack(s) plus surgical core. MCP never full. */
export function keepFullSchema(tool, packs, mode) {
  const pack = packOf(tool)
  if (pack === 'mcp-domain') return false
  const name = tool && tool.name ? String(tool.name) : ''
  if (mode === 'think') return THINK_FULL_TOOLS.has(name)
  const list = Array.isArray(packs) && packs.length ? packs : ['core']
  const extras = list.filter((p) => p !== 'core')
  if (!extras.length) return pack === 'core'
  if (extras.includes(pack)) return true
  return CORE_FULL_TOOLS.has(name)
}

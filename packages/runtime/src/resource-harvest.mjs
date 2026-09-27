/** Backend-only harvest of AI Resources. Never copy foreign UI or unjailed FS MCP into starter. */

export const HARVEST_KINDS = Object.freeze(['analog', 'port', 'skip-ui', 'skip-unjail', 'next'])

/** Compiler-OS ports must stay analog | port | next — never skip-unjail into starter. */
export const COMPILER_OS_PORTS = Object.freeze([
  'codebase-memory',
  'design-blueprint',
  'hermes-agent',
  'eliza',
  'harness',
  'ruflo',
  'chrome-devtools',
  'blender-mcp',
  'mcp-use',
  'activepieces'
])

export const RESOURCE_HARVEST = Object.freeze([
  { id: 'astrbot', dir: 'AstrBot-master', kind: 'next' },
  { id: 'code-ide', dir: 'Code IDE 0.1', kind: 'skip-ui' },
  { id: 'desktop-commander', dir: 'DesktopCommanderMCP-main', kind: 'skip-unjail' },
  { id: 'harness', dir: 'Harness-0.1', kind: 'next' },
  { id: 'scrapegraph', dir: 'Scrapegraph-ai-2.2.2', kind: 'next' },
  { id: 'ruflo', dir: 'Some AI Stuff', kind: 'next' },
  { id: 'activepieces', dir: 'activepieces-0.88.4-hotfix.1', kind: 'next' },
  { id: 'blender-mcp', dir: 'blender-mcp-main', kind: 'port' },
  { id: 'bot-on-anything', dir: 'bot-on-anything-master', kind: 'next' },
  { id: 'chrome-devtools', dir: 'chrome-devtools-mcp-chrome-devtools-mcp-v1.8.0', kind: 'analog' },
  { id: 'codebase-memory', dir: 'codebase-memory-mcp-main', kind: 'analog' },
  { id: 'eliza', dir: 'eliza-develop', kind: 'next' },
  { id: 'git-mcp', dir: 'git-mcp-main', kind: 'next' },
  { id: 'git-workbench', dir: 'git-workbench-1.0.0', kind: 'skip-ui' },
  { id: 'hermes-agent', dir: 'hermes-agent-2026.8.27', kind: 'next' },
  { id: 'kirara', dir: 'kirara-ai-master', kind: 'next' },
  { id: 'livehelperchat', dir: 'livehelperchat-master', kind: 'skip-ui' },
  { id: 'browser-mcp', dir: 'mcp-main', kind: 'skip-ui' },
  { id: 'monday-mcp', dir: 'mcp-master', kind: 'next' },
  { id: 'mcp-use', dir: 'mcp-use-main', kind: 'next' },
  { id: 'design-blueprint', dir: 'Design-Modular-Blueprint.md', kind: 'analog' }
])

const SKIP_NAMES = new Set(['.DS_Store'])

export function harvestDirKey(name) {
  return String(name || '')
    .replace(/\s+\(\d+\)$/, '')
    .trim()
}

export function harvestKindForDir(name) {
  const key = harvestDirKey(name)
  if (!key || SKIP_NAMES.has(key)) return null
  if (/\.(zip|png|jpg|webp)$/i.test(key)) return null
  const row = RESOURCE_HARVEST.find((r) => r.dir === key)
  return row ? row.kind : null
}

export function harvestRow(id) {
  const want = String(id || '')
  return RESOURCE_HARVEST.find((r) => r.id === want) || null
}

export function starterForbidden() {
  return Object.freeze(['desktop-commander', 'desktopcommander', 'gitmcp.io', 'scrapegraph', 'file:'])
}

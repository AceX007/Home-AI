export const MCP_DOMAIN_PACKS = [
  { id: 'home-assistant', hint: 'http MCP at the Home Assistant origin only' },
  { id: 'blender', hint: 'stdio blender-mcp when Blender is running' },
  { id: 'messaging', hint: 'extra chat networks via MCP, not a second Telegram' }
]

export function domainPackLines() {
  return MCP_DOMAIN_PACKS.map((p) => {
    const id = String(p && p.id ? p.id : '')
      .replace(/[<>]/g, '')
      .slice(0, 40)
    const hint = String(p && p.hint ? p.hint : '')
      .replace(/[<>]/g, '')
      .slice(0, 140)
    return id && hint ? `${id} · ${hint}` : ''
  }).filter(Boolean)
}

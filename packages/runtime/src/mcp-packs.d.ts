export const MCP_STARTER_IDS: string[]
export const MCP_DOMAIN_PACKS: Array<{ id: string; hint: string }>
export function domainPackLines(): string[]
export function takeMcpEnableOpts(raw: unknown): { npx: boolean; blender: boolean }
export function exampleMcpConfig(): {
  mcpServers: Record<string, { command: string; args: string[] }>
}
export function starterMcpServers(
  workspace: string,
  opts?: { npx?: boolean; blender?: boolean }
): Record<string, { command?: string; args?: string[]; url?: string }>
export function mergeMcpConfig(workspace: string, extraServers: unknown): { mcpServers: Record<string, unknown> }
export function enableMcpStarter(
  workspace: string,
  opts?: { npx?: boolean; blender?: boolean }
): { mcpServers: Record<string, unknown> }
export function writeMcpExample(workspace: string): string

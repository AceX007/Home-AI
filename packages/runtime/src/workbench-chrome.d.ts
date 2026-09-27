export const ACTIVITIES: string[]
export const BOTTOM_TABS: string[]
export const SPLITS: string[]
export const LAYOUT_MODES: string[]
export const DENSITIES: string[]
export const COMMAND_IDS: string[]
export const PORT_NAMES: string[]

export function layoutFile(): string
export function takeActivity(raw: unknown): string | null
export function takeBottomTab(raw: unknown): string | null
export function takeSplit(raw: unknown): string | null
export function takeLayoutMode(raw: unknown): string | null
export function takeDensity(raw: unknown): string | null
export function takeCowork(raw: unknown): boolean | null
export function takeCrumbs(rel: unknown): string[]
export function takeCommandId(raw: unknown): string | null
export function takeWorkspaceRel(raw: unknown): string | null
export function takeFileName(raw: unknown): string | null
export function takeChatId(raw: unknown): string | null
export function takePinnedChats(raw: unknown): string[]
export function takeLayout(raw: unknown): {
  activity: string
  chatOpen: boolean
  termOpen: boolean
  sidebarW: number
  chatW: number
  termH: number
  termPanel: string
  split: string
  layoutMode: string
  density: string
  tabs: string[]
  active: string | null
  splitPath: string | null
  pinnedChats: string[]
  cowork: boolean
}
export function takeChromePulse(raw: unknown): {
  llama: 'on' | 'off' | 'missing'
  keys: string
  cursor: string
  mode: string
  mind: 'local' | 'openai' | 'openrouter' | 'cursor'
  telegram: boolean
  glass: boolean
  mcp: number
  pending: number
  live: number
  busy: boolean
  gpu: string
  vramMb: number
  ngl: number
  ctx: number
  llamaErr: string
}
export function takePortRow(raw: unknown): { name: string; port: number } | null
export function takePortList(raw: unknown): Array<{ name: string; port: number }>
export function takeOutputLine(raw: unknown): string
export function takeOutputLines(raw: unknown): string[]
export function takeCursorPos(raw: unknown): { line: number; col: number; lang: string }
export function loadLayout(root: string): ReturnType<typeof takeLayout>
export function saveLayout(root: string, raw: unknown): ReturnType<typeof takeLayout>

export type SidebarKind = 'files' | 'search' | 'git' | 'notes' | 'debug' | 'skills' | 'maps' | 'none'
export type CenterView = 'editor' | 'browser'

export function activityLabel(activity: string): string
export function sidebarKind(activity: string): SidebarKind
export function centerViewForActivity(activity: string): CenterView
export function isStudioActivity(activity: string): boolean
export function isPageActivity(activity: string): boolean
export function isListActivity(activity: string): boolean
export function isEditorActivity(activity: string): boolean
export function takeEditorColumn(raw: unknown): 'on' | 'off'
export function takeSlots(raw: unknown): {
  sidebar: 'on' | 'off'
  center: 'on' | 'off'
  chat: 'on' | 'off' | 'ticker'
  sessionsRail: 'on' | 'off'
  editor: 'on' | 'off'
}
export function takeChatPx(raw: unknown): number
export function redactDebugText(s: string, max?: number): string

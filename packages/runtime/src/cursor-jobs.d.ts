export function cursorAgentId(raw: unknown): string | null
export function cursorJobSummary(raw: unknown): { id: string; status: string; name: string; summary: string } | null
export function cursorJobList(raw: unknown): Array<{ id: string; status: string; name: string; summary: string }>
export function cursorGetUrl(id: unknown): string

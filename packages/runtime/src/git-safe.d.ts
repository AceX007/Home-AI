export function gitPullArgv(extra?: unknown): ['pull', '--ff-only']
export function gitPushArgv(extra?: unknown): ['push']
export function takeGitHttpsUrl(raw: unknown): string | null
export function gitCloneHttpsArgv(url: unknown, destName: unknown): string[]
export function parseGitLineChanges(diff: unknown): Record<string, { added: number[]; removed: number[] }>

export function takeFsRootId(raw: unknown): string
export function extraRootById(extraRoots: unknown, rootId: unknown): string | null
export function assertInside(root: string, target: string, extraRoots?: string[], rootId?: unknown): string
export function jailPath(
  root: string,
  target: string,
  extraRoots?: string[],
  rootId?: unknown
): { path: string; extra: boolean }
export function pathIsExtraRoot(root: string, resolved: string, extraRoots?: string[]): boolean
export function gitPathspecs(root: string, paths: unknown): string[]

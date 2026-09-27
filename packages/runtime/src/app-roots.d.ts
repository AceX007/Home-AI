export function takeWorkspaceJail(raw: unknown): string
export function takeHexHome(home: unknown): string
export function takeAppRoots(raw?: {
  packaged?: boolean
  home?: string
  userData?: string
  cwd?: string
  appPath?: string
  envRoot?: string
  lastWorkspace?: string
  resourcesPath?: string
}): {
  packaged: boolean
  operator: boolean
  appResources: string
  profile: string
  workspace: string
  secretsDir: string
  modelsDir: string
  hexHome: string
  vendorDir: string
}
export function takeOnboardNeeded(roots: { packaged?: boolean }, onboardDone: unknown): boolean
export function takeModelCandidates(roots: { workspace?: string; modelsDir?: string; appResources?: string; profile?: string }, modelName?: string): string[]
export function takeModelPath(
  roots: { workspace?: string; modelsDir?: string; appResources?: string; profile?: string },
  existsFn?: (p: string) => boolean,
  modelName?: string
): string
export function takeGgufDest(modelsDir: unknown, modelName?: string): string
export function takeLastWorkspaceFile(profile: unknown): string
export function takeRootsState(raw: unknown): { workspace: string; onboardDone: boolean; crashOptIn: 'local' | 'off' }
export function takeLibraryStub(day: unknown): Record<string, string> | null
export function takeSecretName(raw: unknown): string
export function secretFileNames(name: unknown): { plain: string; enc: string } | null
export const DEFAULT_GGUF_NAME: string
export function isPackedAppPath(p: unknown): boolean
export function takeOpenFolder(picked: unknown): string

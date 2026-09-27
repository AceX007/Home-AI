export const FLEET_KINDS: string[]
export const FLEET_RECIPES: string[]
export const BOT_ROLES: string[]
export const SUB_KINDS: string[]
export const SMTP_PROVIDERS: Record<string, { host: string; port: number } | null>
export const LINK_INFO_REL: string
export function takeFleetId(raw: unknown): string | null
export function takeSiteDomain(raw: unknown): string | null
export function nextCloneId(fromId: unknown, ids: unknown): string | null
export function stackForest(repos: unknown): Array<Record<string, unknown> & { clones: unknown[] }>
export function takeFleetKind(raw: unknown): string | null
export function takeFleetRecipe(raw: unknown): string | null
export function kindFromAddRel(rel: unknown): string | null
export function defaultRecipeForKind(kind: unknown): string
export function takeRepoRel(raw: unknown): string | null
export function takeBotRole(raw: unknown): string | null
export function takeBotUsername(raw: unknown): string | null
export function takeBotToken(raw: unknown): string | null
export function maskSecret(raw: unknown): string
export function takePlainLine(raw: unknown, max?: number): string | null
export function takeBroadcastBody(raw: unknown): string | null
export function takeTelegramChatId(raw: unknown): number | null
export function takeEmail(raw: unknown): string | null
export function maskEmail(raw: unknown): string
export function takeSmtpProvider(raw: unknown): string | null
export function smtpEndpoint(provider: unknown): { host: string; port: number } | null
export function takeSmtpHop(host: unknown, port: unknown): { host: string; port: number } | null
export function takeAccountLabel(raw: unknown): string | null
export function recipeSpawn(recipe: unknown): { bin: string; args: string[] } | null
export function redactFleetLog(text: unknown): string
export function rotationNotice(username: unknown): string | null
export function emptyRegistry(): Record<string, unknown>
export function takeRegistry(raw: unknown): Record<string, unknown>
export function seedLinkInfo(reg: unknown, existsRel: (rel: string) => boolean): Record<string, unknown>
export function registryPath(root: string): string
export function loadRegistry(root: string): Record<string, unknown>
export function saveRegistry(root: string, raw: unknown): Record<string, unknown>
export function publicSnapshot(reg: unknown, live?: Record<string, unknown>): Record<string, unknown>
export function botSecretRel(id: unknown): string | null
export function accountSecretRel(id: unknown): string | null
export function smtpSecretRel(): string
export function idFromCloneUrl(url: unknown): string | null
export function takeFleetCommand(text: unknown): {
  action: string
  id?: string
  url?: string
  rel?: string
  kind?: string
  recipe?: string
  fromId?: string
} | null
export function filterSubscribers(
  subs: unknown,
  raw: unknown
): Array<{ kind?: string; chatId?: number; email?: string; botId?: string }>
export function fleetCard(snap: unknown): string
export { takeGitHttpsUrl } from './git-safe.mjs'

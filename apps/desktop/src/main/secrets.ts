import { chmod, mkdir, readFile, writeFile, unlink, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ProviderId, ProviderStatus, SecretName } from '@homeai/core'
import { secretFileNames, takeSecretName } from '@homeai/runtime'

const NAMES: SecretName[] = ['openai', 'openrouter', 'cursor', 'groq', 'gemini', 'telegram']

export type SecretCrypt = {
  available: () => boolean
  encrypt: (plain: string) => Buffer
  decrypt: (blob: Buffer) => string
}

let crypt: SecretCrypt | null = null

export function attachSecretCrypt(next: SecretCrypt | null): void {
  crypt = next
}

export function secretPath(dir: string, name: SecretName): string {
  return join(dir, `${name}.key`)
}

export async function ensureSecretsDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true, mode: 0o700 })
}

export async function setSecret(dir: string, name: SecretName, value: string): Promise<void> {
  const n = takeSecretName(name) as SecretName
  if (!n || !NAMES.includes(n)) throw new Error('bad secret')
  await ensureSecretsDir(dir)
  const names = secretFileNames(n)
  if (!names) throw new Error('bad secret')
  const plain = join(dir, names.plain)
  const enc = join(dir, names.enc)
  const v = value.trim()
  if (crypt?.available()) {
    const buf = crypt.encrypt(v)
    await writeFile(enc, buf, { mode: 0o600 })
    await chmod(enc, 0o600)
    if (existsSync(plain)) await unlink(plain)
    return
  }
  await writeFile(plain, v, { encoding: 'utf8', mode: 0o600 })
  await chmod(plain, 0o600)
}

export async function getSecret(dir: string, name: string): Promise<string | null> {
  const n = takeSecretName(name)
  if (!n) return null
  const envMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    cursor: 'CURSOR_API_KEY',
    groq: 'GROQ_API_KEY',
    gemini: 'GEMINI_API_KEY',
    telegram: 'TELEGRAM_BOT_TOKEN'
  }
  const env = envMap[n]
  if (env && process.env[env]) return process.env[env] ?? null
  const names = secretFileNames(n)
  if (!names) return null
  const enc = join(dir, names.enc)
  if (crypt?.available() && existsSync(enc)) {
    try {
      return crypt.decrypt(await readFile(enc)).trim() || null
    } catch {
      return null
    }
  }
  const p = join(dir, names.plain)
  if (!existsSync(p)) return null
  const v = (await readFile(p, 'utf8')).trim()
  return v || null
}

export async function deleteSecret(dir: string, name: SecretName): Promise<void> {
  const names = secretFileNames(name)
  if (!names) return
  for (const f of [join(dir, names.plain), join(dir, names.enc)]) {
    if (existsSync(f)) await unlink(f)
  }
}

export async function providerStatus(dir: string): Promise<ProviderStatus[]> {
  const labels: Record<ProviderId, string> = {
    local: 'Local 2B GGUF',
    openai: 'OpenAI',
    openrouter: 'OpenRouter',
    cursor: 'Cursor Cloud Agents'
  }
  const local: ProviderStatus = { id: 'local', configured: true, label: labels.local }
  const rest: ProviderStatus[] = []
  for (const id of ['openai', 'openrouter', 'cursor'] as const) {
    rest.push({ id, configured: Boolean(await getSecret(dir, id)), label: labels[id] })
  }
  return [local, ...rest]
}

export async function listSecretFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  return (await readdir(dir)).filter((f) => f.endsWith('.key') || f.endsWith('.enc'))
}

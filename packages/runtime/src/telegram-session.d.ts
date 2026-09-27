export function takeTelegramSession(raw: unknown): {
  configured: boolean
  online: boolean
  peers: number[]
  pairing: { exp: number } | null
  mode: string
  mind: 'local' | 'openai' | 'openrouter' | 'cursor'
  llama: 'on' | 'off' | 'missing'
  keys: string
  cursor: string
  live: Array<{ id: string; title: string; mode: string }>
  threads: Array<{ id: string; title: string }>
  glass: boolean
}

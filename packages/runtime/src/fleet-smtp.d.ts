export function sendAllowlistedSmtp(opts: {
  host: unknown
  port: unknown
  from: unknown
  to: unknown
  user: unknown
  pass: unknown
  subject?: unknown
  body?: unknown
}): Promise<{ ok: true }>

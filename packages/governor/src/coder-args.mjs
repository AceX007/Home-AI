import { join, resolve } from 'node:path'

const CODER_HOST = '127.0.0.1'
const CODER_CTX_CAP = 2048
const CODER_PORT_FALLBACK = 8766

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

function clampPort(port) {
  const p = Number(port)
  if (!Number.isInteger(p) || p < 1 || p > 65535) return CODER_PORT_FALLBACK
  return p
}

/** Sidecar llama-server args: loopback only, ctx ≤2048, half the 2B ngl. Port is never renderer-chosen. */
export function coderLlamaArgs(probe, modelPath, port) {
  const p = probe && typeof probe === 'object' ? probe : {}
  const threads = clamp((Number(p.cpuThreads) || 4) - 2, 2, 8)
  const nGpuLayers = Math.max(0, Math.floor((Number(p.nGpuLayers) || 0) / 2))
  const contextSize = Math.min(CODER_CTX_CAP, Math.max(1, Number(p.contextSize) || CODER_CTX_CAP))
  return {
    modelPath: String(modelPath || ''),
    host: CODER_HOST,
    port: clampPort(port),
    nGpuLayers,
    contextSize,
    batchSize: Number(p.batchSize) > 0 ? Number(p.batchSize) : 256,
    threads,
    flashAttn: p.profile !== 'cpu'
  }
}

/** Allowlisted GGUF basename under the workspace root. Rejects `..` and extra-root names. */
export function jailedCoderModelPath(root, name) {
  const n = String(name || '')
  if (!/^[A-Za-z0-9._-]+\.gguf$/i.test(n)) return null
  const base = resolve(String(root || ''))
  const full = resolve(join(base, n))
  const prefix = base.endsWith('/') ? base : `${base}/`
  if (full !== join(base, n) && !full.startsWith(prefix) && full !== base) return null
  if (!full.startsWith(prefix) && full !== base) return null
  return full
}

import { spawnSync } from 'node:child_process'

const LIFE_BINS = {
  ocr: ['tesseract'],
  stt: ['whisper-cli', 'whisper'],
  tts: ['piper']
}

let cache = { at: 0, bins: null }

function binReady(names) {
  const list = Array.isArray(names) ? names : []
  for (const bin of list) {
    try {
      const r = spawnSync(bin, ['--version'], {
        encoding: 'utf8',
        timeout: 2500,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      if (r.error) continue
      if (r.status === 0 || r.status === 1) return true
    } catch {
      /* missing */
    }
  }
  return false
}

export function probeLifeBins() {
  const now = Date.now()
  if (cache.bins && now - cache.at < 30_000) return cache.bins
  const bins = {
    ocr: binReady(LIFE_BINS.ocr),
    stt: binReady(LIFE_BINS.stt),
    tts: binReady(LIFE_BINS.tts)
  }
  cache = { at: now, bins }
  return bins
}

export function filterLifeTools(tools, bins) {
  const b = bins && typeof bins === 'object' ? bins : { ocr: true, stt: true, tts: true }
  const list = Array.isArray(tools) ? tools : []
  return list.filter((t) => {
    const n = t && typeof t.name === 'string' ? t.name : ''
    if (n === 'inbox_ocr' && !b.ocr) return false
    if (n === 'inbox_stt' && !b.stt) return false
    if (n === 'speak' && !b.tts) return false
    return true
  })
}

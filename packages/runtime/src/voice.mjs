import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, extname } from 'node:path'
import { inboxOnly } from './life-files.mjs'
import { assertInside } from './paths.mjs'

const STT_OK = new Set(['.ogg', '.wav', '.mp3', '.webm', '.m4a'])
const WHISPER_BINS = ['whisper-cli', 'whisper']

export function inboxSttAllowed(path) {
  const ext = extname(String(path || '').replace(/\\/g, '/')).toLowerCase()
  return STT_OK.has(ext)
}

export function speakRel(id) {
  const safe = String(id || 's')
    .replace(/\.\./g, '_')
    .replace(/[^\w.-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 40)
  return `data/tts/${safe || 's'}.wav`
}

function whichBin(names) {
  return new Promise((resolve) => {
    const tryOne = (i) => {
      if (i >= names.length) return resolve(null)
      const bin = names[i]
      const child = spawn(bin, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
      child.on('error', () => tryOne(i + 1))
      child.on('close', (code) => {
        if (code === 0 || code === 1) resolve(bin)
        else tryOne(i + 1)
      })
    }
    tryOne(0)
  })
}

function genericOut(s) {
  return String(s || '')
    .replace(/[<>]/g, '')
    .replace(/https?:\/\/\S+/gi, '')
    .slice(0, 8000)
}

export async function inboxTranscript(root, rel) {
  const text = await inboxStt(root, rel)
  if (!text || /^stt (unavailable|refuses)/.test(text)) return ''
  return genericOut(text).slice(0, 800)
}

export async function inboxStt(root, path) {
  const raw = String(path || '')
  if (!inboxSttAllowed(raw)) {
    return 'stt refuses that type — ogg/wav/mp3/webm/m4a under data/inbox only.'
  }
  let abs
  try {
    abs = inboxOnly(root, raw)
  } catch {
    return 'stt unavailable'
  }
  const bin = await whichBin(WHISPER_BINS)
  if (!bin) return 'stt unavailable'
  return new Promise((resolve) => {
    const argv = bin === 'whisper-cli' ? ['-f', abs, '-nt'] : [abs]
    const child = spawn(bin, argv, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH || '/usr/bin:/bin', LANG: 'C.UTF-8', HOME: dirname(abs) }
    })
    let out = ''
    const t = setTimeout(() => {
      child.kill('SIGKILL')
      resolve('stt unavailable')
    }, 20_000)
    child.stdout?.on('data', (d) => {
      out += String(d)
    })
    child.stderr?.on('data', (d) => {
      out += String(d)
    })
    child.on('error', () => {
      clearTimeout(t)
      resolve('stt unavailable')
    })
    child.on('close', (code) => {
      clearTimeout(t)
      const text = genericOut(out)
      if (code !== 0 && !text.trim()) resolve('stt unavailable')
      else resolve(text || '(empty stt)')
    })
  })
}

export async function speak(root, text) {
  const t = String(text ?? '')
    .replace(/[<>]/g, '')
    .slice(0, 2000)
  if (!t.trim()) return 'tts empty'
  const id = `s${Date.now().toString(36)}`
  const rel = speakRel(id)
  if (rel.includes('..')) return 'tts unavailable'
  let abs
  try {
    abs = assertInside(root, rel)
  } catch {
    return 'tts unavailable'
  }
  mkdirSync(dirname(abs), { recursive: true })
  const bin = await whichBin(['piper'])
  if (!bin) return 'tts unavailable'
  return new Promise((resolve) => {
    const child = spawn(bin, ['--output_file', abs], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH || '/usr/bin:/bin', LANG: 'C.UTF-8', HOME: dirname(abs) }
    })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve('tts unavailable')
    }, 20_000)
    child.on('error', () => {
      clearTimeout(timer)
      resolve('tts unavailable')
    })
    child.on('close', () => {
      clearTimeout(timer)
      if (existsSync(abs)) resolve(rel)
      else resolve('tts unavailable')
    })
    try {
      child.stdin.write(t)
      child.stdin.end()
    } catch {
      clearTimeout(timer)
      resolve('tts unavailable')
    }
  })
}

import { spawn } from 'node:child_process'
import { extname } from 'node:path'
import { inboxOnly } from './life-files.mjs'

const OCR_OK = new Set(['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.bmp'])

export function inboxOcrAllowed(path) {
  const ext = extname(String(path || '').replace(/\\/g, '/')).toLowerCase()
  return OCR_OK.has(ext)
}

function whichTesseract() {
  return new Promise((resolve) => {
    const child = spawn('tesseract', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
    child.on('error', () => resolve(null))
    child.on('close', (code) => resolve(code === 0 || code === 1 ? 'tesseract' : null))
  })
}

export async function inboxOcr(root, path) {
  const raw = String(path || '')
  if (!inboxOcrAllowed(raw)) {
    return 'ocr refuses that type — png/jpeg/tiff/webp/bmp under data/inbox only.'
  }
  const abs = inboxOnly(root, raw)
  const bin = await whichTesseract()
  if (!bin) {
    return 'ocr unavailable — install tesseract, or attach as text. path stays data/inbox only.'
  }
  return new Promise((resolve, reject) => {
    const child = spawn(bin, [abs, 'stdout', '-l', 'eng'], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    const t = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('ocr timeout'))
    }, 20_000)
    child.stdout?.on('data', (d) => {
      out += String(d)
    })
    child.stderr?.on('data', (d) => {
      out += String(d)
    })
    child.on('error', (e) => {
      clearTimeout(t)
      reject(e)
    })
    child.on('close', () => {
      clearTimeout(t)
      resolve(out.replace(/[<>]/g, '').slice(0, 8_000) || '(empty ocr)')
    })
  })
}

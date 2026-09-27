import { BrowserView, type BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

let view: BrowserView | null = null
let attached: BrowserWindow | null = null
let lastCapture = ''
let consoleHooked = false

type ConsoleLine = { t: string; level: number; message: string; source?: string }
const consoleBuf: ConsoleLine[] = []
const CONSOLE_CAP = 200

function pushConsole(line: ConsoleLine): void {
  consoleBuf.push(line)
  if (consoleBuf.length > CONSOLE_CAP) consoleBuf.splice(0, consoleBuf.length - CONSOLE_CAP)
}

function hookConsole(v: BrowserView): void {
  if (consoleHooked) return
  consoleHooked = true
  v.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    pushConsole({
      t: new Date().toISOString(),
      level,
      message: String(message).slice(0, 4000),
      source: `${sourceId}:${line}`
    })
  })
}

export function getBrowserView(): BrowserView {
  if (view) return view
  view = new BrowserView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  hookConsole(view)
  view.webContents.setWindowOpenHandler(() => ({ action: 'allow' }))
  return view
}

export function lastBrowserText(): string {
  return lastCapture
}

export function browserCurrentUrl(): string {
  if (!view) return ''
  try {
    return view.webContents.getURL() || ''
  } catch {
    return ''
  }
}

export function showBrowser(win: BrowserWindow, bounds: { x: number; y: number; width: number; height: number }): void {
  const v = getBrowserView()
  if (attached !== win) {
    win.setBrowserView(v)
    attached = win
  }
  v.setBounds(bounds)
  v.setAutoResize({ width: false, height: false })
}

export function hideBrowser(win: BrowserWindow): void {
  if (attached === win) {
    win.setBrowserView(null)
    attached = null
  }
}

export async function browserNavigate(url: string): Promise<void> {
  const v = getBrowserView()
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`
  await v.webContents.loadURL(target)
}

export async function browserExtract(root: string): Promise<{ url: string; title: string; text: string; saved: string }> {
  const v = getBrowserView()
  const url = v.webContents.getURL()
  const title = v.webContents.getTitle()
  const text = (await v.webContents.executeJavaScript(
    `document.body ? document.body.innerText.slice(0, 20000) : ''`
  )) as string
  lastCapture = `# ${title}\nURL: ${url}\n\n${text}`
  const dir = join(root, 'browser', 'captures')
  await mkdir(dir, { recursive: true })
  const safe = (title || 'page').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60)
  const saved = join(dir, `${Date.now()}_${safe}.md`)
  await writeFile(saved, lastCapture + '\n', 'utf8')
  return { url, title, text, saved }
}

export async function browserClick(selector: string): Promise<string> {
  const v = getBrowserView()
  const sel = JSON.stringify(selector)
  const ok = (await v.webContents.executeJavaScript(`
    (() => {
      const el = document.querySelector(${sel});
      if (!el) return false;
      el.click();
      return true;
    })()
  `)) as boolean
  return ok ? `clicked ${selector}` : `no element ${selector}`
}

export async function browserType(selector: string, text: string): Promise<string> {
  const v = getBrowserView()
  const sel = JSON.stringify(selector)
  const val = JSON.stringify(text)
  const ok = (await v.webContents.executeJavaScript(`
    (() => {
      const el = document.querySelector(${sel});
      if (!el) return false;
      el.focus();
      if ('value' in el) el.value = ${val};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `)) as boolean
  return ok ? `typed into ${selector}` : `no element ${selector}`
}

export async function browserScreenshot(root: string): Promise<string> {
  const v = getBrowserView()
  const img = await v.webContents.capturePage()
  const dir = join(root, 'browser', 'captures')
  await mkdir(dir, { recursive: true })
  const saved = join(dir, `${Date.now()}_shot.png`)
  await writeFile(saved, img.toPNG())
  return saved
}

export async function browserConsole(root: string, persist = false): Promise<string> {
  const text =
    consoleBuf
      .map((l) => `${l.t} [${l.level}] ${l.message}${l.source ? ` (${l.source})` : ''}`)
      .join('\n') || '(empty)'
  if (persist) {
    const dir = join(root, 'browser', 'captures')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'console.log'), text + '\n', 'utf8')
  }
  return text
}

export function disposeBrowser(): void {
  view = null
  attached = null
  consoleHooked = false
  consoleBuf.length = 0
}

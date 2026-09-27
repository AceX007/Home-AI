import { ipcMain } from 'electron'
import type { IPty } from 'node-pty'
import { platform } from 'node:os'

const sessions = new Map<number, IPty>()
const transcripts = new Map<number, string>()
let nextId = 1

export function registerPty(workspace: () => string): void {
  ipcMain.handle('homeai:pty:create', async (event, cols: number, rows: number) => {
    let pty: typeof import('node-pty')
    try {
      pty = await import('node-pty')
    } catch {
      throw new Error('node-pty is not built. From the project root run: npx electron-builder install-app-deps')
    }
    const id = nextId++
    const shell = platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash'
    const proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: workspace(),
      env: {
        ...(process.env as Record<string, string>),
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        PS1: '\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ ',
        PROMPT_COMMAND: 'PS1="\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ "'
      }
    })
    const wc = event.sender
    proc.onData((data) => {
      const cur = (transcripts.get(id) ?? '') + data
      transcripts.set(id, cur.slice(-12_000))
      if (!wc.isDestroyed()) wc.send('homeai:pty:data', id, data)
    })
    proc.onExit(({ exitCode }) => {
      sessions.delete(id)
      if (!wc.isDestroyed()) wc.send('homeai:pty:exit', id, exitCode)
    })
    sessions.set(id, proc)
    return id
  })

  ipcMain.on('homeai:pty:write', (_e, id: number, data: string) => {
    sessions.get(id)?.write(data)
  })

  ipcMain.on('homeai:pty:resize', (_e, id: number, cols: number, rows: number) => {
    sessions.get(id)?.resize(cols, rows)
  })

  ipcMain.handle('homeai:pty:kill', (_e, id: number) => {
    sessions.get(id)?.kill()
    sessions.delete(id)
    transcripts.delete(id)
  })

  ipcMain.handle('homeai:pty:transcript', (_e, id: number) => transcripts.get(id) ?? '')
}

export function lastPtyText(): string {
  return [...transcripts.values()].slice(-2).join('\n---\n')
}

export function disposePtys(): void {
  for (const p of sessions.values()) p.kill()
  sessions.clear()
  transcripts.clear()
}

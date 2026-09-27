import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Checkpoint, CheckpointMeta, FileChange } from '@homeai/core'

/** Review buffer + restore timeline. Git remains source of truth. */
export class ChangeSet {
  private originals = new Map<string, string>()
  private pending = new Map<string, FileChange>()
  private timeline: Checkpoint[] = []

  record(path: string, before: string, after: string, origin: FileChange['origin']): FileChange {
    if (!this.originals.has(path)) this.originals.set(path, before)
    const change: FileChange = {
      path,
      before: this.originals.get(path) ?? before,
      after,
      origin
    }
    this.pending.set(path, change)
    return change
  }

  snapshot(label: string, files: Array<{ path: string; before: string; after: string }>): CheckpointMeta | null {
    if (!files.length) return null
    const cp: Checkpoint = {
      id: `cp_${Date.now().toString(36)}_${this.timeline.length}`,
      label,
      at: Date.now(),
      files: files.map((f) => ({ ...f }))
    }
    this.timeline.push(cp)
    if (this.timeline.length > 40) this.timeline.shift()
    return { id: cp.id, label: cp.label, at: cp.at, files: cp.files.map((f) => f.path) }
  }

  list(): FileChange[] {
    return [...this.pending.values()]
  }

  checkpoints(): CheckpointMeta[] {
    return this.timeline.map((c) => ({
      id: c.id,
      label: c.label,
      at: c.at,
      files: c.files.map((f) => f.path)
    }))
  }

  get(id: string): Checkpoint | undefined {
    return this.timeline.find((c) => c.id === id)
  }

  accept(path: string): void {
    this.pending.delete(path)
    this.originals.delete(path)
  }

  acceptAll(): void {
    this.pending.clear()
    this.originals.clear()
  }

  reject(path: string): boolean {
    const orig = this.originals.get(path)
    if (orig == null) {
      this.pending.delete(path)
      return false
    }
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, orig, 'utf8')
    this.pending.delete(path)
    this.originals.delete(path)
    return true
  }

  undoAll(): string[] {
    const paths = [...this.originals.keys()]
    for (const path of paths) this.reject(path)
    return paths
  }

  restore(id: string): string[] {
    const cp = this.timeline.find((c) => c.id === id)
    if (!cp) return []
    const restored: string[] = []
    for (const f of cp.files) {
      mkdirSync(dirname(f.path), { recursive: true })
      writeFileSync(f.path, f.before, 'utf8')
      this.pending.delete(f.path)
      this.originals.delete(f.path)
      restored.push(f.path)
    }
    return restored
  }
}

export function readMaybe(path: string): string {
  try {
    if (!existsSync(path)) return ''
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

export function applySelection(source: string, selected: string, replacement: string): string {
  if (!selected) return replacement
  const i = source.indexOf(selected)
  if (i < 0) return source
  return source.slice(0, i) + replacement + source.slice(i + selected.length)
}

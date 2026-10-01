import Database from 'better-sqlite3'
import { watch, type FSWatcher } from 'chokidar'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { kindFromPath as kindFromRel } from '../../runtime/src/kind-path.mjs'
import { bugMemoryDirName, ragIngestAllowed } from '../../runtime/src/compiler-os.mjs'
import { takeRagRemoveSpec } from './remove-spec.mjs'
import { takeLikeContains } from '../../runtime/src/search-proof.mjs'
import type { MapEdge, MapNode, QaRecord, RagHit } from '@homeai/core'

const CODE_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.c',
  '.h',
  '.cpp',
  '.cs',
  '.rb',
  '.php',
  '.sh',
  '.sql',
  '.vue',
  '.svelte'
])

const TEXT_EXT = new Set([
  ...CODE_EXT,
  '.md',
  '.txt',
  '.json',
  '.yml',
  '.yaml',
  '.toml',
  '.css',
  '.html',
  '.xml',
  '.csv'
])

const SKIP_DIR = new Set([
  'node_modules',
  '.git',
  'out',
  'dist',
  'vendor',
  'data',
  '.homeai'
])

export function kindFromPath(path: string): string {
  const mapped = kindFromRel(path)
  if (mapped !== 'doc') return mapped
  if (CODE_EXT.has(extname(path).toLowerCase())) return 'code'
  return 'doc'
}

export function chunkCode(text: string, path: string): Array<{ symbol: string; body: string }> {
  const chunks: Array<{ symbol: string; body: string }> = []
  const re =
    /(?:^|\n)(?:export\s+)?(?:async\s+)?(?:function|class|def|fn|func|struct|impl)\s+([A-Za-z0-9_]+)/g
  const indices: Array<{ name: string; at: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    indices.push({ name: m[1], at: m.index })
  }
  if (indices.length === 0) {
    const parts = splitBySize(text, 1800)
    return parts.map((body, i) => ({ symbol: `${path}#${i}`, body }))
  }
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].at
    const end = i + 1 < indices.length ? indices[i + 1].at : text.length
    const body = text.slice(start, end).trim().slice(0, 4000)
    if (body) chunks.push({ symbol: indices[i].name, body })
  }
  return chunks
}

function splitBySize(text: string, size: number): string[] {
  const out: string[] = []
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size))
  return out
}

function walkFiles(root: string, acc: string[] = []): string[] {
  if (!existsSync(root)) return acc
  let entries: string[] = []
  try {
    entries = readdirSync(root)
  } catch {
    return acc
  }
  for (const name of entries) {
    if (name.startsWith('.') && name !== '.cursor') continue
    if (SKIP_DIR.has(name)) {
      if (name === 'data') walkFiles(join(root, name, bugMemoryDirName()), acc)
      continue
    }
    if (name.endsWith('.gguf')) continue
    const p = join(root, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) walkFiles(p, acc)
    else if (st.isFile() && st.size < 1_500_000 && TEXT_EXT.has(extname(p).toLowerCase())) acc.push(p)
  }
  return acc
}

export class RagStore {
  private db: Database.Database
  private watcher: FSWatcher | null = null

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY,
        path TEXT UNIQUE,
        kind TEXT,
        symbol TEXT,
        hash TEXT,
        mtime INTEGER,
        text TEXT
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        path, symbol, text, content='documents', content_rowid='id'
      );
      CREATE TRIGGER IF NOT EXISTS docs_ai AFTER INSERT ON documents BEGIN
        INSERT INTO documents_fts(rowid, path, symbol, text) VALUES (new.id, new.path, new.symbol, new.text);
      END;
      CREATE TRIGGER IF NOT EXISTS docs_ad AFTER DELETE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, path, symbol, text)
          VALUES('delete', old.id, old.path, old.symbol, old.text);
      END;
      CREATE TRIGGER IF NOT EXISTS docs_au AFTER UPDATE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, path, symbol, text)
          VALUES('delete', old.id, old.path, old.symbol, old.text);
        INSERT INTO documents_fts(rowid, path, symbol, text) VALUES (new.id, new.path, new.symbol, new.text);
      END;
      CREATE TABLE IF NOT EXISTS map_nodes (
        id TEXT PRIMARY KEY,
        title TEXT,
        kind TEXT,
        payload TEXT,
        created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS map_edges (
        src TEXT,
        dst TEXT,
        rel TEXT
      );
      CREATE TABLE IF NOT EXISTS qa_runs (
        id TEXT PRIMARY KEY,
        prompt TEXT,
        verdict TEXT,
        notes TEXT,
        trace TEXT,
        created_at INTEGER
      );
    `)
  }

  close(): void {
    void this.watcher?.close()
    this.db.close()
  }

  async ingestPath(filePath: string, workspaceRoot: string): Promise<void> {
    let st
    try {
      st = await stat(filePath)
    } catch {
      this.removePath(relative(workspaceRoot, filePath))
      return
    }
    if (!st.isFile() || st.size > 1_500_000) return
    const ext = extname(filePath).toLowerCase()
    if (!TEXT_EXT.has(ext)) return
    const text = await readFile(filePath, 'utf8')
    const hash = createHash('sha1').update(text).digest('hex')
    const rel = relative(workspaceRoot, filePath) || filePath
    if (!ragIngestAllowed(rel.replace(/\\/g, '/'))) return
    const kind = kindFromPath(filePath)
    const existing = this.db.prepare('SELECT hash FROM documents WHERE path = ? AND symbol IS NULL').get(rel) as
      | { hash: string }
      | undefined
    if (existing?.hash === hash) return

    const spec = takeRagRemoveSpec(rel)
    if (spec) {
      this.db.prepare("DELETE FROM documents WHERE path = ? OR path LIKE ? ESCAPE '\\'").run(spec.path, spec.like)
    }
    const chunks =
      kind === 'code' || CODE_EXT.has(ext) ? chunkCode(text, rel) : [{ symbol: '', body: text.slice(0, 12_000) }]
    const insert = this.db.prepare(
      'INSERT OR REPLACE INTO documents (path, kind, symbol, hash, mtime, text) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const tx = this.db.transaction(() => {
      insert.run(rel, kind, '', hash, st.mtimeMs, text.slice(0, 8000))
      let i = 0
      for (const c of chunks) {
        if (!c.symbol) continue
        i++
        insert.run(`${rel}#chunk:${i}:${c.symbol}`, kind, c.symbol, hash, st.mtimeMs, c.body)
      }
    })
    tx()
  }

  removePath(filePath: string): void {
    const spec = takeRagRemoveSpec(filePath)
    if (!spec) return
    this.db.prepare("DELETE FROM documents WHERE path = ? OR path LIKE ? ESCAPE '\\'").run(spec.path, spec.like)
  }

  async ingestRoots(roots: string[], workspaceRoot: string): Promise<number> {
    let n = 0
    for (const root of roots) {
      if (!existsSync(root)) continue
      for (const f of walkFiles(root)) {
        try {
          await this.ingestPath(f, workspaceRoot)
          n++
        } catch (err) {
          console.error('rag ingest skipped', f, err)
        }
      }
    }
    return n
  }

  search(query: string, limit = 8): RagHit[] {
    const q = query.trim()
    if (!q) return []
    const fts = q
      .replace(/['"]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .map((w) => `"${w.replace(/"/g, '')}"`)
      .join(' OR ')
    if (!fts) return []
    try {
      const rows = this.db
        .prepare(
          `SELECT d.path, d.kind, d.symbol, snippet(documents_fts, 2, '', '', '…', 24) AS snippet,
                  bm25(documents_fts) AS score
           FROM documents_fts
           JOIN documents d ON d.id = documents_fts.rowid
           WHERE documents_fts MATCH ?
           ORDER BY score
           LIMIT ?`
        )
        .all(fts, limit) as Array<{ path: string; kind: string; symbol: string; snippet: string; score: number }>
      return rows.map((r) => ({
        path: r.path,
        kind: r.kind,
        symbol: r.symbol || undefined,
        snippet: r.snippet,
        score: r.score
      }))
    } catch {
      const like = takeLikeContains(q)
      if (!like) return []
      const rows = this.db
        .prepare(
          "SELECT path, kind, symbol, substr(text,1,240) AS snippet FROM documents WHERE text LIKE ? ESCAPE '\\' LIMIT ?"
        )
        .all(like, limit) as Array<{ path: string; kind: string; symbol: string; snippet: string }>
      return rows.map((r) => ({
        path: r.path,
        kind: r.kind,
        symbol: r.symbol || undefined,
        snippet: r.snippet,
        score: 0
      }))
    }
  }

  watch(roots: string[], workspaceRoot: string): void {
    void this.watcher?.close()
    this.watcher = watch(roots, {
      ignoreInitial: true,
      ignorePermissionErrors: true,
      ignored: (p) => SKIP_DIR.has(p.split(/[\\/]/).pop() ?? '') || p.endsWith('.gguf')
    })
    const on = (p: string) => {
      void this.ingestPath(p, workspaceRoot)
    }
    this.watcher.on('add', on)
    this.watcher.on('change', on)
    this.watcher.on('unlink', (p) => this.removePath(relative(workspaceRoot, p)))
    this.watcher.on('error', (err) => {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
      console.warn('rag watch stopped', code || err)
      void this.watcher?.close()
      this.watcher = null
    })
  }

  addMapNode(node: MapNode): void {
    this.db
      .prepare('INSERT OR REPLACE INTO map_nodes (id, title, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(node.id, node.title, node.kind, node.payload ?? '', node.createdAt)
  }

  addMapEdge(edge: MapEdge): void {
    this.db.prepare('INSERT INTO map_edges (src, dst, rel) VALUES (?, ?, ?)').run(edge.src, edge.dst, edge.rel)
  }

  getMap(): { nodes: MapNode[]; edges: MapEdge[] } {
    const nodes = this.db.prepare('SELECT id, title, kind, payload, created_at as createdAt FROM map_nodes').all() as MapNode[]
    const edges = this.db.prepare('SELECT src, dst, rel FROM map_edges').all() as MapEdge[]
    return { nodes, edges }
  }

  addQa(row: QaRecord): void {
    this.db
      .prepare('INSERT OR REPLACE INTO qa_runs (id, prompt, verdict, notes, trace, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(row.id, row.prompt, row.verdict, row.notes, row.trace, row.createdAt)
  }

  listQa(): QaRecord[] {
    return this.db
      .prepare('SELECT id, prompt, verdict, notes, trace, created_at as createdAt FROM qa_runs ORDER BY created_at DESC LIMIT 100')
      .all() as QaRecord[]
  }

  stats(): { documents: number; lastIngest: number } {
    const row = this.db.prepare('SELECT COUNT(*) as c, MAX(mtime) as last FROM documents').get() as {
      c: number
      last: number | null
    }
    return { documents: row.c || 0, lastIngest: Number(row.last) || 0 }
  }
}

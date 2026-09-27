import ts from 'typescript'
import { existsSync, realpathSync, statSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker, isMainThread } from 'node:worker_threads'

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'])
const MAX_FILES = 5000
const MAX_FILE_BYTES = 2 * 1024 * 1024
const MAX_RESULTS = 500
const MAX_WORKSPACE_FILES = 120
const SKIP_SEGMENTS = new Set([
  'node_modules',
  'AI Resources',
  'Repos',
  'out',
  'dist',
  'vendor',
  '.git',
  'data',
  'release',
  'coverage'
])

function inside(root, candidate) {
  const rel = relative(root, candidate)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function own(raw, key) {
  return Boolean(raw && typeof raw === 'object' && !Array.isArray(raw) && Object.prototype.hasOwnProperty.call(raw, key))
}

function lineColumn(file, offset) {
  const pos = file.getLineAndCharacterOfPosition(Math.max(0, offset))
  return { line: pos.line + 1, column: pos.character + 1 }
}

function textRange(file, span) {
  const start = lineColumn(file, span.start)
  const end = lineColumn(file, span.start + span.length)
  return { startLine: start.line, startColumn: start.column, endLine: end.line, endColumn: end.column }
}

function plainMessage(value) {
  return ts.flattenDiagnosticMessageText(value, '\n').slice(0, 4000)
}

function offsetOf(text, line, column) {
  const rows = String(text).split('\n')
  const row = Math.max(1, Math.min(rows.length, Number(line) || 1)) - 1
  const col = Math.max(1, Number(column) || 1) - 1
  let offset = 0
  for (let i = 0; i < row; i++) offset += rows[i].length + 1
  return Math.min(text.length, offset + Math.min(col, (rows[row] || '').length))
}

export function takeTsQuery(raw) {
  return String(raw ?? '').trim().slice(0, 100)
}

export function tsWorkspaceWorkerPath() {
  const here = dirname(fileURLToPath(import.meta.url))
  const unpack = (path) => path.replaceAll(`${sepAsar}app.asar${sepAsar}`, `${sepAsar}app.asar.unpacked${sepAsar}`)
  const candidates = [join(here, 'workspace-worker.mjs'), join(here, 'ts-intel', 'workspace-worker.mjs')]
  return candidates.map(unpack).find((path) => existsSync(path)) || null
}

const sepAsar = '/'
const WORKSPACE_SYMBOL_MS = 12_000
const TS_CALL_METHODS = new Set([
  'diagnostics',
  'symbols',
  'definitions',
  'references',
  'hover',
  'completions',
  'format'
])

export function takeTsCallMethod(raw) {
  const method = String(raw || '')
  return TS_CALL_METHODS.has(method) ? method : null
}

function callFallback(method) {
  return method === 'hover' ? null : []
}

function publicTsRequest(request) {
  const req = takeTsRequest(request)
  if (!req) return null
  const out = Object.create(null)
  out.path = req.path
  out.line = req.line
  out.column = req.column
  if (typeof req.text === 'string') out.text = req.text
  if (Number.isFinite(req.version)) out.version = req.version
  if (typeof req.newName === 'string') out.newName = req.newName
  return out
}

export function takeTsRequest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  if (!own(raw, 'path') || typeof raw.path !== 'string' || raw.path.includes('\0')) return null
  const path = raw.path.slice(0, 4096)
  if (!path) return null
  const out = Object.create(null)
  out.path = path
  if (own(raw, 'text')) {
    if (typeof raw.text !== 'string') return null
    if (Buffer.byteLength(raw.text, 'utf8') > MAX_FILE_BYTES) return null
    out.text = raw.text
  }
  const line = own(raw, 'line') ? Number(raw.line) : 1
  const column = own(raw, 'column') ? Number(raw.column) : 1
  out.line = Number.isFinite(line) ? Math.max(1, Math.min(1_000_000, Math.floor(line))) : 1
  out.column = Number.isFinite(column) ? Math.max(1, Math.min(1_000_000, Math.floor(column))) : 1
  if (own(raw, 'newName') && typeof raw.newName === 'string') out.newName = raw.newName.slice(0, 200)
  if (own(raw, 'version') && Number.isFinite(raw.version)) out.version = Math.max(0, Math.floor(raw.version))
  return out
}

export function publicTsError(err) {
  return String(err instanceof Error ? err.message : 'TypeScript intelligence failed')
    .replace(/[<>]/g, '')
    .slice(0, 240)
}

export function applyTextEdits(text, edits) {
  const src = String(text ?? '')
  const rows = (Array.isArray(edits) ? edits : [])
    .slice(0, MAX_RESULTS)
    .map((edit) => ({
      start: offsetOf(src, edit?.startLine, edit?.startColumn),
      end: offsetOf(src, edit?.endLine, edit?.endColumn),
      text: String(edit?.text ?? '')
    }))
    .sort((a, b) => b.start - a.start)
  let next = src
  for (const edit of rows) {
    const start = Math.max(0, Math.min(next.length, edit.start))
    const end = Math.max(start, Math.min(next.length, edit.end))
    next = next.slice(0, start) + edit.text + next.slice(end)
  }
  return next
}

export class TsIntelligence {
  constructor(workspace, options = {}) {
    this.root = realpathSync(resolve(String(workspace)))
    this.maxFiles = Math.max(10, Math.min(Number(options.maxFiles) || MAX_FILES, MAX_FILES))
    this.maxFileBytes = Math.max(1024, Math.min(Number(options.maxFileBytes) || MAX_FILE_BYTES, MAX_FILE_BYTES))
    this.overlays = new Map()
    this.projects = new Map()
    this.generation = 0
    this.ticket = 0
    this.worker = null
    this.pending = new Map()
    this.defaultLibDir = dirname(ts.getDefaultLibFilePath({ target: ts.ScriptTarget.ES2022 }))
  }

  setGeneration(seq) {
    const next = Number.isFinite(seq) ? Math.max(0, Math.floor(Number(seq))) : 0
    this.generation = next
    return next
  }

  cancelled(seq) {
    return Number(seq) !== this.generation
  }

  cancel() {
    this.generation += 1
    for (const [seq, job] of this.pending) {
      if (job.kind !== 'workspace') continue
      clearTimeout(job.timer)
      job.resolve([])
      this.pending.delete(seq)
    }
    this.worker?.postMessage({ op: 'cancel', gen: this.generation })
    return this.generation
  }

  skipped(abs) {
    const rel = relative(this.root, abs)
    if (!inside(this.root, abs)) return true
    return rel.split(/[\\/]/).some((seg) => SKIP_SEGMENTS.has(seg))
  }

  jail(raw, mustExist = true) {
    if (typeof raw !== 'string' || raw.includes('\0')) return null
    const candidate = resolve(this.root, raw)
    if (!inside(this.root, candidate)) return null
    if (!mustExist) return candidate
    try {
      const real = realpathSync(candidate)
      return inside(this.root, real) ? real : null
    } catch {
      return null
    }
  }

  update(raw, text, version) {
    const file = this.jail(raw, false)
    if (!file || !SOURCE_EXTS.has(extname(file).toLowerCase()) || typeof text !== 'string') return false
    if (Buffer.byteLength(text, 'utf8') > this.maxFileBytes) return false
    const prior = this.overlays.get(file)
    const nextVersion = Number.isFinite(version) ? Math.max(0, Math.floor(version)) : (prior?.version || 0) + 1
    this.overlays.set(file, { text, version: nextVersion })
    this.worker?.postMessage({ op: 'overlay', path: file, text, version: nextVersion })
    return true
  }

  close(raw) {
    const file = this.jail(raw, false)
    if (file) {
      this.overlays.delete(file)
      this.worker?.postMessage({ op: 'close', path: file })
    }
  }

  snapshotText(raw) {
    const file = this.jail(raw, false)
    if (!file) return null
    const overlay = this.overlays.get(file)
    if (overlay) return overlay.text
    return this.readAllowed(file) ?? null
  }

  projectFor(raw, text) {
    const file = this.jail(raw, text === undefined)
    if (!file || !SOURCE_EXTS.has(extname(file).toLowerCase())) throw new Error('TS file is outside the workspace jail')
    if (typeof text === 'string' && !this.update(file, text)) throw new Error('TS buffer exceeds the workspace limits')
    let at = dirname(file)
    let config = null
    while (inside(this.root, at)) {
      for (const name of ['tsconfig.json', 'jsconfig.json']) {
        const hit = resolve(at, name)
        if (existsSync(hit) && !this.skipped(hit)) {
          config = hit
          break
        }
      }
      if (config || at === this.root) break
      at = dirname(at)
    }
    const key = config || `${this.root}/<inferred>`
    const stamp = config ? statSync(config).mtimeMs : 0
    let project = this.projects.get(key)
    if (!project || project.stamp !== stamp) {
      project?.service.dispose()
      project = this.createProject(config, stamp)
      this.projects.set(key, project)
    }
    if (!project.files.includes(file)) {
      project.files.push(file)
      project.version += 1
    }
    return { project, file }
  }

  createProject(config, stamp) {
    let options = {
      allowJs: true,
      checkJs: false,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022
    }
    let configFiles = []
    if (config) {
      const read = ts.readConfigFile(config, (file) => this.readAllowed(file))
      if (!read.error) {
        const parsed = ts.parseJsonConfigFileContent(
          read.config,
          {
            useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
            readDirectory: (path, extensions, exclude, include, depth) => {
              const jailed = this.jail(path)
              return jailed ? ts.sys.readDirectory(jailed, extensions, exclude, include, Math.min(depth ?? 8, 12)) : []
            },
            fileExists: (path) => Boolean(this.jail(path) && ts.sys.fileExists(path)),
            readFile: (path) => this.readAllowed(path),
            trace: () => undefined,
            directoryExists: (path) => Boolean(this.jail(path) && ts.sys.directoryExists(path)),
            getCurrentDirectory: () => dirname(config),
            onUnRecoverableConfigFileDiagnostic: () => undefined
          },
          dirname(config),
          undefined,
          config
        )
        options = parsed.options
        configFiles = parsed.fileNames.filter((name) => this.jail(name) && !this.skipped(name)).slice(0, this.maxFiles)
      }
    }
    const project = { stamp, files: [], configFiles, options, version: 1, service: null }
    const host = {
      getScriptFileNames: () => [...new Set([...project.files, ...this.overlays.keys()])]
        .filter((name) => this.jail(name, false))
        .slice(0, this.maxFiles),
      getScriptVersion: (name) => {
        const overlay = this.overlays.get(resolve(name))
        if (overlay) return `o${overlay.version}`
        try {
          const stat = statSync(name)
          return `d${stat.mtimeMs}:${stat.size}`
        } catch {
          return 'missing'
        }
      },
      getScriptSnapshot: (name) => {
        const abs = resolve(name)
        const overlay = this.overlays.get(abs)
        if (overlay) return ts.ScriptSnapshot.fromString(overlay.text)
        const text = this.readAllowed(abs)
        return typeof text === 'string' ? ts.ScriptSnapshot.fromString(text) : undefined
      },
      getCurrentDirectory: () => config ? dirname(config) : this.root,
      getCompilationSettings: () => project.options,
      getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
      fileExists: (name) => this.canRead(name) && ts.sys.fileExists(name),
      readFile: (name) => this.readAllowed(name),
      readDirectory: (path, extensions, exclude, include, depth) => {
        const jailed = this.jail(path)
        return jailed ? ts.sys.readDirectory(jailed, extensions, exclude, include, Math.min(depth ?? 8, 12)) : []
      },
      directoryExists: (name) => this.canRead(name) && ts.sys.directoryExists(name),
      getDirectories: (name) => this.jail(name)
        ? ts.sys.getDirectories(name).filter((path) => this.jail(path) && !this.skipped(path))
        : [],
      useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
      getNewLine: () => ts.sys.newLine,
      getProjectVersion: () => `${project.version}:${this.overlays.size}`
    }
    project.service = ts.createLanguageService(host, ts.createDocumentRegistry())
    return project
  }

  canRead(raw) {
    const abs = resolve(String(raw))
    return Boolean(this.jail(abs)) || inside(this.defaultLibDir, abs)
  }

  readAllowed(raw) {
    const abs = resolve(String(raw))
    if (!this.canRead(abs)) return undefined
    try {
      if (statSync(abs).size > this.maxFileBytes) return undefined
      return ts.sys.readFile(abs)
    } catch {
      return undefined
    }
  }

  context(request) {
    const { project, file } = this.projectFor(request.path, request.text)
    const program = project.service.getProgram()
    const source = program?.getSourceFile(file)
    if (!source) throw new Error('TS source is not available')
    const line = Math.max(1, Number(request.line) || 1)
    const column = Math.max(1, Number(request.column) || 1)
    const offset = source.getPositionOfLineAndCharacter(
      Math.min(line - 1, Math.max(0, source.getLineAndCharacterOfPosition(source.end).line)),
      column - 1
    )
    return { service: project.service, source, file, offset }
  }

  diagnostics(request) {
    const { service, source, file } = this.context(request)
    const rows = [
      ...service.getSyntacticDiagnostics(file),
      ...service.getSemanticDiagnostics(file),
      ...service.getSuggestionDiagnostics(file)
    ]
    return rows.slice(0, MAX_RESULTS).map((diag) => ({
      path: file,
      code: diag.code,
      severity: diag.category === ts.DiagnosticCategory.Error ? 'error'
        : diag.category === ts.DiagnosticCategory.Warning ? 'warning'
          : diag.category === ts.DiagnosticCategory.Suggestion ? 'hint' : 'info',
      message: plainMessage(diag.messageText),
      ...textRange(source, { start: diag.start || 0, length: diag.length || 1 })
    }))
  }

  symbols(request) {
    const { service, source, file } = this.context(request)
    const tree = service.getNavigationTree(file)
    const rows = []
    const visit = (item, container = '') => {
      for (const span of item.spans || []) {
        rows.push({ path: file, name: item.text, kind: item.kind, container, ...textRange(source, span) })
        if (rows.length >= MAX_RESULTS) return
      }
      for (const child of item.childItems || []) {
        visit(child, item.text === '<global>' ? container : item.text)
        if (rows.length >= MAX_RESULTS) return
      }
    }
    visit(tree)
    return rows.filter((row) => row.name !== '<global>')
  }

  primeFromConfig() {
    if (this.projects.size) return
    for (const name of ['tsconfig.json', 'jsconfig.json']) {
      const hit = resolve(this.root, name)
      if (!existsSync(hit) || this.skipped(hit) || !this.jail(hit, false)) continue
      const stamp = statSync(hit).mtimeMs
      this.projects.set(hit, this.createProject(hit, stamp))
      return
    }
  }

  workspaceSymbols(query = '', opts = {}) {
    const needle = takeTsQuery(query).toLowerCase()
    const seq = Number.isFinite(opts.seq) ? Math.floor(Number(opts.seq)) : this.generation
    this.primeFromConfig()
    const rows = []
    const files = [...new Set([
      ...[...this.projects.values()].flatMap((project) => [...project.files, ...project.configFiles]),
      ...this.overlays.keys()
    ])].filter((path) => this.jail(path, false) && !this.skipped(path)).slice(0, MAX_WORKSPACE_FILES)
    for (const path of files) {
      if (this.cancelled(seq) || rows.length >= MAX_RESULTS) break
      try {
        for (const row of this.symbols({ path })) {
          if (this.cancelled(seq)) break
          if (!needle || row.name.toLowerCase().includes(needle)) rows.push(row)
          if (rows.length >= MAX_RESULTS) break
        }
      } catch {
        // A deleted or oversized project file cannot poison the index.
      }
    }
    return this.cancelled(seq) ? [] : rows
  }

  ensureWorker() {
    if (this.worker || !isMainThread) return this.worker
    const file = tsWorkspaceWorkerPath()
    if (!file) return null
    try {
      this.worker = new Worker(file, { workerData: { root: this.root } })
      this.worker.on('message', (msg) => {
        if (!msg || typeof msg !== 'object' || Array.isArray(msg) || !own(msg, 'seq')) return
        const job = this.pending.get(msg.seq)
        if (!job) return
        clearTimeout(job.timer)
        this.pending.delete(msg.seq)
        if (job.kind === 'workspace') {
          job.resolve(Array.isArray(msg.rows) && !msg.cancelled ? msg.rows : [])
          return
        }
        job.resolve(own(msg, 'result') ? msg.result : job.fallback)
      })
      this.worker.on('error', () => {
        for (const job of this.pending.values()) {
          clearTimeout(job.timer)
          job.resolve(job.fallback)
        }
        this.pending.clear()
        this.generation += 1
        try {
          this.worker?.terminate()
        } catch {
          /* worker already gone */
        }
        this.worker = null
      })
      for (const [path, overlay] of this.overlays) {
        this.worker.postMessage({ op: 'overlay', path, text: overlay.text, version: overlay.version })
      }
    } catch {
      this.worker = null
    }
    return this.worker
  }

  workspaceSymbolsIsolated(query = '') {
    const needle = takeTsQuery(query)
    if (!isMainThread) return Promise.resolve(this.workspaceSymbols(needle))
    this.cancel()
    const seq = ++this.ticket
    const gen = this.generation
    if (!this.ensureWorker()) return Promise.resolve(this.workspaceSymbols(needle, { seq: gen }))
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.cancel()
      }, WORKSPACE_SYMBOL_MS)
      this.pending.set(seq, { resolve, timer, kind: 'workspace', fallback: [] })
      this.worker.postMessage({ op: 'workspaceSymbols', query: needle, seq, gen })
    })
  }

  callIsolated(method, request) {
    const name = takeTsCallMethod(method)
    const fallback = callFallback(name)
    const req = publicTsRequest(request)
    if (!name || !req) return Promise.resolve(fallback)
    if (!isMainThread) return Promise.resolve(this[name](req))
    if (!this.ensureWorker()) return Promise.resolve(this[name](req))
    const seq = ++this.ticket
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const job = this.pending.get(seq)
        if (!job) return
        this.pending.delete(seq)
        job.resolve(job.fallback)
      }, WORKSPACE_SYMBOL_MS)
      this.pending.set(seq, { resolve, timer, kind: 'call', fallback })
      this.worker.postMessage({ op: 'call', method: name, request: req, seq })
    })
  }

  spans(request, getter) {
    const { service, source, offset } = this.context(request)
    const entries = getter(service, source.fileName, offset) || []
    return entries.slice(0, MAX_RESULTS).flatMap((entry) => {
      const path = this.jail(entry.fileName)
      const target = path && service.getProgram()?.getSourceFile(path)
      return path && target ? [{ path, ...textRange(target, entry.textSpan) }] : []
    })
  }

  definitions(request) {
    return this.spans(request, (service, file, offset) => service.getDefinitionAtPosition(file, offset))
  }

  references(request) {
    return this.spans(request, (service, file, offset) => service.getReferencesAtPosition(file, offset))
  }

  hover(request) {
    const { service, source, offset } = this.context(request)
    const info = service.getQuickInfoAtPosition(source.fileName, offset)
    if (!info) return null
    return {
      kind: info.kind,
      display: ts.displayPartsToString(info.displayParts).slice(0, 8000),
      documentation: ts.displayPartsToString(info.documentation).slice(0, 8000),
      ...textRange(source, info.textSpan)
    }
  }

  completions(request) {
    const { service, source, offset } = this.context(request)
    const result = service.getCompletionsAtPosition(source.fileName, offset, {
      includeCompletionsForModuleExports: true,
      includeInsertTextCompletions: true
    })
    return (result?.entries || []).slice(0, MAX_RESULTS).map((entry) => ({
      label: entry.name,
      kind: entry.kind,
      sortText: entry.sortText,
      insertText: entry.insertText || entry.name,
      source: entry.source
    }))
  }

  format(request) {
    const { service, source } = this.context(request)
    return service.getFormattingEditsForDocument(source.fileName, {
      indentSize: 2,
      tabSize: 2,
      convertTabsToSpaces: true,
      semicolons: ts.SemicolonPreference.Remove,
      newLineCharacter: '\n'
    }).slice(0, MAX_RESULTS).map((edit) => ({
      path: source.fileName,
      text: edit.newText,
      ...textRange(source, edit.span)
    }))
  }

  rename(request) {
    const newName = String(request.newName || '')
    if (!/^[$A-Z_a-z][$\w]*$/.test(newName)) throw new Error('Rename target must be a JavaScript identifier')
    const { service, source, offset } = this.context(request)
    const info = service.getRenameInfo(source.fileName, offset, { allowRenameOfImportPath: false })
    if (!info.canRename) throw new Error(String(info.localizedErrorMessage || 'Symbol cannot be renamed'))
    const entries = service.findRenameLocations(source.fileName, offset, false, false, true) || []
    return entries.slice(0, MAX_RESULTS).flatMap((entry) => {
      const path = this.jail(entry.fileName)
      const target = path && service.getProgram()?.getSourceFile(path)
      return path && target ? [{ path, text: newName, ...textRange(target, entry.textSpan) }] : []
    })
  }

  dispose() {
    this.cancel()
    if (this.worker) {
      try {
        this.worker.postMessage({ op: 'dispose' })
        void this.worker.terminate()
      } catch {
        /* already dead */
      }
      this.worker = null
    }
    for (const project of this.projects.values()) project.service.dispose()
    this.projects.clear()
    this.overlays.clear()
  }
}

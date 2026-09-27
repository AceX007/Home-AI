import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { TsIntelligence, applyTextEdits, takeTsRequest, takeTsCallMethod, tsWorkspaceWorkerPath } from './index.mjs'

const roots = []

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'hex-ts-intel-'))
  roots.push(root)
  writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { strict: true, target: 'ES2022', module: 'ESNext' },
    include: ['*.ts']
  }))
  writeFileSync(join(root, 'math.ts'), 'export const double = (value: number) => value * 2\n')
  writeFileSync(join(root, 'app.ts'), "import { double } from './math'\nconst result: string = double(2)\n")
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('jailed TypeScript intelligence — T-126', () => {
  it('uses project diagnostics and dirty overlays', () => {
    const root = fixture()
    const intel = new TsIntelligence(root)
    const app = join(root, 'app.ts')
    assert.ok(intel.diagnostics({ path: app }).some((row) => row.code === 2322))
    assert.equal(intel.update(app, "import { double } from './math'\nconst result = double(2)\n", 7), true)
    assert.equal(intel.diagnostics({ path: app }).some((row) => row.code === 2322), false)
    intel.dispose()
  })

  it('returns definitions, references, symbols, formatting, and reviewable rename edits', () => {
    const root = fixture()
    const intel = new TsIntelligence(root)
    const app = join(root, 'app.ts')
    const math = join(root, 'math.ts')
    assert.equal(intel.definitions({ path: app, line: 2, column: 24 })[0]?.path, math)
    assert.ok(intel.references({ path: math, line: 1, column: 15 }).length >= 2)
    assert.ok(intel.symbols({ path: math }).some((row) => row.name === 'double'))
    assert.ok(intel.workspaceSymbols('double').some((row) => row.name === 'double'))
    assert.ok(intel.format({ path: math }).length >= 0)
    const edits = intel.rename({ path: math, line: 1, column: 15, newName: 'twice' })
    assert.ok(edits.some((row) => row.path === math))
    assert.ok(edits.some((row) => row.path === app))
    const next = applyTextEdits(intel.snapshotText(math), edits.filter((row) => row.path === math))
    assert.match(next, /twice/)
    intel.dispose()
  })

  it('denies traversal, oversized buffers, invalid rename text, and prototype keys', () => {
    const root = fixture()
    const intel = new TsIntelligence(root, { maxFileBytes: 1024 })
    assert.equal(intel.update('../escape.ts', 'x'), false)
    assert.equal(intel.update(join(root, 'large.ts'), 'x'.repeat(2048)), false)
    assert.equal(takeTsRequest(null), null)
    assert.equal(takeTsRequest({ path: 'ok.ts', text: 'x'.repeat(3 * 1024 * 1024) }), null)
    const inherited = Object.assign(Object.create({ line: 99, admin: true }), { path: join(root, 'app.ts') })
    const req = takeTsRequest(inherited)
    assert.equal(req?.line, 1)
    assert.equal(Object.prototype.admin, undefined)
    assert.throws(() => intel.diagnostics({ path: '/etc/passwd' }), /workspace jail/)
    assert.throws(
      () => intel.rename({ path: join(root, 'math.ts'), line: 1, column: 15, newName: 'x;process.exit()' }),
      /identifier/
    )
    intel.dispose()
  })

  it('survives broken tsconfig and does not index skipped trees as roots', () => {
    const root = fixture()
    mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true })
    writeFileSync(join(root, 'node_modules', 'pkg', 'index.ts'), 'export const secret = 1\n')
    mkdirSync(join(root, 'broken'), { recursive: true })
    writeFileSync(join(root, 'broken', 'tsconfig.json'), '{ not json')
    writeFileSync(join(root, 'broken', 'ok.ts'), 'export const ok = 1\n')
    const intel = new TsIntelligence(root)
    assert.equal(Array.isArray(intel.diagnostics({ path: join(root, 'broken', 'ok.ts') })), true)
    const hits = intel.workspaceSymbols('secret')
    assert.equal(hits.some((row) => row.path.includes('node_modules')), false)
    intel.dispose()
  })
})

describe('workspace-wide TS isolation — T-131', () => {
  it('cancels a stale generation and answers from a worker_threads host', { timeout: 20_000 }, async () => {
    const root = fixture()
    const intel = new TsIntelligence(root)
    try {
      assert.ok(intel.workspaceSymbols('double').some((row) => row.name === 'double'))
      const stale = intel.generation
      intel.cancel()
      assert.equal(intel.workspaceSymbols('double', { seq: stale }).length, 0)
      const workerFile = tsWorkspaceWorkerPath()
      assert.ok(workerFile)
      const workerSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'workspace-worker.mjs'), 'utf8')
      assert.match(workerSrc, /workerData/)
      assert.match(workerSrc, /takeTsQuery/)
      assert.equal(workerSrc.includes('electron'), false)
      assert.equal(workerSrc.includes('node-pty'), false)
      assert.equal(workerSrc.includes('0.0.0.0'), false)
      const isolated = await intel.workspaceSymbolsIsolated('double')
      assert.ok(isolated.some((row) => row.name === 'double'))
      assert.equal(takeTsCallMethod('diagnostics'), 'diagnostics')
      assert.equal(takeTsCallMethod('rename'), null)
      assert.equal(takeTsCallMethod('__proto__'), null)
      const app = join(root, 'app.ts')
      const rows = await intel.callIsolated('diagnostics', { path: app })
      assert.ok(Array.isArray(rows) && rows.some((row) => row.code === 2322))
      intel.cancel()
      const still = await intel.callIsolated('diagnostics', { path: app })
      assert.ok(Array.isArray(still) && still.some((row) => row.code === 2322))
    } finally {
      intel.dispose()
    }
  })
})

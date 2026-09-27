import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

const SOURCE_EXTS = ['', '.ts', '.tsx', '.mjs', '.js']

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name)
    return statSync(abs).isDirectory() ? sourceFiles(abs) : [abs]
  }).filter((abs) => ['.ts', '.tsx', '.mjs', '.js'].includes(extname(abs)))
}

function resolveImport(from, spec) {
  let base = ''
  if (spec === '@homeai/runtime/browser') base = join(root, 'packages/runtime/src/browser.mjs')
  else if (spec === '@homeai/debug') base = join(root, 'packages/debug/src/renderer-import-denied.mjs')
  else if (spec === '@homeai/ts-intel') base = join(root, 'packages/ts-intel/src/renderer-import-denied.mjs')
  else if (spec.startsWith('@/')) base = join(root, 'apps/renderer/src', spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec)
  else return null
  for (const ext of SOURCE_EXTS) {
    const candidate = `${base}${ext}`
    if (existsSync(candidate) && !statSync(candidate).isDirectory()) return candidate
  }
  for (const ext of ['.ts', '.tsx', '.mjs', '.js']) {
    const candidate = join(base, `index${ext}`)
    if (existsSync(candidate)) return candidate
  }
  return null
}

describe('electron ESM boot', () => {
  it('createWindow resolves preload from import.meta.url, not __dirname', () => {
    const src = readFileSync(join(root, 'apps/desktop/src/main/index.ts'), 'utf8')
    assert.equal(src.includes('join(__dirname'), false)
    const html = readFileSync(join(root, 'apps/renderer/index.html'), 'utf8')
    assert.match(html, /Hex AI Workbench/)
    assert.equal(html.includes('Home AI Workbench'), false)
    assert.match(src, /title: 'Hex AI Workbench'/)
    assert.match(src, /fileURLToPath\(import\.meta\.url\)/)
    assert.match(src, /join\(mainDir, '\.\.\/preload\/index\.js'\)/)
    const fromFile = dirname(fileURLToPath('file:///tmp/out/main/index.js'))
    assert.equal(join(fromFile, '../preload/index.js'), '/tmp/out/preload/index.js')
  })

  it('sandboxed renderer loads CJS preload, not ESM import — T-112', () => {
    const src = readFileSync(join(root, 'apps/desktop/src/main/index.ts'), 'utf8')
    const cfg = readFileSync(join(root, 'electron.vite.config.ts'), 'utf8')
    assert.match(cfg, /formats:\s*\[['"]cjs['"]\]/)
    assert.match(cfg, /entryFileNames:\s*['"]index\.js['"]/)
    assert.match(src, /join\(mainDir, '\.\.\/preload\/index\.js'\)/)
    assert.equal(src.includes('../preload/index.mjs'), false)
    assert.match(src, /sandbox:\s*true/)
    assert.equal(/sandbox:\s*false/.test(src), false)
  })

  it('vite watch ignores bulky trees and keeps renderer off 5173', () => {
    const cfg = readFileSync(join(root, 'electron.vite.config.ts'), 'utf8')
    for (const bit of ['AI Resources', 'Repos', 'RAG', 'data', 'vendor', 'port: 5175']) {
      assert.ok(cfg.includes(bit), `missing ${bit}`)
    }
    assert.match(cfg, /fileURLToPath\(import\.meta\.url\)/)
    assert.equal(cfg.includes('resolve(__dirname)'), false)
    assert.match(cfg, /main:[\s\S]*watch:\s*buildWatch/)
    assert.match(cfg, /preload:[\s\S]*watch:\s*buildWatch/)
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    assert.equal(pkg.productName, 'Hex AI Workbench')
    assert.match(pkg.scripts.ide, /electron-vite build/)
    assert.match(pkg.scripts.ide, /electron \./)
    assert.equal(cfg.includes('@homeai/runtime'), true)
    assert.match(cfg, /rendererAliases/)
    assert.match(cfg, /@homeai\/runtime\/browser/)
    assert.match(cfg, /renderer-import-denied\.mjs/)
  })

  it('renderer panes do not import Node runtime barrels', () => {
    const panes = [
      'apps/renderer/src/panes/SettingsPane.tsx',
      'apps/renderer/src/panes/ChatPane.tsx',
      'apps/renderer/src/panes/StageTrustRow.tsx'
    ]
    const blob = panes.map((p) => readFileSync(join(root, p), 'utf8')).join('\n')
    assert.equal(blob.includes('auto-review.mjs'), false)
    assert.equal(blob.includes('mcp-packs.mjs'), false)
    assert.equal(blob.includes('policy.mjs'), false)
    assert.ok(blob.includes('@homeai/runtime/browser'))
    const shell = readFileSync(join(root, 'apps/renderer/src/layout/WorkbenchShell.tsx'), 'utf8')
    assert.equal(shell.includes('workbench-chrome.mjs'), false)
    assert.match(shell, /@homeai\/runtime\/browser/)
  })

  it('renderer transitive imports stay browser-safe — T-125', () => {
    const queue = sourceFiles(join(root, 'apps/renderer/src'))
    const seen = new Set()
    const denied = /^(node:)|(?:^|\/)(?:policy|mcp-packs)\.mjs$/
    while (queue.length) {
      const file = queue.pop()
      if (!file || seen.has(file)) continue
      seen.add(file)
      const src = readFileSync(file, 'utf8')
      const specs = [...src.matchAll(/(?:from\s*|import\s*\()['"]([^'"]+)['"]/g)].map((m) => m[1])
      for (const spec of specs) {
        assert.equal(denied.test(spec), false, `${file} reaches denied ${spec}`)
        assert.notEqual(spec, '@homeai/runtime', `${file} reaches full runtime barrel`)
        const next = resolveImport(file, spec)
        if (next) queue.push(next)
      }
    }
    assert.ok(seen.has(join(root, 'packages/runtime/src/browser.mjs')))
    assert.ok(seen.has(join(root, 'packages/runtime/src/outcome-route.mjs')))
    for (const file of seen) {
      if (!file.startsWith(join(root, 'apps/renderer/src'))) continue
      const src = readFileSync(file, 'utf8')
      const hits = [...src.matchAll(/^import\s+(.+)\s+from\s*['"]@homeai\/ts-intel['"]/gm)]
      for (const hit of hits) {
        assert.match(String(hit[1]), /^type\b/, `${file} value-imports TypeScript intelligence`)
      }
      const debugHits = [...src.matchAll(/^import\s+(.+)\s+from\s*['"]@homeai\/debug['"]/gm)]
      for (const hit of debugHits) {
        assert.match(String(hit[1]), /^type\b/, `${file} value-imports Node Inspector`)
      }
    }
  })

  it('TypeScript IPC jails payloads and rename uses checkpoints — T-127', () => {
    const main = readFileSync(join(root, 'apps/desktop/src/main/index.ts'), 'utf8')
    const lang = readFileSync(join(root, 'apps/renderer/src/lib/tsLanguage.ts'), 'utf8')
    const cfg = readFileSync(join(root, 'electron.vite.config.ts'), 'utf8')
    const tools = readFileSync(join(root, 'apps/desktop/src/main/tools.ts'), 'utf8')
    const preload = readFileSync(join(root, 'apps/desktop/src/preload/index.ts'), 'utf8')
    const goto = readFileSync(join(root, 'apps/renderer/src/layout/GotoSymbol.tsx'), 'utf8')
    assert.match(main, /takeTsRequest/)
    assert.match(main, /commitTsEdits/)
    assert.match(main, /typeof req\.text !== 'string'/)
    assert.equal(main.includes("req.text || ''"), false)
    assert.match(main, /writeFileSafe\(workspace \|\| root\(\), path, after\)/)
    assert.match(main, /changes\.record\(path, before, after, 'inline'\)/)
    assert.equal(main.includes("languageIntel().rename(payload)"), false)
    assert.match(main, /workspaceSymbolsIsolated/)
    assert.match(main, /callIsolated/)
    assert.match(main, /homeai:ts:cancel/)
    assert.match(preload, /homeai:ts:cancel/)
    assert.match(goto, /tsCancel/)
    assert.match(lang, /registerEditorOpener/)
    assert.match(lang, /refreshPending/)
    assert.match(cfg, /ts-intel\/src\/renderer-import-denied\.mjs/)
    assert.match(cfg, /copy-ts-intel-worker/)
    assert.match(tools, /host\.tsIntel\??\.references/)
    assert.match(tools, /lspQuery\(/)
  })

  it('Node Inspector IPC is jailed child_process, not PTY — T-129', () => {
    const main = readFileSync(join(root, 'apps/desktop/src/main/index.ts'), 'utf8')
    const host = readFileSync(join(root, 'packages/debug/src/index.mjs'), 'utf8')
    const tools = readFileSync(join(root, 'apps/desktop/src/main/tools.ts'), 'utf8')
    const cfg = readFileSync(join(root, 'electron.vite.config.ts'), 'utf8')
    const editor = readFileSync(join(root, 'apps/renderer/src/panes/EditorPane.tsx'), 'utf8')
    const git = readFileSync(join(root, 'packages/runtime/src/git.ts'), 'utf8')
    assert.match(main, /takeDebugLaunch/)
    assert.match(main, /homeai:debug:start/)
    assert.match(main, /gitLineChanges/)
    assert.match(host, /from 'node:child_process'/)
    assert.equal(host.includes('node-pty'), false)
    assert.equal(host.includes('pty-host'), false)
    assert.match(host, /inspect-brk=127\.0\.0\.1/)
    assert.match(tools, /host\.debug\.start/)
    assert.match(cfg, /debug\/src\/renderer-import-denied\.mjs/)
    assert.match(editor, /glyphMargin: true/)
    assert.match(editor, /KeyMod\.Shift/)
    assert.match(git, /gitPathspecs\(root, \[path\]\)/)
  })

  it('rag watch closes on EMFILE and does not watch mods', () => {
    const rag = readFileSync(join(root, 'packages/rag/src/index.ts'), 'utf8')
    assert.match(rag, /watcher\.on\('error'/)
    const main = readFileSync(join(root, 'apps/desktop/src/main/index.ts'), 'utf8')
    assert.match(
      main,
      /rag\.watch\(\[join\(r, 'RAG'\), join\(r, 'notes'\), join\(r, 'qa'\), join\(r, 'data', 'bug-memory'\)\]/
    )
    assert.equal(main.includes("join(r, 'mods')], r)"), false)
    assert.equal(main.includes("join(r, 'data', 'secrets')"), false)
  })
})

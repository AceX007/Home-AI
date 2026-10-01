import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  compileGrepRe,
  countTableStatus,
  parseLibraryStatus,
  parseRuleAlwaysApply,
  publicGrepHits,
  ragWriteRel,
  skipSkillFile,
  takeGrepQuery,
  takeHitRel,
  takeLikeContains,
  wikiNoteRel
} from './search-proof.mjs'
import { matchGlob } from './glob-match.mjs'
import { kindFromPath } from './kind-path.mjs'
import { takeRagRemoveSpec } from '../../rag/src/remove-spec.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..', '..')

describe('search and proof jails', () => {
  it('T-03 skipSkillFile drops reference and AGENT_SNIPPET', () => {
    assert.equal(skipSkillFile('mods/x/skills/foo/reference/note.md'), true)
    assert.equal(skipSkillFile('mods/x/skills/foo/AGENT_SNIPPET.md'), true)
    assert.equal(skipSkillFile('mods/x/skills/foo/scripts/run.sh'), true)
    assert.equal(skipSkillFile('mods/x/skills/foo/assets/icon.png'), true)
    assert.equal(skipSkillFile('mods/x/skills/foo/SKILL.md'), false)
  })

  it('T-04 kindFromPath maps RAG/library to library', () => {
    assert.equal(kindFromPath('RAG/library/STATUS.md'), 'library')
    assert.equal(kindFromPath('/tmp/ws/RAG/library/TESTS.md'), 'library')
    assert.equal(kindFromPath('RAG/recipes/ipc-workspace-fs.md'), 'recipe')
    assert.equal(kindFromPath('../secrets'), 'doc')
  })

  it('T-06 explore-first rule is alwaysApply', () => {
    const md = readFileSync(join(repo, 'mods/kernel/rules/explore-first.md'), 'utf8')
    assert.equal(parseRuleAlwaysApply(md), true)
    assert.match(md, /alwaysApply:\s*true/)
  })

  it('T-05 recipe-refine treats a missing recipe log as incomplete', () => {
    const skill = readFileSync(join(repo, '.cursor/skills/recipe-refine/SKILL.md'), 'utf8')
    assert.match(skill, /incomplete/i)
    assert.match(skill, /recipe/i)
    const index = readFileSync(join(repo, 'RAG/recipes/INDEX.md'), 'utf8')
    assert.match(index, /ipc-workspace-fs/)
  })

  it('T-08 parseLibraryStatus reads the STATUS contract', () => {
    const md = readFileSync(join(repo, 'RAG/library/STATUS.md'), 'utf8')
    const m = parseLibraryStatus(md)
    assert.ok(m.features > 0)
    assert.ok(m.testsRequired >= m.testsDone)
    assert.ok(m.edgesTracked >= m.edgesTested)
    const store = readFileSync(join(repo, 'apps/renderer/src/store/useWorkbench.ts'), 'utf8')
    assert.match(store, /homeai\.read\(`\$\{root\}\/RAG\/library\/\$\{name\}`\)/)
    assert.match(store, /libraryDocs\['STATUS\.md'\]/)
  })

  it('T-07 count-status.sh meters match TESTS and EDGES tables', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'homeai-lib-'))
    try {
      mkdirSync(join(tmp, 'RAG', 'library', 'features'), { recursive: true })
      cpSync(join(repo, 'RAG/library/TESTS.md'), join(tmp, 'RAG/library/TESTS.md'))
      cpSync(join(repo, 'RAG/library/EDGES.md'), join(tmp, 'RAG/library/EDGES.md'))
      cpSync(join(repo, 'RAG/library/features'), join(tmp, 'RAG/library/features'), { recursive: true })
      writeFileSync(
        join(tmp, 'RAG/library/STATUS.md'),
        '# Status\n- Phase: 0/5 — x\n- Features: documented 0\n- Tests: done 0 / required 0\n- Edges: tested 0 / tracked 0\n- Updated: 1970-01-01\n',
        'utf8'
      )
      execFileSync('bash', [join(repo, '.cursor/skills/repo-library/scripts/count-status.sh'), tmp])
      const meters = parseLibraryStatus(readFileSync(join(tmp, 'RAG/library/STATUS.md'), 'utf8'))
      const tests = readFileSync(join(tmp, 'RAG/library/TESTS.md'), 'utf8')
      const edges = readFileSync(join(tmp, 'RAG/library/EDGES.md'), 'utf8')
      const done = countTableStatus(tests, 'done')
      const required = countTableStatus(tests, 'required') + countTableStatus(tests, 'missing') + done
      const tested = countTableStatus(edges, 'tested')
      const tracked = countTableStatus(edges, 'tested') + countTableStatus(edges, 'tracked') + countTableStatus(edges, 'wont')
      assert.equal(meters.testsDone, done)
      assert.equal(meters.testsRequired, required)
      assert.equal(meters.edgesTested, tested)
      assert.equal(meters.edgesTracked, tracked)
      assert.ok(meters.features > 0)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('T-83 countTableStatus uses exact status cells when prove text has pipes', () => {
    const md = [
      '# Tests',
      '| id | proves | feature | status | path |',
      '|----|--------|---------|--------|------|',
      '| T-x | chromeRoute exclusive design|cowork|code; clamp | activity-groups | done | `a.mjs` |'
    ].join('\n')
    assert.equal(countTableStatus(md, 'done'), 1)
    assert.equal(countTableStatus(md, 'required'), 0)
    assert.equal(countTableStatus(md, 'cowork'), 0)
  })

  it('grep query and hits are jailed text', () => {
    assert.equal(takeGrepQuery('foo\nbar'), null)
    assert.equal(takeGrepQuery(''), null)
    assert.equal(takeGrepQuery('auth'), 'auth')
    assert.equal(compileGrepRe('(unclosed') instanceof RegExp, true)
    const hits = publicGrepHits(['apps/x.ts:12:hello <img>', '../etc:1:x', '/etc/passwd:1:x'])
    assert.equal(hits.length, 1)
    assert.equal(hits[0].path, 'apps/x.ts')
    assert.equal(hits[0].text.includes('<'), false)
    assert.equal(takeHitRel('/tmp/ws/apps/a.ts', '/tmp/ws'), 'apps/a.ts')
    assert.equal(takeHitRel('../secret', '/tmp/ws'), null)
    assert.equal(ragWriteRel('plans', 'ship'), 'RAG/plans/ship.md')
  })

  it('T-135 rag delete drops one path and its chunks, not a prefix', () => {
    const spec = takeRagRemoveSpec('notes/a_b.md')
    assert.ok(spec)
    assert.equal(spec.path, 'notes/a_b.md')
    assert.equal(spec.like, 'notes/a\\_b.md#chunk:%')
    assert.equal(takeRagRemoveSpec('../secrets'), null)
    assert.equal(takeRagRemoveSpec(''), null)
    const rag = readFileSync(join(repo, 'packages/rag/src/index.ts'), 'utf8')
    assert.match(rag, /takeRagRemoveSpec/)
    assert.equal(rag.includes('${filePath}%'), false)
    assert.equal(takeLikeContains('100%_done'), '%100\\%\\_done%')
    assert.equal(takeLikeContains(''), null)
    assert.equal(matchGlob('notes/a.md', '*.md'), false)
    assert.equal(matchGlob('a.md', '*.md'), true)
    assert.equal(matchGlob('a.md.bak', '*.md'), false)
    assert.equal(matchGlob('apps/a.ts', '**/*.ts'), true)
    assert.equal(matchGlob('apps/b/c.ts', 'apps/**/*.ts'), true)
    assert.equal(matchGlob('apps/a.ts.bak', '**/*.ts'), false)
    const rules = readFileSync(join(repo, 'packages/runtime/src/context.ts'), 'utf8')
    assert.match(rules, /matchGlob/)
    assert.equal(rules.includes('new RegExp(re).test(path)'), false)
    assert.equal(wikiNoteRel('other note'), 'notes/other-note.md')
    assert.equal(wikiNoteRel('Other Note'), 'notes/other-note.md')
    assert.equal(wikiNoteRel('../x'), '')
    const chat = readFileSync(join(repo, 'apps/renderer/src/panes/ChatPane.tsx'), 'utf8')
    assert.match(chat, /effortLine\(effort\)/)
    assert.match(chat, /profileSet\(\{ defaultProvider: mind \}\)/)
    const term = readFileSync(join(repo, 'apps/renderer/src/panes/TerminalPane.tsx'), 'utf8')
    assert.equal((term.match(/setActivity\('qa'/g) || []).length, 1)
    assert.match(term, /setActivity\('qa'\)[\s\S]{0,160}Open Debug pane/)
    const store = readFileSync(join(repo, 'apps/renderer/src/store/useWorkbench.ts'), 'utf8')
    assert.match(store, /threadDelete/)
    assert.match(store, /threadArchive/)
    assert.equal(store.includes('chat-${nid()}'), false)
    assert.match(store, /cycleProvider:[\s\S]{0,280}profileSet/)
    assert.match(store, /activity === 'notes' && st\.notePath/)
  })
})

describe('T-02 fs IPC uses safe helpers', () => {
  it('homeai:fs:read calls readFileSafe and writes use writeFileSafe', () => {
    const src = readFileSync(join(repo, 'apps/desktop/src/main/index.ts'), 'utf8')
    assert.match(src, /ipcMain\.handle\('homeai:fs:read'[\s\S]{0,80}readFileSafe/)
    assert.match(src, /ipcMain\.handle\('homeai:fs:write'[\s\S]{0,120}writeFileSafe/)
    assert.equal(/ipcMain\.handle\('homeai:fs:read'[\s\S]{0,80}readFileSync/.test(src), false)
    const tools = readFileSync(join(repo, 'apps/desktop/src/main/tools.ts'), 'utf8')
    assert.match(tools, /case 'web_search':[\s\S]{0,240}assertAgentUrl/)
    const handles = [...src.matchAll(/ipcMain\.handle\('(homeai:fs:[^']+)'/g)].map((m) => m[1])
    assert.deepEqual(
      handles.filter((h) => h.startsWith('homeai:fs:') && !h.includes('quickOpen') && !h.includes('openFolder')),
      ['homeai:fs:list', 'homeai:fs:read', 'homeai:fs:write', 'homeai:fs:mkdir', 'homeai:fs:rename', 'homeai:fs:remove']
    )
  })
})

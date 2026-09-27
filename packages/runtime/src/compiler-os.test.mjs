import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  bugMemoryDirName,
  ragIngestAllowed,
  needsPerceivePack,
  composePerceivePack,
  promoteDiscovery,
  promoteRel,
  starterTrustRules,
  mergeStarterAllowlist,
  designThinkMarkdown,
  registerKernelRun,
  stopKernelRun,
  kernelRunOwner,
  resetKernelRuns,
  kernelSurface,
  kernelRunCount,
  freezeToolList,
  filterFrozenTools,
  parseStructuralIndex,
  impactBeforeEdit,
  curateSkillProposal,
  takeHarness,
  mintHarness,
  buildStructuralGraph,
  takeStructuralGraph,
  queryGraph,
  graphRel,
  lspQuery,
  takeDapEvidence,
  dapEvidenceRel,
  gitImpactHunks,
  chromeDevtoolsDepth,
  designMeshRoute,
  sceneIrJail,
  acpWorktreeName,
  hitlStep,
  gatewayContinuity,
  dnaPlanFromRecipes,
  takeRecipeMeta,
  takeRecipeMechanism,
  takeRecipePorts,
  dnaAppRel,
  dnaIrRel,
  dnaCliRel,
  dnaApiRel,
  dnaDesktopRel,
  dnaArtifactAllowed,
  takeCapabilityIr,
  validateCapabilityIr,
  compileCapabilityIr,
  emitWebStatic,
  emitCliRunner,
  takeComposeRequest,
  composeCapabilityResult,
  emitApiLoopback,
  emitDesktopShell,
  dnaScaffoldFromRecipes,
  designFidelityReport,
  outcomeRoute,
  harvestPortKind,
  compilerOsHarvestIds,
  sessionHits,
  meshKind,
  fleetReceiptLine,
  bootCurate,
  scanDiscoveryDrafts,
  mergeGraphHits
} from './compiler-os.mjs'
import { kindFromPath } from './kind-path.mjs'
import { harvestRow, starterForbidden } from './resource-harvest.mjs'
import { instructionAuthorization } from './auto-review.mjs'
import { takeWorkflow, splitWorkflowPhases, workflowPhaseLine } from './activity.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('compiler-os wave A–D', () => {
  it('T-116 perceive pack, AP kind jail, promote ask, starter trust, design think, one Stop', () => {
    assert.equal(bugMemoryDirName(), 'bug-memory')
    assert.equal(ragIngestAllowed('data/bug-memory/anti-patterns.md'), true)
    assert.equal(ragIngestAllowed('data/secrets/openai'), false)
    assert.equal(ragIngestAllowed('data/permissions.json'), false)
    assert.equal(ragIngestAllowed('../etc/passwd'), false)
    assert.equal(kindFromPath('data/bug-memory/anti-patterns.md'), 'anti-pattern')
    assert.equal(kindFromPath('/tmp/ws/data/bug-memory/anti-patterns.md'), 'anti-pattern')
    assert.equal(needsPerceivePack('think'), true)
    assert.equal(needsPerceivePack('agent'), true)
    assert.equal(needsPerceivePack('debug'), true)
    assert.equal(needsPerceivePack('ask'), false)
    const pack = composePerceivePack({
      library: 'STATUS',
      git: 'main',
      ragHits: [{ path: 'data/bug-memory/anti-patterns.md', kind: 'anti-pattern', snippet: 'IPC jail' }],
      mapNodes: [{ title: 'sess_1' }],
      qa: [{ verdict: 'fail', prompt: 'login' }],
      graphHits: [{ symbol: 'runForge' }]
    })
    assert.match(pack, /PERCEIVE PACK/)
    assert.match(pack, /anti-pattern/)
    assert.match(pack, /sess_1/)
    assert.match(pack, /login/)
    assert.match(pack, /runForge/)
    assert.match(pack, /## Session/)
    assert.match(pack, /## Fleet/)
    assert.match(pack, /## Debug/)
    assert.equal(pack.includes('<script>'), false)
    const promo = promoteDiscovery({
      task: 'jail path traversal',
      tools: ['explore', 'str_replace'],
      text: 'path jail worked',
      stamp: '2026-09-05T00-00-00'
    })
    assert.equal(promo.apply, false)
    assert.equal(promo.kind, 'anti-pattern')
    assert.equal(promo.rel, promoteRel('2026-09-05T00-00-00'))
    assert.match(promo.rel, /^RAG\/discoveries\//)
    assert.equal(promo.rel.includes('..'), false)
    const rules = starterTrustRules(['codebase-memory', 'desktop-commander', 'gitmcp.io'])
    assert.deepEqual(rules, ['codebase-memory:*'])
    for (const bad of starterForbidden()) {
      assert.equal(rules.join(' ').toLowerCase().includes(String(bad).toLowerCase()), false)
    }
    const merged = mergeStarterAllowlist(['chrome-devtools:*'], ['codebase-memory', 'blender'])
    assert.ok(merged.includes('codebase-memory:*'))
    assert.ok(merged.includes('chrome-devtools:*'))
    const think = designThinkMarkdown({ slug: 'pitch', title: 'Pitch deck' })
    assert.equal(think.ok, true)
    assert.equal(think.rel.endsWith('.think.md'), true)
    assert.match(think.markdown, /designs\/pitch\.design\.json/)
    assert.equal(think.markdown.includes('<'), false)
    resetKernelRuns()
    let n = 0
    const id = registerKernelRun('run1', 'telegram', () => {
      n += 1
    })
    assert.equal(kernelRunOwner('run1'), 'telegram')
    assert.equal(stopKernelRun(id), true)
    assert.equal(n, 1)
    assert.equal(kernelRunOwner('run1'), '')
    assert.equal(stopKernelRun('missing'), false)
    const settings = readFileSync(join(repo, 'apps/renderer/src/panes/SettingsPane.tsx'), 'utf8')
    assert.match(settings, /Trust starter MCP/)
    const agent = readFileSync(join(repo, 'packages/agent/src/index.ts'), 'utf8')
    assert.match(agent, /promoteDiscovery/)
    assert.match(agent, /curateSkillProposal/)
    const tools = readFileSync(join(repo, 'apps/desktop/src/main/tools.ts'), 'utf8')
    assert.match(tools, /composePerceivePack/)
    assert.match(tools, /sceneIrJail/)
    assert.match(tools, /dnaScaffoldFromRecipes/)
    assert.match(tools, /GRAPH_ROOTS/)
    assert.match(tools, /queryGraph/)
    const ragSrc = readFileSync(join(repo, 'packages/rag/src/index.ts'), 'utf8')
    assert.match(ragSrc, /join\(root, name, bugMemoryDirName\(\)\)/)
    const gitSrc = readFileSync(join(repo, 'packages/runtime/src/git.ts'), 'utf8')
    assert.match(gitSrc, /acpWorktreeName/)
    assert.equal(kernelSurface('miniapp'), 'miniapp')
    assert.equal(kernelSurface('../x'), 'desktop')
    resetKernelRuns()
    registerKernelRun('r2', 'miniapp', () => {})
    assert.equal(kernelRunOwner('r2'), 'miniapp')
    assert.equal(kernelRunCount(), 1)
    const host = readFileSync(join(repo, 'apps/desktop/src/main/index.ts'), 'utf8')
    assert.match(host, /filterFrozenTools/)
    assert.match(host, /kernelSurface/)
    assert.match(host, /verifyOk: lastVerifyOk/)
    assert.match(host, /persistOutcomeHarness/)
    assert.match(host, /refreshWorkspaceGraph/)
    const mini = readFileSync(join(repo, 'apps/desktop/src/main/miniapp-server.ts'), 'utf8')
    assert.match(mini, /surface: 'miniapp'/)
  })

  it('T-117 freeze tools, impact before edit, curator ask, harness own-key', () => {
    const frozen = freezeToolList([{ name: 'explore' }, { name: 'str_replace' }, { name: '__proto__' }])
    assert.deepEqual([...frozen.names], ['explore', 'str_replace'])
    const extra = filterFrozenTools(frozen, [{ name: 'explore' }, { name: 'terminal_run' }])
    assert.equal(extra.length, 1)
    assert.equal(extra[0].name, 'explore')
    const idx = parseStructuralIndex(
      'import { x } from "./peer.js"\nexport function runForge() {}\nexport function packContext() {}\n',
      'packages/agent/src/index.ts'
    )
    assert.ok(idx.symbols.includes('runForge'))
    assert.ok(idx.imports.includes('./peer.js'))
    assert.equal(parseStructuralIndex('x', '../secrets').path, '')
    const impact = impactBeforeEdit(
      { nodes: [{ path: 'packages/agent/src/index.ts', callers: ['a', 'b', 'c', 'd'] }] },
      'packages/agent/src/index.ts'
    )
    assert.equal(impact.warn, true)
    assert.equal(impact.fanIn, 4)
    const skip = curateSkillProposal({ discoveries: ['ok'], existing: [] })
    assert.equal(skip.apply, false)
    const learned = curateSkillProposal({
      discoveries: ['verify ok', 'prevent shipped'],
      task: 'session memory',
      existing: []
    })
    assert.equal(learned.apply, false)
    assert.ok(learned.slug)
    const proto = takeHarness(JSON.parse('{"stack":"electron","__proto__":{"evolve":true}}'))
    assert.equal(proto.evolve, undefined)
    assert.equal(proto.stack, 'electron')
    const minted = mintHarness({ stack: 'electron' }, { evolve: true, approvalMode: 'allowlist' })
    assert.equal(minted.rel, '.homeai/harness.json')
    assert.equal(minted.evolve, false)
    const gated = mintHarness({ stack: 'electron' }, { evolve: true, approvalMode: 'auto-review' })
    assert.equal(gated.evolve, true)
    const protoV = takeHarness(JSON.parse('{"stack":"electron","__proto__":{"verifyOk":false,"hasSidecar":true}}'))
    assert.equal(protoV.verifyOk, undefined)
    assert.equal(protoV.hasSidecar, undefined)
    const flagged = mintHarness({ stack: 'electron' }, { verifyOk: false, localOk: true, hasSidecar: true })
    assert.equal(flagged.harness.verifyOk, false)
    assert.equal(flagged.harness.localOk, true)
    assert.equal(flagged.harness.hasSidecar, true)
    assert.equal(minted.harness.verifyOk, undefined)
    const graph = buildStructuralGraph([
      { path: 'packages/a.ts', text: 'import { packContext } from "./peer.js"\nexport function runForge() {}\n' },
      { path: 'packages/peer.js', text: 'export function packContext() {}\n' },
      { path: 'AI Resources/stolen.ts', text: 'export function stolen() {}\n' }
    ])
    assert.equal(graphRel(), '.homeai/graph.json')
    const peer = graph.nodes.find((n) => n.path === 'packages/peer.js')
    assert.ok(peer?.callers.includes('packages/a.ts'))
    assert.equal(graph.nodes.some((n) => String(n.path).includes('AI Resources')), false)
    const hits = queryGraph(graph, 'packContext')
    assert.ok(hits.some((h) => h.path === 'packages/peer.js' && h.callers.includes('packages/a.ts')))
    assert.equal(queryGraph(graph, '../etc').length, 0)
    assert.equal(takeStructuralGraph({ nodes: [{ path: '../secrets', symbols: ['x'] }] }).nodes.length, 0)
    const protoG = takeStructuralGraph(JSON.parse('{"__proto__":{"nodes":[{"path":"packages/stolen.ts","symbols":["x"]}]}}'))
    assert.equal(protoG.nodes.length, 0)
    assert.ok(sessionHits([{ kind: 'conversation' }, { kind: 'doc' }]).length === 1)
    assert.deepEqual(scanDiscoveryDrafts(['a.promote.md', '../x.promote.md', 'boot.skill.md']), ['a.promote.md', 'boot.skill.md'])
    const overnight = bootCurate(['a.promote.md', 'b.promote.md'], [])
    assert.equal(overnight.apply, false)
    assert.ok(overnight.slug)
    assert.equal(bootCurate(['a.promote.md', 'b.promote.md', 'x.skill.md'], []).body, '')
    assert.deepEqual(mergeGraphHits([{ symbol: 'runForge' }, { path: '../etc' }], [{ symbol: 'runForge' }, { symbol: 'packContext' }]).map((h) => h.symbol), [
      'runForge',
      'packContext'
    ])
  })

  it('T-118 LSP/DAP/git impact/chrome depth stay jailed', () => {
    const src = 'function foo() { return 1 }\nfunction bar() { foo() }\n'
    const symbols = lspQuery(src, 'a.ts', 'symbols')
    assert.equal(symbols.ok, true)
    const refs = lspQuery(src, 'a.ts', 'refs')
    assert.ok(refs.rows.some((r) => r.symbol === 'foo' && r.count >= 1))
    const diag = lspQuery('function z() {', 'a.ts', 'diagnostics')
    assert.ok(diag.rows.some((r) => r.code === 'brace'))
    assert.equal(lspQuery('x', '../x.ts', 'symbols').ok, false)
    const ev = takeDapEvidence({ hypothesis: 'null', stack: 'foo.ts:1', frames: ['a'] })
    assert.equal(ev.hypothesis, 'null')
    assert.equal(takeDapEvidence({ stack: '../etc/passwd' }), null)
    assert.equal(dapEvidenceRel('../x'), 'data/debug/x.evidence.json')
    const hunks = gitImpactHunks(
      'diff --git a/packages/agent/src/index.ts b/packages/agent/src/index.ts\n',
      { nodes: [{ path: 'packages/agent/src/index.ts', callers: ['a', 'b', 'c'] }] }
    )
    assert.equal(hunks[0].warn, true)
    assert.equal(chromeDevtoolsDepth('performance_trace'), true)
    assert.equal(chromeDevtoolsDepth('desktopcommander_fs'), false)
    const exploreSrc = readFileSync(join(repo, 'packages/runtime/src/explore.ts'), 'utf8')
    assert.match(exploreSrc, /parseStructuralIndex/)
    const tools = readFileSync(join(repo, 'apps/desktop/src/main/tools.ts'), 'utf8')
    assert.match(tools, /dapEvidenceRel\('test'\)/)
  })

  it('T-119 mesh, scene jail, ACP name, HITL cap, DNA plans, outcome route', () => {
    assert.equal(designMeshRoute('swap dtcg token'), 'deterministic')
    assert.equal(designMeshRoute('new page campaign'), 'frontier')
    assert.equal(meshKind('nope'), 'specialist')
    const scene = sceneIrJail({ id: '../etc', ax: ['btn'], approval: 'allow' })
    assert.match(scene.rel, /^data\/scene\//)
    assert.equal(scene.rel.includes('..'), false)
    assert.equal(acpWorktreeName('../Secrets'), 'secrets')
    const hitl = hitlStep({ action: 'delay', ms: 999999, reason: '<b>wait</b>' })
    assert.equal(hitl.ms, 60_000)
    assert.equal(hitl.reason.includes('<'), false)
    const gw = gatewayContinuity('telegram', 'home')
    assert.equal(gw.surface, 'telegram')
    assert.equal(gatewayContinuity('miniapp', 'home').surface, 'miniapp')
    const dna = dnaPlanFromRecipes(['kernel-loop', 'tool-packs'], 'Phase 4/5')
    assert.equal(dna.ok, true)
    assert.match(dna.rel, /^RAG\/plans\/dna-/)
    assert.equal(dna.rel.includes('.think.md'), false)
    assert.match(dna.markdown, /kernel-loop/)
    const sc = dnaScaffoldFromRecipes(['kernel-loop'], 'Phase 4/5')
    assert.equal(sc.apply, false)
    assert.equal(sc.ok, true)
    assert.ok(sc.files.some((f) => f.rel === dna.rel))
    assert.ok(sc.files.some((f) => f.rel.endsWith('/README.md') && f.rel.startsWith('RAG/plans/dna-')))
    assert.ok(sc.files.every((f) => !f.rel.includes('.think.md') && !f.rel.includes('..')))
    const fid = designFidelityReport({ revision: '1' }, { revision: '2' }, 'swap dtcg token')
    assert.match(fid, /deterministic/)
    assert.match(fid, /1→2/)
    assert.equal(fid.includes('<'), false)
    const receipt = fleetReceiptLine({ repos: [{ running: true }, { running: false }], bots: [{ username: '<b>x</b>' }] })
    assert.match(receipt, /live 1/)
    assert.equal(receipt.includes('<'), false)
    assert.equal(receipt.toLowerCase().includes('token'), false)
    assert.equal(outcomeRoute({ localOk: true, verifyOk: true }), 'local')
    assert.equal(outcomeRoute({ localOk: false, hasCloud: true }), 'cloud')
    assert.equal(outcomeRoute({ localOk: true, verifyOk: false, hasSidecar: true }), 'sidecar')
  })

  it('T-120 harvest ports stay analog/port/next; autoRun honored; Trust lane', () => {
    for (const id of compilerOsHarvestIds()) {
      const row = harvestRow(id)
      assert.ok(row, id)
      assert.equal(harvestPortKind(row.kind), row.kind)
      assert.equal(row.kind === 'skip-unjail', false)
    }
    assert.equal(harvestPortKind('skip-unjail'), null)
    assert.equal(harvestRow('desktop-commander')?.kind, 'skip-unjail')
    assert.ok(compilerOsHarvestIds().includes('mcp-use'))
    assert.ok(compilerOsHarvestIds().includes('activepieces'))
    const yes = instructionAuthorization('npm test', {
      autoRun: { allow_instructions: ['npm test'], block_instructions: [] },
      autoReview: { allow_instructions: [], block_instructions: [] }
    })
    assert.equal(yes, 'explicitly_yes')
    const blocked = instructionAuthorization('rm -rf', {
      autoRun: { allow_instructions: ['rm'], block_instructions: ['rm'] },
      autoReview: { allow_instructions: [], block_instructions: [] }
    })
    assert.equal(blocked, 'explicitly_no')
    let wf = takeWorkflow(null, { type: 'status', text: 'auto-review · judge · allow · safe-git' }, { runId: 'ar', now: 1 })
    const lanes = splitWorkflowPhases(wf)
    assert.equal(lanes.trust.length, 1)
    assert.equal(lanes.trust[0].name, 'auto-review')
    assert.match(workflowPhaseLine(wf), /Trust 1\/1/)
    const harvest = readFileSync(join(repo, 'packages/runtime/src/resource-harvest.mjs'), 'utf8')
    assert.match(harvest, /COMPILER_OS_PORTS/)
  })

  it('T-121 DNA compiles an original runnable app inside the plans jail', () => {
    const recipe = [
      '---',
      'id: rec-demo-loop',
      'title: Demo <Loop>',
      'stack: web',
      'status: refined',
      '__proto__: ignored',
      '---',
      '',
      '## Shape (do this)',
      '- Mechanism: perceive <input>, compose locally, then verify',
      '',
      '## Ports',
      '- Worker: same shape'
    ].join('\n')
    assert.deepEqual(takeRecipeMeta(recipe), {
      id: 'rec-demo-loop',
      title: 'Demo Loop',
      stack: 'web',
      status: 'refined'
    })
    assert.equal(takeRecipeMechanism(recipe), 'perceive input, compose locally, then verify')
    assert.equal(dnaAppRel('../Demo', 'index.html'), 'RAG/plans/dna-demo/app/index.html')
    assert.equal(dnaAppRel('demo', '../../etc'), '')
    const compiled = dnaScaffoldFromRecipes(['demo-loop'], 'Phase 5/5', [{ slug: 'demo-loop', markdown: recipe }])
    const paths = compiled.files.map((file) => file.rel)
    assert.equal(compiled.apply, false)
    assert.equal(compiled.ok, true)
    assert.ok(paths.includes('RAG/plans/dna-demo-loop.md'))
    assert.ok(paths.includes('RAG/plans/dna-demo-loop/README.md'))
    assert.ok(paths.includes('RAG/plans/dna-demo-loop/app/index.html'))
    assert.ok(paths.includes('RAG/plans/dna-demo-loop/app/app.css'))
    assert.ok(paths.includes('RAG/plans/dna-demo-loop/app/app.js'))
    assert.ok(paths.includes('RAG/plans/dna-demo-loop/ir.json'))
    assert.ok(paths.includes('RAG/plans/dna-demo-loop/cli/run.mjs'))
    assert.ok(paths.includes('RAG/plans/dna-demo-loop/api/server.mjs'))
    assert.ok(paths.includes('RAG/plans/dna-demo-loop/api/openapi.json'))
    assert.ok(paths.includes('RAG/plans/dna-demo-loop/desktop/main.mjs'))
    assert.ok(paths.includes('RAG/plans/dna-demo-loop/desktop/preload.cjs'))
    assert.ok(paths.includes('RAG/plans/dna-demo-loop/desktop/manifest.json'))
    assert.ok(paths.every((rel) => rel.startsWith('RAG/plans/dna-') && !rel.includes('..') && !rel.includes('.think.md')))
    const html = compiled.files.find((file) => file.rel.endsWith('index.html')).body
    const js = compiled.files.find((file) => file.rel.endsWith('app.js')).body
    assert.match(html, /Content-Security-Policy/)
    assert.match(html, /Demo Loop/)
    assert.match(html, /perceive input, compose locally, then verify/)
    assert.doesNotMatch(html, /AI Resources|Cursor UI|https?:\/\//)
    assert.match(js, /textContent/)
    assert.doesNotMatch(js, /innerHTML|eval\(/)
    assert.doesNotThrow(() => new Function(js))
    const tools = readFileSync(join(repo, 'apps/desktop/src/main/tools.ts'), 'utf8')
    assert.match(tools, /RAG\/recipes\/\$\{slug\}\.md/)
    assert.match(tools, /dnaArtifactAllowed/)
    const mods = readFileSync(join(repo, 'packages/mods/src/index.ts'), 'utf8')
    assert.match(mods, /kind=dna/)
    assert.match(mods, /enum: \['think', 'dna'\]/)
  })

  it('T-122 CapabilityIR validates before deterministic web and CLI emission', () => {
    const recipe = [
      '---',
      'id: rec-kernel-loop',
      'title: Kernel Loop',
      'stack: any',
      'status: refined',
      '---',
      '## Shape',
      '- Mechanism: perceive, act, verify, remember',
      '## Ports',
      '- Web/API: request context then verify',
      '- Worker/CLI: payload then durable result'
    ].join('\n')
    const ports = takeRecipePorts(recipe)
    assert.equal(ports.web, 'request context then verify')
    assert.equal(ports.api, 'request context then verify')
    assert.equal(ports.worker, 'payload then durable result')
    assert.equal(ports.cli, 'payload then durable result')
    const compiled = compileCapabilityIr(['kernel-loop'], 'Phase 5/5', [{ slug: 'kernel-loop', markdown: recipe }])
    assert.equal(compiled.ok, true)
    assert.equal(compiled.ir.schema, 'capabilityir/0.1')
    assert.equal(compiled.ir.artifact.profile, 'web-cli-api')
    assert.equal(compiled.ir.capabilities[0].ports.cli, 'payload then durable result')
    assert.equal(validateCapabilityIr(compiled.ir).ok, true)
    assert.equal(takeCapabilityIr(Object.create({ schema: 'capabilityir/0.1' })), null)
    const htmlIr = JSON.parse(JSON.stringify(compiled.ir))
    htmlIr.capabilities[0].mechanism = '<script>'
    assert.equal(validateCapabilityIr(htmlIr).ok, false)
    const profileIr = JSON.parse(JSON.stringify(compiled.ir))
    profileIr.artifact.profile = 'desktop.exec'
    assert.equal(validateCapabilityIr(profileIr).ok, false)
    const mismatchIr = JSON.parse(JSON.stringify(compiled.ir))
    mismatchIr.source.recipes[0] = 'other-loop'
    assert.equal(validateCapabilityIr(mismatchIr).ok, false)
    const statusIr = JSON.parse(JSON.stringify(compiled.ir))
    statusIr.source.status = '<b>ready</b>'
    assert.equal(validateCapabilityIr(statusIr).ok, false)
    assert.equal(dnaIrRel('../Kernel'), 'RAG/plans/dna-kernel/ir.json')
    assert.equal(dnaCliRel('../Kernel'), 'RAG/plans/dna-kernel/cli/run.mjs')
    assert.equal(dnaArtifactAllowed('RAG/plans/dna-kernel/cli/run.mjs', 'kernel'), true)
    assert.equal(dnaArtifactAllowed('RAG/plans/dna-kernel/cli/../../x.mjs', 'kernel'), false)
    const web = emitWebStatic(compiled.ir)
    const cli = emitCliRunner(compiled.ir)
    assert.deepEqual(web.map((file) => file.rel), [
      'RAG/plans/dna-kernel-loop/app/index.html',
      'RAG/plans/dna-kernel-loop/app/app.css',
      'RAG/plans/dna-kernel-loop/app/app.js'
    ])
    assert.deepEqual(cli.map((file) => file.rel), ['RAG/plans/dna-kernel-loop/cli/run.mjs'])
    assert.match(cli[0].body, /capability-result\/0\.1/)
    assert.doesNotMatch(cli[0].body, /eval\(|innerHTML|https?:\/\//)
  })

  it('T-123 loopback API emitter validates transport and request schema', async () => {
    const compiled = compileCapabilityIr(['api-loop'], 'Phase 5/5', [])
    assert.equal(compiled.ok, true)
    assert.deepEqual(takeComposeRequest({ action: 'compose' }), { action: 'compose' })
    assert.equal(takeComposeRequest({ action: 'compose', extra: true }), null)
    assert.equal(takeComposeRequest(JSON.parse('{"action":"compose","__proto__":{"ok":true}}')), null)
    assert.equal(takeComposeRequest(['compose']), null)
    const result = composeCapabilityResult(compiled.ir)
    assert.equal(result.schema, 'capability-result/0.1')
    assert.equal(result.capabilities[0].id, 'cap-api-loop')
    assert.equal(dnaApiRel('../Api Loop', 'server.mjs'), 'RAG/plans/dna-api-loop/api/server.mjs')
    assert.equal(dnaApiRel('api-loop', '../../server.mjs'), '')
    assert.equal(dnaArtifactAllowed('RAG/plans/dna-api-loop/api/server.mjs', 'api-loop'), true)
    const files = emitApiLoopback(compiled.ir)
    assert.deepEqual(files.map((file) => file.rel), [
      'RAG/plans/dna-api-loop/api/server.mjs',
      'RAG/plans/dna-api-loop/api/openapi.json'
    ])
    const serverSource = files.find((file) => file.rel.endsWith('server.mjs')).body
    const openapi = JSON.parse(files.find((file) => file.rel.endsWith('openapi.json')).body)
    assert.match(serverSource, /listen\(takePort\(port\), '127\.0\.0\.1'\)/)
    assert.doesNotMatch(serverSource, /0\.0\.0\.0|cors|Access-Control-Allow-Origin/)
    assert.match(serverSource, /MAX_BODY = 8192/)
    assert.match(serverSource, /requestTimeout = 5000/)
    assert.equal(openapi.paths['/compose'].post.requestBody.content['application/json'].schema.additionalProperties, false)
    const url = `data:text/javascript;base64,${Buffer.from(serverSource).toString('base64')}`
    const generated = await import(url)
    const api = generated.createDnaApiServer()
    await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve))
    const address = api.address()
    const base = `http://127.0.0.1:${address.port}`
    try {
      const health = await fetch(`${base}/health`)
      assert.equal(health.status, 200)
      assert.equal((await health.json()).schema, 'capability-health/0.1')
      const compose = await fetch(`${base}/compose`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'compose' })
      })
      assert.equal(compose.status, 200)
      assert.equal((await compose.json()).schema, 'capability-result/0.1')
      const extra = await fetch(`${base}/compose`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'compose', extra: true })
      })
      assert.equal(extra.status, 400)
      const wrongType = await fetch(`${base}/compose`, { method: 'POST', body: '{}' })
      assert.equal(wrongType.status, 415)
      const malformed = await fetch(`${base}/compose`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{'
      })
      assert.equal(malformed.status, 400)
      const tooLarge = await fetch(`${base}/compose`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'compose', pad: 'x'.repeat(8200) })
      })
      assert.equal(tooLarge.status, 413)
      assert.equal((await fetch(`${base}/missing`)).status, 404)
    } finally {
      await new Promise((resolve) => api.close(resolve))
    }
  })

  it('T-124 desktop emitter keeps Node behind a frozen preload bridge', () => {
    const compiled = compileCapabilityIr(['desktop-loop'], 'Phase 5/5', [])
    assert.equal(compiled.ok, true)
    assert.equal(dnaDesktopRel('../Desktop Loop', 'main.mjs'), 'RAG/plans/dna-desktop-loop/desktop/main.mjs')
    assert.equal(dnaDesktopRel('desktop-loop', '../../preload.cjs'), '')
    assert.equal(dnaArtifactAllowed('RAG/plans/dna-desktop-loop/desktop/preload.cjs', 'desktop-loop'), true)
    assert.equal(dnaArtifactAllowed('RAG/plans/dna-desktop-loop/desktop/other.cjs', 'desktop-loop'), false)
    const files = emitDesktopShell(compiled.ir)
    assert.deepEqual(files.map((file) => file.rel), [
      'RAG/plans/dna-desktop-loop/desktop/main.mjs',
      'RAG/plans/dna-desktop-loop/desktop/preload.cjs',
      'RAG/plans/dna-desktop-loop/desktop/manifest.json'
    ])
    const main = files.find((file) => file.rel.endsWith('main.mjs')).body
    const preload = files.find((file) => file.rel.endsWith('preload.cjs')).body
    const manifest = JSON.parse(files.find((file) => file.rel.endsWith('manifest.json')).body)
    assert.match(main, /contextIsolation: true/)
    assert.match(main, /nodeIntegration: false/)
    assert.match(main, /sandbox: true/)
    assert.match(main, /webviewTag: false/)
    assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/)
    assert.match(main, /will-navigate/)
    assert.match(main, /will-attach-webview/)
    assert.match(main, /setPermissionRequestHandler/)
    assert.match(main, /setPermissionCheckHandler/)
    assert.match(main, /loadFile\(renderer\)/)
    assert.doesNotMatch(main, /loadURL|shell\.openExternal|ipcMain/)
    assert.match(preload, /exposeInMainWorld\('dna'/)
    assert.doesNotMatch(preload, /ipcRenderer|node:fs|child_process|process\.env|homeai/)
    let bridgeName = ''
    let bridge = null
    const fakeRequire = (name) => {
      assert.equal(name, 'electron')
      return {
        contextBridge: {
          exposeInMainWorld: (key, value) => {
            bridgeName = key
            bridge = value
          }
        }
      }
    }
    assert.doesNotThrow(() => new Function('require', preload)(fakeRequire))
    assert.equal(bridgeName, 'dna')
    assert.equal(bridge.snapshot().schema, 'desktop-bridge/0.1')
    assert.equal(bridge.compose().schema, 'capability-result/0.1')
    assert.equal(Object.isFrozen(bridge.snapshot()), true)
    assert.equal(manifest.security.nodeIntegration, false)
    assert.equal(manifest.security.sandbox, true)
    const web = emitWebStatic(compiled.ir)
    const appJs = web.find((file) => file.rel.endsWith('app.js')).body
    assert.match(appJs, /globalThis\.dna\?\.compose/)
    assert.equal(emitDesktopShell({ schema: 'bad' }).length, 0)
  })
})

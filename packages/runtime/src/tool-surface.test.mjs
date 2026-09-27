import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectToolPacks, packFromName, filterToolsByPack, keepFullSchema } from './tool-packs.mjs'
import { ASK_BLOCK, formatToolSurface, isFullToolMode, mcpPublicRows, toolsForMode, toolsForDesign, designToolChoice, VERIFY_TOOLS, verifyToolDefs, takeVerifyCalls, takeVerifyPatch, verifyUserPrompt } from './tool-surface.mjs'
import { takeVerifyDiff } from './verify-diff.mjs'

const builtins = [
  { name: 'fs_read', description: 'r', permissions: ['read'], parameters: {} },
  { name: 'fs_write', description: 'w', permissions: ['write'], parameters: {} },
  { name: 'terminal_run', description: 'x', permissions: ['exec'], parameters: {} },
  { name: 'explore', description: 'e', permissions: ['read'], parameters: {} },
  { name: 'http_fetch', description: 'n', permissions: ['net'], parameters: {} },
  { name: 'design_get', description: 'dg', permissions: ['read'], parameters: {} },
  { name: 'design_patch', description: 'dp', permissions: ['write'], parameters: {} }
]
const mcp = [{ name: 'mcp_git_status', description: '[MCP git] status', permissions: ['net'], parameters: {} }]
const ALL = { packs: ['core', 'research', 'browser', 'design', 'life', 'mcp-domain'] }

describe('tool surface', () => {
  it('default agent is core only and drops MCP', () => {
    const names = toolsForMode('agent', builtins, mcp).map((t) => t.name)
    assert.equal(names.includes('mcp_git_status'), false)
    assert.equal(names.includes('http_fetch'), false)
    assert.equal(names.includes('fs_read'), true)
    assert.equal(names.includes('explore'), true)
  })

  it('agent with all packs gets builtins plus MCP', () => {
    const names = toolsForMode('agent', builtins, mcp, ALL).map((t) => t.name)
    assert.deepEqual(
      names.sort(),
      ['design_get', 'design_patch', 'explore', 'fs_read', 'fs_write', 'http_fetch', 'mcp_git_status', 'terminal_run'].sort()
    )
    assert.equal(toolsForMode('debug', builtins, mcp, ALL).length, 8)
    assert.equal(toolsForMode('multitask', builtins, mcp, ALL).length, 8)
    assert.equal(isFullToolMode('agent'), true)
    assert.equal(isFullToolMode('think'), false)
  })

  it('think stays local perceive pack and drops MCP', () => {
    const names = toolsForMode('think', builtins, mcp, ALL).map((t) => t.name)
    assert.deepEqual(names.sort(), ['design_get', 'explore', 'fs_read'].sort())
    assert.equal(names.includes('mcp_git_status'), false)
    assert.equal(names.includes('terminal_run'), false)
    assert.equal(names.includes('design_get'), true)
    assert.equal(names.includes('design_patch'), false)
  })

  it('T-90 ask blocks writes and net browsers; MCP only with mcp-domain pack', () => {
    const names = toolsForMode('ask', builtins, mcp, ALL).map((t) => t.name)
    assert.equal(names.includes('fs_write'), false)
    assert.equal(ASK_BLOCK.has('http_fetch'), true)
    assert.equal(names.includes('http_fetch'), false)
    assert.equal(names.includes('mcp_git_status'), true)
    assert.equal(names.includes('explore'), true)
    assert.equal(names.includes('design_patch'), false)
    assert.equal(names.includes('design_get'), true)
    for (const n of ['speak', 'inbox_stt', 'inbox_ocr', 'browser_extract', 'browser_screenshot', 'browser_console']) {
      assert.equal(ASK_BLOCK.has(n), true)
    }
    const askLife = toolsForMode(
      'ask',
      [
        ...builtins,
        { name: 'speak', description: 'tts', permissions: ['exec'], parameters: {} },
        { name: 'inbox_stt', description: 'stt', permissions: ['exec'], parameters: {} },
        { name: 'inbox_ocr', description: 'ocr', permissions: ['exec'], parameters: {} },
        { name: 'browser_extract', description: 'be', permissions: ['net'], parameters: {} },
        { name: 'browser_screenshot', description: 'bs', permissions: ['net'], parameters: {} },
        { name: 'browser_console', description: 'bc', permissions: ['net'], parameters: {} }
      ],
      mcp,
      { ...ALL, lifeBins: { ocr: true, stt: true, tts: true } }
    ).map((t) => t.name)
    assert.equal(askLife.includes('speak'), false)
    assert.equal(askLife.includes('inbox_stt'), false)
    assert.equal(askLife.includes('inbox_ocr'), false)
    assert.equal(askLife.includes('browser_extract'), false)
    assert.equal(askLife.includes('browser_screenshot'), false)
    assert.equal(askLife.includes('browser_console'), false)
    const plan = toolsForMode('plan', builtins, mcp, ALL).map((t) => t.name)
    assert.equal(plan.includes('design_patch'), false)
    assert.equal(plan.includes('design_get'), true)
    const planWrite = toolsForMode(
      'plan',
      [
        ...builtins,
        { name: 'rag_write', description: 'rw', permissions: ['write'], parameters: {} },
        { name: 'plan_write', description: 'pw', permissions: ['write'], parameters: {} }
      ],
      mcp,
      ALL
    ).map((t) => t.name)
    assert.equal(planWrite.includes('rag_write'), true)
    assert.equal(planWrite.includes('plan_write'), true)
    assert.equal(planWrite.includes('fs_write'), false)
  })

  it('T-47 design loop drops explore and MCP so 2B cannot story the IR', () => {
    const withIngest = [
      ...builtins,
      { name: 'design_ingest_tokens', description: 'di', permissions: ['write'], parameters: {} }
    ]
    const loop = toolsForDesign(withIngest).map((t) => t.name)
    assert.deepEqual(loop.sort(), ['design_get', 'design_ingest_tokens', 'design_patch'].sort())
    assert.equal(loop.includes('explore'), false)
    assert.equal(loop.includes('fs_write'), false)
    assert.equal(designToolChoice(toolsForDesign(withIngest)), 'required')
    assert.equal(designToolChoice(builtins), 'auto')
    assert.equal(designToolChoice([]), 'auto')
  })

  it('public MCP rows drop urls and markup', () => {
    const rows = mcpPublicRows([
      { id: '<git>', ok: true, tools: ['status', 'push'], url: 'https://evil.example/mcp', transport: 'http' },
      { id: 'down', ok: false, tools: [], error: 'fail', url: 'http://127.0.0.1:9' }
    ])
    assert.equal(rows[0].id.includes('<'), false)
    assert.equal(rows[0].url, undefined)
    assert.equal(rows[0].ok, true)
    const card = formatToolSurface('agent', builtins, mcp, [
      { id: 'git', ok: true, tools: ['status'], transport: 'stdio' },
      { id: 'web', ok: false, tools: [] }
    ])
    assert.match(card, /mcp 1\/2/)
    assert.equal(card.includes('http://'), false)
    assert.match(card, /git stdio/)
    assert.match(card, /\/pack research\|browser\|design\|life\|mcp-domain/)
  })

  it('detectToolPacks reads /pack and keywords', () => {
    assert.deepEqual(detectToolPacks('/pack research browser', []).sort(), ['browser', 'core', 'research'].sort())
    assert.equal(detectToolPacks('search the web', []).includes('research'), true)
    assert.equal(packFromName('mcp_foo_bar'), 'mcp-domain')
    assert.equal(packFromName('notes_list'), 'life')
    const slim = filterToolsByPack(builtins, ['core'])
    assert.equal(slim.some((t) => t.name === 'http_fetch'), false)
    assert.equal(VERIFY_TOOLS.has('str_replace'), true)
    assert.equal(VERIFY_TOOLS.has('debug_start'), false)
    assert.equal(verifyToolDefs(builtins).length, 0)
    const critic = verifyToolDefs([...builtins, { name: 'str_replace', description: 'e', permissions: ['write'], parameters: {} }])
    assert.equal(critic.length, 1)
    const slimMcp = toolsForMode('agent', builtins, mcp, ALL).find((t) => t.name === 'mcp_git_status')
    assert.equal(slimMcp && Object.keys(slimMcp.parameters.properties || {}).length, 0)
    const vcalls = takeVerifyCalls([
      { name: 'str_replace', arguments: {} },
      { name: 'terminal_run', arguments: { command: 'id' } },
      { name: 'ask_user', arguments: {} }
    ])
    assert.deepEqual(
      vcalls.map((c) => c.name),
      ['str_replace', 'ask_user']
    )
    assert.equal(detectToolPacks('fix explorer', [{ name: 'workbench', description: 'desktop workbench chrome' }]).includes('research'), false)
    assert.equal(detectToolPacks('x', [{ name: 'research-helper', description: 'research the docs' }]).includes('research'), true)
    const gitLog = { name: 'git_log', description: 'log\nextra', permissions: ['read'], parameters: { type: 'object', properties: { n: { type: 'number' } } } }
    const fetchTool = { name: 'http_fetch', description: 'n', permissions: ['net'], parameters: { type: 'object', properties: { url: { type: 'string' } } } }
    const plan = { name: 'plan_write', description: 'pw', permissions: ['write'], parameters: { type: 'object', properties: { path: { type: 'string' } } } }
    assert.equal(keepFullSchema(gitLog, ['core', 'research'], 'agent'), false)
    assert.equal(keepFullSchema(fetchTool, ['core', 'research'], 'agent'), true)
    const agentPacked = toolsForMode('agent', [gitLog, fetchTool, ...builtins], mcp, { packs: ['core', 'research'] })
    const slimGit = agentPacked.find((t) => t.name === 'git_log')
    const fullFetch = agentPacked.find((t) => t.name === 'http_fetch')
    assert.equal(slimGit && Object.keys(slimGit.parameters.properties || {}).length, 0)
    assert.equal(fullFetch && Object.keys(fullFetch.parameters.properties || {}).length > 0, true)
    const thinkPlan = toolsForMode('think', [plan, gitLog, { name: 'explore', description: 'e', permissions: ['read'], parameters: { type: 'object', properties: { q: { type: 'string' } } } }], mcp)
    const tp = thinkPlan.find((t) => t.name === 'plan_write')
    const tg = thinkPlan.find((t) => t.name === 'git_log')
    assert.equal(tp && Object.keys(tp.parameters.properties || {}).length > 0, true)
    assert.equal(tg && Object.keys(tg.parameters.properties || {}).length, 0)
    const vp = verifyUserPrompt(['ok test_run <img>', 'ok str_replace'])
    assert.match(vp, /Do not call test_run/)
    assert.equal(vp.includes('<'), false)
  })

  it('T-78 takeVerifyPatch is workspace-relative; extra-root and secrets omitted', () => {
    const leak = takeVerifyPatch(
      { path: '/etc/passwd', before: 'old', after: 'secret-token' },
      '/home/ws'
    )
    assert.match(leak, /extra-root write/)
    assert.equal(leak.includes('secret-token'), false)
    assert.equal(leak.includes('/etc'), false)
    assert.equal(leak.includes('passwd'), false)
    const proto = takeVerifyPatch(
      { path: '/home/ws/../outside/x.ts', before: 'a', after: 'token-leak' },
      '/home/ws'
    )
    assert.match(proto, /extra-root/)
    assert.equal(proto.includes('token-leak'), false)
    const sec = takeVerifyPatch(
      { path: '/home/ws/data/secrets/k', before: '', after: 'sk-abcdefghijklmnopqrstuv' },
      '/home/ws'
    )
    assert.equal(sec, '')
    const ok = takeVerifyPatch(
      { path: '/home/ws/packages/a.ts', before: 'old <img>', after: 'new sk-abcdefghijklmnop' },
      '/home/ws'
    )
    assert.match(ok, /packages\/a\.ts/)
    assert.equal(ok.includes('<'), false)
    assert.match(ok, /\[redacted\]/)
    assert.equal(ok.includes('sk-abcdefghijklmnop'), false)
    const vp2 = verifyUserPrompt(['ok str_replace <b>'], [ok], 'diff <img> sk-abcdefghijklmnop')
    assert.match(vp2, /packages\/a/)
    assert.equal(vp2.includes('<'), false)
    const vp3 = verifyUserPrompt(['ok'], [], '', { note: 'paused hit.mjs:3 <img> sk-abcdefghijklmnop' })
    assert.match(vp3, /paused hit\.mjs:3/)
    assert.equal(vp3.includes('<'), false)
    assert.equal(vp3.includes('sk-abcdefghijklmnop'), false)
    assert.match(vp2, /packages\/a/)
    assert.equal(vp2.includes('<'), false)
    assert.ok(vp2.indexOf('packages/a') < vp2.indexOf('diff'))
    assert.equal(vp2.includes('sk-abcdefghijklmnop'), false)
    assert.equal(takeVerifyPatch(null, '/home/ws'), '')
    assert.equal(takeVerifyPatch({ path: '/home/ws/a.ts', before: 'x', after: 'y' }, ''), '')
    const inherited = Object.create({ after: 'stolen-secret' })
    inherited.path = '/home/ws/pkg.ts'
    inherited.before = 'a'
    const protoPatch = takeVerifyPatch(inherited, '/home/ws')
    assert.equal(protoPatch.includes('stolen-secret'), false)
    assert.match(protoPatch, /pkg\.ts/)
    assert.equal(takeVerifyDiff('/no/such/repo'), '')
    const gitRoot = mkdtempSync(join(tmpdir(), 'homeai-vdiff-'))
    assert.equal(takeVerifyDiff(gitRoot), '')
    mkdirSync(join(gitRoot, 'data', 'secrets'), { recursive: true })
    try {
      execFileSync('git', ['init', '-q'], { cwd: gitRoot, stdio: 'ignore' })
      writeFileSync(join(gitRoot, 'ok.txt'), 'hello')
      execFileSync('git', ['add', 'ok.txt'], { cwd: gitRoot, stdio: 'ignore' })
      execFileSync('git', ['-c', 'user.email=t@t.test', '-c', 'user.name=t', 'commit', '-m', 'i'], {
        cwd: gitRoot,
        stdio: 'ignore',
        env: { PATH: process.env.PATH, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' }
      })
      writeFileSync(join(gitRoot, 'ok.txt'), 'hello <img> later')
      writeFileSync(join(gitRoot, 'data', 'secrets', 'k'), 'sk-abcdefghijklmnopqrstuv')
      const d = takeVerifyDiff(gitRoot)
      assert.match(d, /ok\.txt/)
      assert.equal(d.includes('<'), false)
      assert.equal(d.includes('data/secrets'), false)
      assert.equal(d.includes('sk-abcdefghijklmnopqrstuv'), false)
      const extra = '/etc/passwd'
      assert.equal(d.includes(extra), false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('ENOENT') || /git/.test(msg)) return
      throw err
    }
  })

  it('T-82 transcribe voice note opens life; inbox_stt is not core', () => {
    assert.equal(detectToolPacks('transcribe this voice note', []).includes('life'), true)
    assert.equal(packFromName('inbox_stt'), 'life')
    assert.equal(packFromName('speak'), 'life')
    const lifeTools = [
      ...builtins,
      { name: 'inbox_stt', description: 'stt', permissions: ['exec'], parameters: {} },
      { name: 'speak', description: 'tts', permissions: ['exec'], parameters: {} }
    ]
    const core = toolsForMode('agent', lifeTools, []).map((t) => t.name)
    assert.equal(core.includes('inbox_stt'), false)
    assert.equal(core.includes('speak'), false)
    const life = toolsForMode('agent', lifeTools, [], {
      packs: ['core', 'life'],
      lifeBins: { ocr: true, stt: true, tts: true }
    }).map((t) => t.name)
    assert.equal(life.includes('inbox_stt'), true)
    assert.equal(life.includes('speak'), true)
    const missing = toolsForMode('agent', lifeTools, [], {
      packs: ['core', 'life'],
      lifeBins: { ocr: false, stt: false, tts: false }
    }).map((t) => t.name)
    assert.equal(missing.includes('inbox_stt'), false)
    assert.equal(missing.includes('speak'), false)
  })
})

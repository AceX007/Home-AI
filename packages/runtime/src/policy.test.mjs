import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { homedir } from 'node:os'
import { readFileSync } from 'node:fs'
import {
  clampApprovalMode,
  takeApprovalSave,
  mapAllowlist,
  sanitizeMcpRule,
  sanitizeNetPrefix,
  sanitizeTerminalPrefix,
  extraRootWriteDecision,
  extraRootWriteAsks,
  takePermissionsPatch,
  mcpApprovalDecision,
  applyLoadedPatch,
  pinWorkspaceInstructions,
  toolApprovalDetail,
  urlAllowed
} from './policy.mjs'

describe('policy sanitizers', () => {
  it('clamps unknown approval modes to allowlist', () => {
    assert.equal(clampApprovalMode('unrestricted'), 'unrestricted')
    assert.equal(clampApprovalMode('manual'), 'manual')
    assert.equal(clampApprovalMode('allowlist'), 'allowlist')
    assert.equal(clampApprovalMode('auto-review'), 'auto-review')
    assert.equal(clampApprovalMode({ approvalMode: 'unrestricted' }), 'allowlist')
    assert.equal(clampApprovalMode('nope'), 'allowlist')
    assert.equal(takeApprovalSave('unrestricted', true), 'unrestricted')
    assert.equal(takeApprovalSave('unrestricted', false), 'allowlist')
  })

  it('drops shell metacharacters and star from terminal prefixes', () => {
    assert.equal(sanitizeTerminalPrefix('git status'), 'git status')
    assert.equal(sanitizeTerminalPrefix('*'), null)
    assert.equal(sanitizeTerminalPrefix('git status; rm'), null)
    assert.equal(sanitizeTerminalPrefix('echo `id`'), null)
  })

  it('only keeps http(s) net prefixes', () => {
    assert.equal(sanitizeNetPrefix('https://localhost'), 'https://localhost')
    assert.equal(sanitizeNetPrefix('http://127.0.0.1'), 'http://127.0.0.1')
    assert.equal(sanitizeNetPrefix('file:///tmp/x'), null)
    assert.equal(sanitizeNetPrefix('javascript:void(0)'), null)
  })

  it('keeps server:tool MCP rules only', () => {
    assert.equal(sanitizeMcpRule('docs:*'), 'docs:*')
    assert.equal(sanitizeMcpRule('*:*'), '*:*')
    assert.equal(sanitizeMcpRule('not a rule'), null)
  })

  it('mapAllowlist skips non-strings', () => {
    const got = mapAllowlist(['https://a.com', { url: 'https://evil' }, 'file://x'], sanitizeNetPrefix)
    assert.deepEqual(got, ['https://a.com'])
  })
})

describe('urlAllowed origin match', () => {
  const local = ['http://127.0.0.1', 'https://localhost']

  it('does not treat a hostname prefix as the same origin', () => {
    assert.equal(urlAllowed('https://evil.example.attacker/x', ['https://evil.example']), false)
    assert.equal(urlAllowed('https://evil.example/x', ['https://evil.example']), true)
  })

  it('allows any port when the allow entry has no port', () => {
    assert.equal(urlAllowed('http://127.0.0.1:8765/v1', local), true)
    assert.equal(urlAllowed('http://127.0.0.1/health', local), true)
  })

  it('requires port when the allow entry names one', () => {
    assert.equal(urlAllowed('http://127.0.0.1:8765/v1', ['http://127.0.0.1:8765']), true)
    assert.equal(urlAllowed('http://127.0.0.1:80/v1', ['http://127.0.0.1:8765']), false)
  })

  it('path prefix is origin-bound and slash-bounded', () => {
    const allow = ['https://api.example.com/v1']
    assert.equal(urlAllowed('https://api.example.com/v1/users', allow), true)
    assert.equal(urlAllowed('https://api.example.com/v10', allow), false)
    assert.equal(urlAllowed('https://other.example.com/v1/users', allow), false)
  })

  it('rejects credentials and non-http', () => {
    assert.equal(sanitizeNetPrefix('https://u:p@localhost'), null)
    assert.equal(urlAllowed('file:///etc/passwd', ['file:///etc']), false)
    assert.equal(extraRootWriteDecision(), 'ask')
    assert.equal(extraRootWriteAsks('write', true), true)
    assert.equal(extraRootWriteAsks('write', false), false)
    assert.equal(extraRootWriteAsks('read', true), false)
  })
})

describe('takePermissionsPatch', () => {
  it('drops star prefixes, file: nets, and extra-root / or home', () => {
    const taken = takePermissionsPatch({
      approvalMode: 'nope',
      terminalAllowlist: ['*', 'git status', 'git status; rm'],
      netAllowlist: ['file:///etc', 'https://html.duckduckgo.com'],
      fsExtraRoots: ['/', homedir(), '/tmp/ok-docs'],
      __proto__: { approvalMode: 'unrestricted' }
    })
    assert.equal(taken.approvalMode, 'allowlist')
    assert.deepEqual(taken.terminalAllowlist, ['git status'])
    assert.deepEqual(taken.netAllowlist, ['https://html.duckduckgo.com'])
    assert.equal(taken.fsExtraRoots.includes('/'), false)
    assert.equal(taken.fsExtraRoots.includes(homedir()), false)
    assert.equal(taken.fsExtraRoots.includes('/tmp/ok-docs'), true)
  })

  it('keeps own-key autoRun lines and drops markup and proto', () => {
    const taken = takePermissionsPatch({
      autoRun: {
        allow_instructions: ['ok task', '<img>', { x: 1 }],
        __proto__: { allow_instructions: ['evil'] }
      },
      autoReview: { allow_instructions: ['review\nme'] }
    })
    assert.deepEqual(taken.autoRun.allow_instructions, ['ok task'])
    assert.equal(taken.autoRun.allow_instructions.includes('evil'), false)
    assert.equal(taken.autoReview, null)
    const review = takePermissionsPatch({ autoReview: { allow_instructions: ['review me'] } })
    assert.deepEqual(review.autoReview.allow_instructions, ['review me'])
    const wiped = takePermissionsPatch({ autoRun: { extra: true } })
    assert.equal(wiped.autoRun, null)
    const emptyReview = takePermissionsPatch({ autoReview: { allow_instructions: ['  '], block_instructions: [] } })
    assert.equal(emptyReview.autoReview, null)
  })

  it('T-95 auto-review never auto-allows MCP; empty instructions clear overlay', () => {
    assert.equal(mcpApprovalDecision('unrestricted', true), 'allow')
    assert.equal(mcpApprovalDecision('allowlist', true), 'allow')
    assert.equal(mcpApprovalDecision('allowlist', false), 'ask')
    assert.equal(mcpApprovalDecision('auto-review', true), 'ask')
    assert.equal(mcpApprovalDecision('auto-review', false), 'ask')
    assert.equal(mcpApprovalDecision('manual', true), 'allow')
    const merged = {
      approvalMode: 'auto-review',
      autoReview: { allow_instructions: ['old allow'] }
    }
    applyLoadedPatch(merged, { autoReview: { allow_instructions: ['new allow'] } })
    assert.deepEqual(merged.autoReview.allow_instructions, ['new allow'])
    applyLoadedPatch(merged, { autoReview: null })
    assert.equal(merged.autoReview, undefined)
    const later = { autoReview: { allow_instructions: ['from-cursor'] } }
    pinWorkspaceInstructions(later, { autoReview: null })
    assert.equal(later.autoReview, undefined)
    const src = readFileSync(new URL('../../../apps/desktop/src/main/index.ts', import.meta.url), 'utf8')
    assert.match(src, /mcpApprovalDecision\(perms\.approvalMode, mcpOk\)/)
    assert.equal(/mcpOk \? 'allow' : 'ask'/.test(src), false)
    const save = readFileSync(new URL('./approvals.ts', import.meta.url), 'utf8')
    assert.match(save, /autoReview: taken\.autoReview \?\? null/)
    assert.match(save, /pinWorkspaceInstructions/)
    const mini = readFileSync(new URL('../../../apps/desktop/src/main/miniapp-server.ts', import.meta.url), 'utf8')
    const health = mini.slice(mini.indexOf("action === 'health'"), mini.indexOf("action === 'provider'"))
    assert.match(health, /autoReviewLine/)
    assert.match(health, /miniPulse/)
  })
})

describe('toolApprovalDetail', () => {
  it('uses the real search URL, not the query string', () => {
    const detail = toolApprovalDetail({ name: 'web_search', arguments: { query: 'home ai' } })
    assert.equal(detail.startsWith('https://html.duckduckgo.com/html/?q='), true)
    assert.equal(urlAllowed(detail, ['https://html.duckduckgo.com']), true)
    assert.equal(urlAllowed('home ai', ['https://html.duckduckgo.com']), false)
    assert.equal(toolApprovalDetail({ name: 'compute_run', arguments: { runtime: 'node' } }), 'compute_run node')
    assert.equal(toolApprovalDetail({ name: 'inbox_stt', arguments: { path: 'data/inbox/v.ogg' } }), 'inbox_stt')
    assert.equal(toolApprovalDetail({ name: 'speak', arguments: { text: 'hi' } }), 'speak')
    assert.equal(toolApprovalDetail({ name: 'web_extract', arguments: { url: 'https://127.0.0.1/x' } }).startsWith('https://'), true)
  })

  it('uses the page URL for click/type and git prefixes for worktrees', () => {
    assert.equal(
      toolApprovalDetail({ name: 'browser_click', arguments: { selector: 'a' } }, 'https://example.com/app'),
      'https://example.com/app'
    )
    assert.equal(toolApprovalDetail({ name: 'git_worktree', arguments: { action: 'list' } }), 'git worktree list')
    assert.equal(toolApprovalDetail({ name: 'debug_start', arguments: { path: 'hit.mjs' } }), 'hit.mjs')
    assert.equal(toolApprovalDetail({ name: 'http_fetch', arguments: { url: 'https://127.0.0.1/x' } }).startsWith('https://'), true)
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { takeGitHttpsUrl, gitCloneHttpsArgv, gitPushArgv } from './git-safe.mjs'
import {
  takeRepoRel,
  takeFleetId,
  takeBotToken,
  takeBroadcastBody,
  recipeSpawn,
  redactFleetLog,
  rotationNotice,
  takeRegistry,
  publicSnapshot,
  seedLinkInfo,
  smtpEndpoint,
  takeSmtpHop,
  maskEmail,
  LINK_INFO_REL,
  loadRegistry,
  takeFleetCommand,
  fleetCard,
  filterSubscribers,
  idFromCloneUrl,
  takeSiteDomain,
  nextCloneId,
  stackForest,
  kindFromAddRel,
  defaultRecipeForKind
} from './fleet.mjs'

describe('T-73 fleet jails', () => {
  it('rejects repo escape, secrets, and renderer recipes', () => {
    assert.equal(takeRepoRel('Repos/Link INFO BOT'), 'Repos/Link INFO BOT')
    assert.equal(takeRepoRel('data/fleet/clones/hub-2'), 'data/fleet/clones/hub-2')
    assert.equal(takeRepoRel('../etc'), null)
    assert.equal(takeRepoRel('data/secrets/telegram.key'), null)
    assert.equal(takeRepoRel('/etc/passwd'), null)
    assert.equal(takeRepoRel('Repos/foo/../../data/secrets'), null)
    assert.equal(takeFleetId('Link Info'), null)
    assert.equal(takeFleetId('link-info'), 'link-info')
    assert.deepEqual(recipeSpawn('python-app-main'), { bin: 'python3', args: ['-m', 'app.main'] })
    assert.equal(recipeSpawn('bash -c id'), null)
    assert.equal(recipeSpawn('python-app-main; rm -rf /'), null)
    assert.equal(takeBotToken('123:short'), null)
    assert.equal(Boolean(takeBotToken('1234567890:AA' + 'A'.repeat(30))), true)
  })

  it('clone is https only; dest is a basename; no credentials', () => {
    assert.equal(takeGitHttpsUrl('https://github.com/acme/link-info.git'), 'https://github.com/acme/link-info.git')
    assert.equal(takeGitHttpsUrl('file:///tmp/x'), null)
    assert.equal(takeGitHttpsUrl('git@github.com:acme/x.git'), null)
    assert.equal(takeGitHttpsUrl('https://user:pass@github.com/acme/x.git'), null)
    assert.deepEqual(gitCloneHttpsArgv('https://github.com/acme/site.git', 'site-clone'), [
      'clone',
      '--depth',
      '1',
      '--',
      'https://github.com/acme/site.git',
      'site-clone'
    ])
    assert.throws(() => gitCloneHttpsArgv('https://github.com/acme/site.git', '../x'), /bad clone dest/)
    assert.throws(() => gitPushArgv('origin'), /no extra args/)
  })

  it('broadcasts strip markup; DTO never contains a token; smtp host is not renderer-chosen', () => {
    assert.equal(takeBroadcastBody('<b>hi</b> parse_mode'), null)
    assert.equal(takeBroadcastBody('<b>hello</b> world'), 'hello world')
    assert.match(rotationNotice('@NewHubBot'), /t\.me\/NewHubBot/)
    assert.equal(rotationNotice('../x'), null)
    const token = '1234567890:' + 'A'.repeat(30)
    const log = redactFleetLog(`spawn HUB_BOT_TOKEN=${token} ok`)
    assert.equal(log.includes(token), false)
    assert.match(log, /\[redacted\]/)
    const snap = publicSnapshot({
      repos: [{ id: 'link-info', rel: LINK_INFO_REL, kind: 'telegram-bot', recipe: 'python-app-main', title: 'Hub' }],
      bots: [{ id: 'hub', role: 'hub', repoId: 'link-info', username: 'HubBot', hasToken: true, token, last4: 'AAAA' }],
      smtp: { provider: 'evil.example', host: '8.8.8.8', user: 'ops@example.com' },
      __proto__: { admin: true }
    })
    assert.equal(JSON.stringify(snap).includes(token), false)
    assert.equal(snap.smtp.provider, 'none')
    assert.equal(snap.smtp.user, 'o***@example.com')
    assert.deepEqual(smtpEndpoint('proton-bridge'), { host: '127.0.0.1', port: 1025 })
    assert.equal(smtpEndpoint('127.0.0.1'), null)
    assert.equal(takeSmtpHop('8.8.8.8', 25), null)
    assert.deepEqual(takeSmtpHop('127.0.0.1', 1025), { host: '127.0.0.1', port: 1025 })
    assert.equal(maskEmail('ops@example.com'), 'o***@example.com')
    const seeded = seedLinkInfo({ repos: [] }, (rel) => rel.startsWith(LINK_INFO_REL))
    assert.equal(seeded.repos[0].id, 'link-info')
    assert.equal(seeded.repos[0].recipe, 'python-app-main')
  })

  it('loadRegistry writes jailed JSON and drops proto', () => {
    const root = mkdtempSync(join(tmpdir(), 'homeai-fleet-'))
    mkdirSync(join(root, 'Repos', 'Link INFO BOT', 'app'), { recursive: true })
    writeFileSync(join(root, 'Repos', 'Link INFO BOT', 'app', 'main.py'), 'print(1)\n')
    const reg = loadRegistry(root)
    assert.equal(reg.repos[0].id, 'link-info')
    const evil = takeRegistry({ repos: [{ id: 'x', rel: '../secret', recipe: 'sh' }], admin: true })
    assert.equal(evil.admin, undefined)
    assert.equal(evil.repos.length, 0)
    rmSync(root, { recursive: true, force: true })
  })

  it('T-84 phone fleet verbs jail clone/add; removeSub keeps subscribers; card drops tokens', () => {
    assert.equal(takeFleetCommand('/fleet').action, 'status')
    assert.equal(takeFleetCommand('/fleet clone file:///tmp/x site').action, 'bad')
    assert.equal(takeFleetCommand('/fleet clone https://user:pass@github.com/acme/x.git site').action, 'bad')
    assert.equal(takeFleetCommand('/fleet token 1234567890:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA').action, 'denied-token')
    assert.equal(takeFleetCommand('/fleet add x ../etc').action, 'bad')
    const cl = takeFleetCommand('/fleet clone https://github.com/acme/site.git site-clone website')
    assert.equal(cl.action, 'clone')
    assert.equal(cl.id, 'site-clone')
    assert.equal(cl.url, 'https://github.com/acme/site.git')
    assert.equal(idFromCloneUrl('https://github.com/acme/my-site.git'), 'my-site')
    const token = '1234567890:' + 'A'.repeat(30)
    const card = fleetCard({
      repos: [{ id: 'link-info', rel: LINK_INFO_REL, running: true }],
      bots: [{ id: 'hub', username: 'HubBot', token, last4: 'AAAA' }],
      subscribers: [{ kind: 'telegram', chatId: 99 }]
    })
    assert.equal(card.includes(token), false)
    assert.equal(card.includes('99'), false)
    assert.match(card, /link-info/)
    const kept = filterSubscribers(
      [
        { kind: 'telegram', chatId: 1 },
        { kind: 'telegram', chatId: 2 },
        { kind: 'email', email: 'a@b.co' }
      ],
      { kind: 'telegram', chatId: 1 }
    )
    assert.deepEqual(
      kept.map((s) => s.chatId || s.email),
      [2, 'a@b.co']
    )
    const src = readFileSync(join(import.meta.dirname, '../../../apps/desktop/src/main/fleet-host.ts'), 'utf8')
    assert.match(src, /subscribers: subs/)
    assert.match(src, /filterSubscribers/)
    assert.equal(src.includes('subscribers })'), false)
  })

  it('fleet host starts from recipe argv and never execs a renderer string', () => {
    const src = readFileSync(join(import.meta.dirname, '../../../apps/desktop/src/main/fleet-host.ts'), 'utf8')
    assert.match(src, /recipeSpawn/)
    assert.match(src, /gitCloneHttpsArgv/)
    assert.match(src, /takeSmtpHop|smtpEndpoint/)
    assert.equal(/\bexec\(/.test(src), false)
    assert.equal(/shell:\s*true/.test(src), false)
  })

  it('T-94 domain is a hostname label; clones nest under cloneOf; fork dest is jailed', () => {
    assert.equal(takeSiteDomain('example.com'), 'example.com')
    assert.equal(takeSiteDomain('https://example.com/x'), 'example.com')
    assert.equal(takeSiteDomain('https://user:pass@evil.example/x'), null)
    assert.equal(takeSiteDomain('javascript:alert(1)'), null)
    assert.equal(takeSiteDomain('file:///tmp/x'), null)
    assert.equal(takeSiteDomain('localhost'), 'localhost')
    assert.equal(nextCloneId('link-info', ['link-info']), 'link-info-c2')
    assert.equal(nextCloneId('link-info', ['link-info', 'link-info-c2']), 'link-info-c3')
    assert.equal(nextCloneId('../x', []), null)
    assert.equal(kindFromAddRel('Repos/site'), 'website')
    assert.equal(defaultRecipeForKind('website'), 'npm-dev')
    assert.equal(kindFromAddRel('Repos/Link INFO BOT'), 'telegram-bot')
    assert.equal(defaultRecipeForKind('telegram-bot'), 'python-app-main')
    const forest = stackForest([
      { id: 'hub-bot', cloneOf: 'hub-bot' },
      { id: 'hub-c2', cloneOf: 'hub-bot' },
      { id: 'lost-1', cloneOf: 'missing' }
    ])
    assert.deepEqual(
      forest.map((n) => n.id).sort(),
      ['hub-bot', 'lost-1']
    )
    const hub = forest.find((n) => n.id === 'hub-bot')
    assert.equal(hub.clones[0].id, 'hub-c2')
    const kept = takeRegistry({
      repos: [
        {
          id: 'site-1',
          rel: 'Repos/site-1',
          kind: 'website',
          recipe: 'npm-dev',
          domain: 'https://example.com/path',
          cloneOf: 'site-1'
        },
        {
          id: 'site-c2',
          rel: 'data/fleet/clones/site-c2',
          kind: 'website',
          recipe: 'npm-dev',
          cloneOf: 'site-1',
          domain: 'example.com'
        }
      ],
      admin: true,
      __proto__: { admin: true }
    })
    assert.equal(kept.admin, undefined)
    assert.equal(kept.repos[0].domain, 'example.com')
    assert.equal(kept.repos[0].cloneOf, undefined)
    assert.equal(kept.repos[1].cloneOf, 'site-1')
    const fork = takeFleetCommand('/fleet fork link-info')
    assert.equal(fork.action, 'clone-local')
    assert.equal(fork.fromId, 'link-info')
    assert.equal(takeFleetCommand('/fleet fork ../x').action, 'bad')
    const token = '1234567890:' + 'A'.repeat(30)
    const card = fleetCard({
      repos: [
        { id: 'link-info', kind: 'telegram-bot', running: true },
        { id: 'link-info-c2', kind: 'telegram-bot', cloneOf: 'link-info' },
        { id: 'site-1', kind: 'website', domain: 'example.com' }
      ],
      bots: [{ id: 'hub', username: 'HubBot', token, last4: 'AAAA' }],
      subscribers: [{ kind: 'telegram', chatId: 99 }]
    })
    assert.equal(card.includes(token), false)
    assert.equal(card.includes('99'), false)
    assert.match(card, /link-info-c2/)
    assert.match(card, /example\.com/)
    assert.match(card, /\/fleet fork/)
    const src = readFileSync(join(import.meta.dirname, '../../../apps/desktop/src/main/fleet-host.ts'), 'utf8')
    const cloneFn = src.slice(src.indexOf('async function cloneLocal'), src.indexOf('function patchRepo'))
    assert.match(cloneFn, /data\/fleet\/clones\/\$\{id\}/)
    assert.match(cloneFn, /cloneOf: fromId/)
    assert.equal(cloneFn.includes('src.domain'), false)
    const patchFn = src.slice(src.indexOf('function patchRepo'), src.indexOf('function addSub'))
    assert.match(patchFn, /takeSiteDomain/)
    assert.equal(patchFn.includes('row.rel'), false)
    assert.equal(patchFn.includes('row.cloneOf'), false)
    assert.equal(/fetch\(/.test(src), false)
    assert.equal(/openExternal/.test(src), false)
    const pane = readFileSync(join(import.meta.dirname, '../../../apps/renderer/src/panes/FleetPane.tsx'), 'utf8')
    assert.equal(pane.includes('fleet.mjs'), false)
    assert.match(pane, /fleetPatchRepo/)
    assert.match(pane, /findNode/)
    const css = readFileSync(join(import.meta.dirname, '../../../apps/renderer/src/styles/global.css'), 'utf8')
    assert.match(css, /\.fleet-clone/)
  })
})

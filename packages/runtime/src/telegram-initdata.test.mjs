import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import {
  miniMenuButton,
  resolveMiniAppUrl,
  takeMiniAppUrl,
  takeMiniBody,
  validateTelegramInitData
} from './telegram-initdata.mjs'

function sign(token, fields, nowSec) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(fields)) params.set(k, v)
  params.set('auth_date', String(nowSec))
  const pairs = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  const hash = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex')
  params.set('hash', hash)
  return params.toString()
}

describe('telegram mini app auth', () => {
  it('accepts a fresh signed initData and rejects a bad hash or unpaired shape', () => {
    const token = '1234567890:ABCDEFGHIJKLMNOPQRSTUV'
    const now = Math.floor(Date.now() / 1000)
    const raw = sign(token, { user: JSON.stringify({ id: 42, first_name: 'Ada' }) }, now)
    const ok = validateTelegramInitData(token, raw, now * 1000)
    assert.equal(ok.userId, 42)
    assert.equal(validateTelegramInitData(token, raw.replace(/[a-f0-9]{8}$/, 'ffffffff'), now * 1000), null)
    assert.equal(validateTelegramInitData(token, sign(token, { user: JSON.stringify({ id: 42 }) }, now - 200000), now * 1000), null)
    assert.equal(takeMiniAppUrl('https://glass.example/app'), 'https://glass.example/app')
    assert.equal(takeMiniAppUrl('http://127.0.0.1:18766'), 'http://127.0.0.1:18766')
    assert.equal(takeMiniAppUrl('http://evil.example'), null)
    assert.equal(takeMiniAppUrl('https://user:pass@x.com'), null)
    assert.equal(takeMiniBody({ action: 'chat', task: 'fix auth', mode: 'agent' }).mode, 'agent')
    assert.equal(takeMiniBody({ action: 'rm', task: 'x' }), null)
    assert.equal(takeMiniBody({ action: 'pulse', runId: '../x' }), null)
    assert.equal(takeMiniBody({ action: 'glance' }).action, 'glance')
    assert.equal(takeMiniBody({ action: 'skills' }).action, 'skills')
    assert.equal(takeMiniBody({ action: 'steer', runId: 'mn_1', text: 'keep going <b>' }).text.includes('<'), false)
    assert.equal(takeMiniBody({ action: 'implement', path: '../secret' }), null)
    assert.equal(takeMiniBody({ action: 'implement', path: 'RAG/plans/ship.think.md' }).path, 'RAG/plans/ship.think.md')
    assert.equal(takeMiniBody({ action: 'use', threadId: '../x' }), null)
    assert.equal(takeMiniBody({ action: 'inbox', name: '../x.png', data: 'AAAA' }), null)
    assert.equal(takeMiniBody({ action: 'provider', provider: 'cursor' }).provider, 'cursor')
    assert.equal(takeMiniBody({ action: 'provider', provider: 'root' }), null)
    assert.equal(takeMiniBody({ action: 'health' }).action, 'health')
    assert.equal(takeMiniBody({ action: 'llama' }).action, 'llama')
    assert.equal(takeMiniBody({ action: 'cursor' }).action, 'cursor')
    assert.equal(takeMiniBody({ action: 'mode', mode: 'agent' }).mode, 'agent')
    assert.equal(takeMiniBody({ action: 'mode', mode: 'root' }), null)
    assert.equal(takeMiniBody({ action: 'fleet' }).action, 'fleet')
    assert.equal(takeMiniBody({ action: 'fleet-clone', url: 'file:///tmp/x', id: 'site' }), null)
    assert.equal(takeMiniBody({ action: 'fleet-clone', url: 'https://user:pass@github.com/acme/x.git', id: 'site' }), null)
    assert.equal(takeMiniBody({ action: 'fleet-add', id: 'site', rel: '../secret' }), null)
    assert.equal(takeMiniBody({ action: 'fleet-add', id: 'site', rel: 'Repos/site' }).rel, 'Repos/site')
    assert.equal(takeMiniBody({ action: 'fleet-add', id: 'site', rel: 'Repos/site' }).kind, 'website')
    assert.equal(takeMiniBody({ action: 'fleet-add', id: 'site', rel: 'Repos/site' }).recipe, 'npm-dev')
    assert.equal(takeMiniBody({ action: 'fleet-restart', id: 'site' }).id, 'site')
    assert.equal(takeMiniBody({ action: 'fleet-restart', id: '../x' }), null)
    assert.equal(takeMiniBody({ action: 'fleet-token', token: '1234567890:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }), null)
    assert.equal(takeMiniBody({ action: 'fleet-fork', fromId: 'link-info' }).fromId, 'link-info')
    assert.equal(takeMiniBody({ action: 'fleet-fork', fromId: 'link-info', url: 'https://github.com/acme/x.git' }), null)
    assert.equal(takeMiniBody({ action: 'fleet-fork', fromId: '../x' }), null)
    assert.equal(miniMenuButton('http://evil.example').type, 'default')
    assert.equal(miniMenuButton('https://glass.example/app').type, 'web_app')
    assert.equal(miniMenuButton('https://glass.example/app').web_app.url, 'https://glass.example/app')
    assert.equal(resolveMiniAppUrl(''), 'http://127.0.0.1:18766')
    assert.equal(resolveMiniAppUrl('https://glass.example'), 'https://glass.example')
  })
})

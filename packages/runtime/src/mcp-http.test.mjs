import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseSseJsonRpc, sanitizeMcpEnv, sanitizeMcpHeaders, takeMcpServerCfg } from './mcp-http.mjs'

describe('parseSseJsonRpc', () => {
  it('reads a JSON body', () => {
    const msg = parseSseJsonRpc(JSON.stringify({ jsonrpc: '2.0', id: 3, result: { ok: true } }), 3)
    assert.deepEqual(msg.result, { ok: true })
  })

  it('reads an SSE data event with matching id', () => {
    const body = 'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"tools":[]}}\n\n'
    const msg = parseSseJsonRpc(body, 2)
    assert.deepEqual(msg.result, { tools: [] })
  })

  it('skips other ids', () => {
    const body =
      'data: {"jsonrpc":"2.0","id":1,"result":{"no":true}}\n\ndata: {"jsonrpc":"2.0","id":9,"result":{"yes":true}}\n\n'
    const msg = parseSseJsonRpc(body, 9)
    assert.equal(msg.result.yes, true)
  })
})

describe('mcp header/env allowlists', () => {
  it('drops hop-by-hop and newline headers', () => {
    const h = sanitizeMcpHeaders({
      Authorization: 'Bearer x',
      Host: 'evil',
      'X-Ok': '1',
      Bad: 'a\nb'
    })
    assert.deepEqual(h, { Authorization: 'Bearer x', 'X-Ok': '1' })
  })

  it('drops loader-style env keys', () => {
    const env = sanitizeMcpEnv({ FOO: '1', NODE_OPTIONS: '--require x', LD_PRELOAD: '/x' })
    assert.deepEqual(env, { FOO: '1' })
  })

  it('copies known mcp server fields only', () => {
    const cfg = takeMcpServerCfg({
      url: 'https://mcp.example/mcp',
      headers: { Authorization: 'Bearer t' },
      extra: { rce: true },
      command: undefined
    })
    assert.equal(cfg.url, 'https://mcp.example/mcp')
    assert.equal(cfg.headers.Authorization, 'Bearer t')
    assert.equal(cfg.extra, undefined)
    assert.equal(takeMcpServerCfg({ __proto__: { command: 'x' } }), null)
  })
})

describe('live HTTP MCP handshake', () => {
  it('initialize then tools/list against a local streamable JSON server', async () => {
    const { createServer } = await import('node:http')
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => {
        raw += c
      })
      req.on('end', () => {
        let msg = {}
        try {
          msg = JSON.parse(raw || '{}')
        } catch {
          msg = {}
        }
        res.setHeader('content-type', 'application/json')
        res.setHeader('mcp-session-id', 'sess-fixture')
        if (msg.method === 'initialize') {
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'fixture' } }
            })
          )
          return
        }
        if (msg.method === 'notifications/initialized') {
          res.statusCode = 202
          res.end()
          return
        }
        if (msg.method === 'tools/list') {
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: { tools: [{ name: 'ping', description: 'ping', inputSchema: { type: 'object', properties: {} } }] }
            })
          )
          return
        }
        res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { message: 'unknown' } }))
      })
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address()
    const url = `http://127.0.0.1:${port}/mcp`
    const init = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'home-ai' } }
      })
    })
    const initMsg = parseSseJsonRpc(await init.text(), 1)
    assert.equal(initMsg.result.serverInfo.name, 'fixture')
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })
    })
    const listed = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
    })
    const listMsg = parseSseJsonRpc(await listed.text(), 2)
    assert.equal(listMsg.result.tools[0].name, 'ping')
    server.close()
  })
})

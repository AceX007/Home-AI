import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { join, resolve } from 'node:path'
import { coderLlamaArgs, jailedCoderModelPath } from './coder-args.mjs'

describe('coder sidecar args', () => {
  it('binds loopback, caps ctx, halves ngl, uses coder port', () => {
    const args = coderLlamaArgs(
      {
        cpuThreads: 8,
        nGpuLayers: 99,
        contextSize: 8192,
        batchSize: 256,
        profile: 'standard'
      },
      '/ws/Qwen2.5-Coder-1.5B-Instruct-Q8_0.gguf',
      8766
    )
    assert.equal(args.host, '127.0.0.1')
    assert.equal(args.host.includes('0.0.0.0'), false)
    assert.equal(args.port, 8766)
    assert.equal(args.contextSize, 2048)
    assert.equal(args.nGpuLayers, 49)
    assert.equal(args.flashAttn, true)
    const tiny = coderLlamaArgs({ nGpuLayers: 0, contextSize: 1024, profile: 'cpu', cpuThreads: 4 }, 'm.gguf')
    assert.equal(tiny.port, 8766)
    assert.equal(tiny.nGpuLayers, 0)
    assert.equal(tiny.contextSize, 1024)
    assert.equal(tiny.host, '127.0.0.1')
    assert.equal(tiny.flashAttn, false)
  })

  it('jails GGUF names under the workspace root', () => {
    const root = '/home/x/Home AI'
    const ok = jailedCoderModelPath(root, 'Qwen2.5-Coder-1.5B-Instruct-Q8_0.gguf')
    assert.equal(ok, resolve(join(root, 'Qwen2.5-Coder-1.5B-Instruct-Q8_0.gguf')))
    assert.equal(jailedCoderModelPath(root, '../etc/passwd'), null)
    assert.equal(jailedCoderModelPath(root, '/etc/passwd.gguf'), null)
    assert.equal(jailedCoderModelPath(root, 'foo/bar.gguf'), null)
    assert.equal(jailedCoderModelPath(root, ''), null)
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import { assertInside, gitPathspecs, jailPath, takeFsRootId, extraRootById } from './paths.mjs'
import { sanitizeExtraRoot } from './policy.mjs'

function tmp() {
  return mkdtempSync(join(tmpdir(), 'homeai-jail-'))
}

describe('assertInside', () => {
  it('allows a relative file under root', () => {
    const root = tmp()
    writeFileSync(join(root, 'ok.txt'), 'x')
    assert.equal(assertInside(root, 'ok.txt'), join(root, 'ok.txt'))
  })

  it('rejects parent traversal', () => {
    const root = tmp()
    assert.throws(() => assertInside(root, '../secret'), /escapes workspace/)
  })

  it('rejects an absolute path outside the root', () => {
    const root = tmp()
    assert.throws(() => assertInside(root, '/etc/passwd'), /escapes workspace/)
  })

  it('rejects a symlink that points outside the root', () => {
    const root = tmp()
    const outside = tmp()
    writeFileSync(join(outside, 'leak.txt'), 'no')
    symlinkSync(join(outside, 'leak.txt'), join(root, 'link.txt'))
    assert.throws(() => assertInside(root, 'link.txt'), /escapes workspace/)
  })

  it('allows an opt-in extra root absolute and still rejects others', () => {
    const root = tmp()
    const extra = tmp()
    writeFileSync(join(extra, 'doc.txt'), 'y')
    const hit = jailPath(root, join(extra, 'doc.txt'), [extra])
    assert.equal(hit.extra, true)
    assert.equal(hit.path, join(extra, 'doc.txt'))
    assert.throws(() => jailPath(root, '/etc/passwd', [extra]), /escapes workspace/)
    assert.equal(sanitizeExtraRoot('/'), null)
    assert.equal(sanitizeExtraRoot(homedir()), null)
    assert.equal(sanitizeExtraRoot('Documents'), null)
    const docs = join(homedir(), 'Documents')
    assert.equal(sanitizeExtraRoot(docs), docs)
    assert.equal(sanitizeExtraRoot('/tmp/data/secrets/key'), null)
  })

  it('resolves extra-root by folder basename, never a raw path', () => {
    const root = tmp()
    const extra = tmp()
    writeFileSync(join(extra, 'doc.txt'), 'y')
    const id = extra.split(/[/\\]/).filter(Boolean).pop()
    const hit = jailPath(root, 'doc.txt', [extra], id)
    assert.equal(hit.extra, true)
    assert.equal(hit.path, join(extra, 'doc.txt'))
    assert.equal(takeFsRootId('workspace'), '')
    assert.throws(() => takeFsRootId('../etc'), /escapes workspace/)
    assert.throws(() => takeFsRootId('/etc/passwd'), /escapes workspace/)
    assert.throws(() => takeFsRootId('__proto__'), /escapes workspace/)
    assert.throws(() => takeFsRootId({ path: '/etc/passwd' }), /escapes workspace/)
    assert.throws(() => extraRootById([extra], 'no-such-root'), /escapes workspace/)
    assert.throws(() => jailPath(root, 'doc.txt', [extra], '../x'), /escapes workspace/)
    const twin = tmp()
    const leaf = extra.split(/[/\\]/).filter(Boolean).pop()
    const twinNamed = join(twin, leaf)
    mkdirSync(twinNamed)
    assert.throws(() => extraRootById([extra, twinNamed], leaf), /escapes workspace/)
    assert.throws(() => jailPath(root, '/etc/passwd', [extra], id), /escapes workspace/)
    assert.equal(jailPath(root, 'ok.txt', [extra]).extra, false)
  })
})

describe('gitPathspecs', () => {
  it('returns posix relatives and rejects root', () => {
    const root = tmp()
    mkdirSync(join(root, 'src'))
    writeFileSync(join(root, 'src', 'a.ts'), '')
    assert.deepEqual(gitPathspecs(root, ['src/a.ts']), ['src/a.ts'])
    assert.throws(() => gitPathspecs(root, [root]), /refuse workspace root/)
    assert.throws(() => gitPathspecs(root, ['../x']), /escapes workspace/)
  })

  it('ignores non-strings and empty entries', () => {
    const root = tmp()
    writeFileSync(join(root, 'a.ts'), '')
    assert.deepEqual(gitPathspecs(root, [null, '', 'a.ts', 1]), ['a.ts'])
  })
})

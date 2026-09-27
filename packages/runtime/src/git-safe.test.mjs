import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { gitPullArgv, gitPushArgv, takeGitHttpsUrl, gitCloneHttpsArgv, parseGitLineChanges } from './git-safe.mjs'

describe('git pull argv', () => {
  it('is ff-only and rejects extra remotes or refs', () => {
    assert.deepEqual(gitPullArgv(), ['pull', '--ff-only'])
    assert.throws(() => gitPullArgv('origin'), /no extra args/)
    assert.throws(() => gitPullArgv('--rebase'), /no extra args/)
  })
})

describe('git push argv', () => {
  it('is upstream-only and rejects extra remotes or refs', () => {
    assert.deepEqual(gitPushArgv(), ['push'])
    assert.throws(() => gitPushArgv('origin'), /no extra args/)
    assert.throws(() => gitPushArgv('HEAD:main'), /no extra args/)
  })
})

describe('git clone argv', () => {
  it('is https-only with a jailed dest basename', () => {
    assert.equal(takeGitHttpsUrl('https://github.com/acme/x.git'), 'https://github.com/acme/x.git')
    assert.equal(takeGitHttpsUrl('file:///etc/passwd'), null)
    assert.deepEqual(gitCloneHttpsArgv('https://github.com/acme/x.git', 'x-clone'), [
      'clone',
      '--depth',
      '1',
      '--',
      'https://github.com/acme/x.git',
      'x-clone'
    ])
    assert.throws(() => gitCloneHttpsArgv('https://github.com/acme/x.git', '../etc'), /bad clone dest/)
  })
})

describe('git line gutters — T-130', () => {
  it('parses unified added lines and drops traversal paths', () => {
    const rows = parseGitLineChanges(`diff --git a/a.ts b/a.ts
index 111..222 100644
--- a/a.ts
+++ b/a.ts
@@ -12,0 +13,2 @@
+one
+two
@@ -20 +20 @@
-old
+new
diff --git a/x b/../etc/passwd
--- a/x
+++ b/../etc/passwd
@@ -1 +1 @@
-a
+b
`)
    assert.deepEqual(rows['a.ts'].added, [13, 14, 20])
    assert.deepEqual(rows['a.ts'].removed, [20])
    assert.equal(rows['../etc/passwd'], undefined)
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { aboutMeRule, loadProfile, saveProfile, takeProfile } from './profile.mjs'

describe('profile store', () => {
  it('T-11 takes own keys only and drops markup / bad enums', () => {
    const p = takeProfile({
      displayName: '<img>Ada',
      defaultMode: 'root',
      defaultProvider: 'root',
      standingGoal: 'ship',
      pinnedSkill: 'Hunt Prevent!!',
      telegramNotifyDesktopRuns: 'yes',
      aboutMe: 'hello <script>',
      miniAppUrl: 'http://evil.example',
      admin: true,
      __proto__: { admin: true }
    })
    assert.equal(p.displayName.includes('<'), false)
    assert.equal(p.defaultMode, 'ask')
    assert.equal(p.defaultProvider, 'local')
    assert.equal(takeProfile({ defaultProvider: 'cursor' }).defaultProvider, 'cursor')
    assert.equal(p.pinnedSkill, 'huntprevent')
    assert.equal(p.telegramNotifyDesktopRuns, false)
    assert.equal(p.aboutMe.includes('<'), false)
    assert.equal(p.miniAppUrl, '')
    assert.equal(p.admin, undefined)
    assert.equal(takeProfile({ miniAppUrl: 'https://glass.example/app' }).miniAppUrl, 'https://glass.example/app')
  })

  it('persists a patch without mass-assign', () => {
    const root = mkdtempSync(join(tmpdir(), 'homeai-p-'))
    try {
      const next = saveProfile(root, { displayName: 'Ada', defaultMode: 'think', extra: 'nope' })
      assert.equal(next.displayName, 'Ada')
      assert.equal(next.defaultMode, 'think')
      assert.equal(JSON.parse(readFileSync(join(root, 'data', 'homeai-profile.json'), 'utf8')).extra, undefined)
      assert.equal(loadProfile(root).displayName, 'Ada')
      const rule = aboutMeRule(loadProfile(root))
      assert.equal(rule.alwaysApply, true)
      assert.match(rule.body, /Ada/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

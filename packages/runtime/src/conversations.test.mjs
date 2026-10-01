import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  HOME_THREAD_ID,
  appendTurn,
  bindTelegram,
  chatThreadId,
  createThread,
  ensureHomeThread,
  formatChatLog,
  getThread,
  listThreads,
  loadActiveThreadId,
  saveActiveThreadId,
  telegramChatId,
  isTelegramGroupChat,
  threadForTelegram,
  renameThread,
  archiveThread,
  deleteThread
} from './conversations.mjs'

function tmp() {
  return mkdtempSync(join(tmpdir(), 'homeai-c-'))
}

describe('conversation store', () => {
  it('jails thread ids and telegram chat ids', () => {
    assert.equal(chatThreadId('chat_home'), 'chat_home')
    assert.equal(chatThreadId('../secret'), null)
    assert.equal(chatThreadId('chat/../x'), null)
    assert.equal(telegramChatId(12), 12)
    assert.equal(telegramChatId(-1001234567890), -1001234567890)
    assert.equal(isTelegramGroupChat(-1001234567890), true)
    assert.equal(isTelegramGroupChat(12), false)
    assert.equal(telegramChatId(0), null)
    assert.equal(telegramChatId('nope'), null)
  })

  it('creates Home, appends turns, and is idempotent on runId', () => {
    const root = tmp()
    try {
      const home = ensureHomeThread(root)
      assert.equal(home.id, HOME_THREAD_ID)
      appendTurn(root, HOME_THREAD_ID, { role: 'user', text: 'hi <b>', runId: 'run1' })
      appendTurn(root, HOME_THREAD_ID, { role: 'user', text: 'hi <b>', runId: 'run1' })
      const t = getThread(root, HOME_THREAD_ID)
      assert.equal(t.turns.length, 1)
      assert.equal(t.turns[0].text.includes('<'), false)
      appendTurn(root, HOME_THREAD_ID, {
        role: 'assistant',
        text: 'ok token=sk-abc12345678',
        runId: 'run1'
      })
      const log = formatChatLog(getThread(root, HOME_THREAD_ID))
      assert.match(log, /user: hi/)
      assert.equal(log.includes('sk-abc'), false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('binds one telegram chat to one thread', () => {
    const root = tmp()
    try {
      const a = threadForTelegram(root, 99)
      assert.equal(a.id, HOME_THREAD_ID)
      assert.equal(a.telegramChatId, 99)
      const group = threadForTelegram(root, -100555, { title: 'Ship <b>crew' })
      assert.notEqual(group.id, HOME_THREAD_ID)
      assert.equal(group.telegramChatId, -100555)
      assert.equal(group.title.includes('<'), false)
      assert.equal(getThread(root, HOME_THREAD_ID).telegramChatId, 99)
      const extra = createThread(root, 'Other')
      bindTelegram(root, extra.id, 99)
      assert.equal(getThread(root, HOME_THREAD_ID).telegramChatId, undefined)
      assert.equal(getThread(root, extra.id).telegramChatId, 99)
      const ids = listThreads(root).map((x) => x.id)
      assert.equal(ids.includes(HOME_THREAD_ID), true)
      saveActiveThreadId(root, extra.id)
      assert.equal(loadActiveThreadId(root), extra.id)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects unknown thread ids on append', () => {
    const root = tmp()
    try {
      assert.throws(() => appendTurn(root, 'chat_missing', { role: 'user', text: 'x' }), /missing thread/)
      assert.throws(() => appendTurn(root, '../x', { role: 'user', text: 'x' }), /missing thread|bad thread/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('archive hides a thread and delete refuses Home and traversal', () => {
    const root = tmp()
    try {
      const extra = createThread(root, 'Ship')
      appendTurn(root, extra.id, { role: 'user', text: 'keep me' })
      archiveThread(root, extra.id)
      assert.equal(listThreads(root).some((row) => row.id === extra.id), false)
      assert.equal(getThread(root, extra.id)?.archived, true)
      assert.equal(getThread(root, extra.id)?.turns.length, 1)
      assert.throws(() => deleteThread(root, HOME_THREAD_ID), /refused/)
      assert.throws(() => deleteThread(root, '../secret'), /refused|bad thread/)
      assert.equal(deleteThread(root, extra.id).ok, true)
      assert.equal(getThread(root, extra.id), null)
      assert.equal(getThread(root, HOME_THREAD_ID)?.id, HOME_THREAD_ID)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('renameThread strips markup from titles', () => {
    const root = tmp()
    try {
      const t = createThread(root, 'ok')
      const n = renameThread(root, t.id, '<img src=x>Hi')
      assert.equal(n.title.includes('<'), false)
      assert.match(n.title, /Hi/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

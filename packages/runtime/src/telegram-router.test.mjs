import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { consumePair, startPairing } from './telegram-auth.mjs'
import { parseCallback, routeTelegram, takeBotIdentity, takeTelegramInbox } from './telegram-router.mjs'

function msg(text, from = 42, type = 'private', extra = {}) {
  const chatId = extra.chatId ?? from
  return {
    message: {
      text,
      from: { id: from },
      chat: { id: chatId, type, title: extra.title },
      message_thread_id: extra.topicId,
      reply_to_message: extra.reply,
      entities: extra.entities
    }
  }
}

describe('telegram router', () => {
  it('denies strangers and ignores channels', () => {
    assert.equal(routeTelegram(msg('hello')).kind, 'deny')
    assert.equal(routeTelegram(msg('/do rm -rf', 1, 'channel', { chatId: -1001 })).kind, 'ignore')
    assert.equal(routeTelegram(msg('/start')).kind, 'need-pair')
    assert.equal(routeTelegram(msg('/tools')).kind, 'deny')
    assert.equal(routeTelegram(msg('/stage')).kind, 'deny')
    assert.equal(routeTelegram(msg('/mcp reload')).kind, 'deny')
    assert.equal(routeTelegram(msg('/agent do it')).kind, 'deny')
    assert.equal(parseCallback('../x'), null)
    assert.equal(parseCallback('run:job.1').id, 'job.1')
    assert.equal(takeBotIdentity({ id: 7, username: 'HomeAIBot' }).username, 'HomeAIBot')
    assert.equal(takeBotIdentity({ id: -3, username: 'HomeAIBot' }), null)
  })

  it('pairs then routes commands for that user only', () => {
    const now = Date.now()
    const started = startPairing({}, now)
    const paired = consumePair(started.state, started.code, 42, now + 10)
    const bot = { id: 7, username: 'HomeAIBot' }
    const ctx = { state: paired.state, bot }
    assert.equal(routeTelegram(msg('/pair ' + started.code), { state: started.state }).kind, 'pair')
    assert.equal(routeTelegram(msg('/do fix auth'), ctx).kind, 'run')
    assert.equal(routeTelegram(msg('/do fix auth'), ctx).mode, 'agent')
    assert.equal(routeTelegram(msg('/agent implement login'), ctx).mode, 'agent')
    assert.equal(routeTelegram(msg('/tools'), ctx).kind, 'tools')
    assert.equal(routeTelegram(msg('/mcp'), ctx).kind, 'mcp-reload')
    assert.equal(routeTelegram(msg('/mcp reload'), ctx).kind, 'mcp-reload')
    assert.equal(routeTelegram(msg('/debug fix the pane'), ctx).mode, 'debug')
    assert.equal(routeTelegram(msg('/plan ship auth'), ctx).mode, 'plan')
    assert.equal(routeTelegram(msg('Pulse'), ctx).kind, 'status')
    assert.equal(routeTelegram(msg('/stage'), ctx).kind, 'stage')
    assert.equal(routeTelegram(msg('Stage'), ctx).kind, 'stage')
    assert.equal(routeTelegram(msg('Trust'), ctx).kind, 'manage')
    assert.equal(routeTelegram(msg('New'), ctx).kind, 'new-chat')
    assert.equal(routeTelegram(msg('Skills'), ctx).kind, 'skills')
    assert.equal(routeTelegram(msg('/new'), ctx).kind, 'new-chat')
    assert.equal(routeTelegram(msg('/skills'), ctx).kind, 'skills')
    assert.equal(routeTelegram(msg('/menu'), ctx).kind, 'menu')
    assert.equal(routeTelegram(msg('/app'), ctx).kind, 'app')
    assert.equal(routeTelegram(msg('/manage'), ctx).kind, 'manage')
    assert.equal(routeTelegram(msg('Manage'), ctx).kind, 'manage')
    assert.equal(routeTelegram(msg('/mind cursor'), ctx).kind, 'mind')
    assert.equal(routeTelegram(msg('/mind cursor'), ctx).mind, 'cursor')
    assert.equal(routeTelegram(msg('/mind local'), ctx).mind, 'local')
    assert.equal(routeTelegram(msg('/mind root'), ctx).kind, 'deny')
    assert.equal(routeTelegram(msg('/mind'), ctx).kind, 'health')
    assert.equal(routeTelegram(msg('/cursor'), ctx).kind, 'cursor')
    assert.equal(routeTelegram(msg('/llama'), ctx).kind, 'llama')
    assert.equal(routeTelegram(msg('/fleet'), ctx).kind, 'fleet')
    assert.equal(routeTelegram(msg('/fleet'), ctx).action, 'status')
    assert.equal(routeTelegram(msg('/fleet clone file:///tmp/x site'), ctx).kind, 'deny')
    assert.equal(routeTelegram(msg('/fleet token 1234567890:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'), ctx).action, 'denied-token')
    const cloned = routeTelegram(msg('/fleet clone https://github.com/acme/site.git site-clone'), ctx)
    assert.equal(cloned.kind, 'fleet')
    assert.equal(cloned.action, 'clone')
    assert.equal(cloned.id, 'site-clone')
    assert.equal(cloned.text, 'https://github.com/acme/site.git')
    const added = routeTelegram(msg('/fleet add link-info Repos/Link INFO BOT'), ctx)
    assert.equal(added.kind, 'fleet')
    assert.equal(added.action, 'add')
    assert.equal(added.id, 'link-info')
    assert.equal(added.rel, 'Repos/Link INFO BOT')
    const forked = routeTelegram(msg('/fleet fork link-info'), ctx)
    assert.equal(forked.kind, 'fleet')
    assert.equal(forked.action, 'clone-local')
    assert.equal(forked.fromId, 'link-info')
    assert.equal(routeTelegram(msg('Fleet'), ctx).kind, 'fleet')
    assert.equal(routeTelegram(msg('Cursor'), ctx).kind, 'mind')
    assert.equal(routeTelegram(msg('Local'), ctx).mind, 'local')
    const photo = routeTelegram(
      {
        message: {
          photo: [{ file_id: 'AgACAgIAAxkBAAIBtest12', file_size: 800 }],
          from: { id: 42 },
          chat: { id: 42, type: 'private' }
        }
      },
      ctx
    )
    assert.equal(photo.kind, 'inbox-file')
    assert.equal(photo.name, 'photo.jpg')
    const voice = takeTelegramInbox({ voice: { file_id: 'AwACAgIAAxkBAAIBvoice12', file_size: 800, mime_type: 'audio/ogg' } })
    assert.equal(voice.name, 'voice.ogg')
    assert.equal(voice.fileId, 'AwACAgIAAxkBAAIBvoice12')
    const audio = takeTelegramInbox({ audio: { file_id: 'AwACAgIAAxkBAAIBaudio12', file_size: 900 } })
    assert.equal(audio.name, 'audio.mp3')
    assert.equal(takeTelegramInbox({ voice: { file_id: 'AwACAgIAAxkBAAIBvoice12', file_size: 3_000_000 } }), null)
    assert.equal(takeTelegramInbox({ video_note: { file_id: 'AwACAgIAAxkBAAIBvn123456', file_size: 800 } }), null)
    const voiceMsg = routeTelegram(
      {
        message: {
          voice: { file_id: 'AwACAgIAAxkBAAIBvoice12', file_size: 800 },
          from: { id: 42 },
          chat: { id: 42, type: 'private' }
        }
      },
      ctx
    )
    assert.equal(voiceMsg.kind, 'inbox-file')
    assert.equal(voiceMsg.name, 'voice.ogg')
    assert.equal(
      routeTelegram(
        {
          message: {
            photo: [{ file_id: '../x', file_size: 800 }],
            from: { id: 42 },
            chat: { id: 42, type: 'private' }
          }
        },
        ctx
      ).kind,
      'ignore'
    )
    assert.equal(routeTelegram(msg('what is boot?'), ctx).kind, 'chat')
    assert.equal(routeTelegram(msg('/use chat_home'), ctx).threadId, 'chat_home')
    assert.equal(routeTelegram(msg('/use ../secret'), ctx).kind, 'deny')
    assert.equal(routeTelegram(msg('/skill new Ship Fast'), ctx).kind, 'skill-new')
    const body = routeTelegram(msg('Use the kernel loop.'), {
      state: paired.state,
      pending: { kind: 'skill-new', name: 'Ship Fast' }
    })
    assert.equal(body.kind, 'skill-body')
    const cb = routeTelegram(
      { callback_query: { id: '1', data: 'ok:job.1', from: { id: 42 }, message: { chat: { id: 42, type: 'private' } } } },
      ctx
    )
    assert.equal(cb.kind, 'callback')
    assert.equal(cb.action, 'ok')
    assert.equal(cb.id, 'job.1')
    const stranger = routeTelegram(
      { callback_query: { id: '2', data: 'ok:job.1', from: { id: 99 }, message: { chat: { id: 99, type: 'private' } } } },
      ctx
    )
    assert.equal(stranger.kind, 'deny')
  })

  it('lets the paired user work in a group without authorizing the room', () => {
    const now = Date.now()
    const started = startPairing({}, now)
    const paired = consumePair(started.state, started.code, 42, now + 10)
    const bot = { id: 7, username: 'HomeAIBot' }
    const ctx = { state: paired.state, bot }
    const g = (text, from = 42, extra = {}) => msg(text, from, 'supergroup', { chatId: -100123, title: 'Crew', ...extra })

    const run = routeTelegram(g('/do@HomeAIBot fix auth'), ctx)
    assert.equal(run.kind, 'run')
    assert.equal(run.mode, 'agent')
    assert.equal(run.chatId, -100123)
    assert.equal(run.surface, 'group')

    assert.equal(routeTelegram(g('lunch?'), ctx).kind, 'ignore')
    assert.equal(
      routeTelegram(
        {
          message: {
            photo: [{ file_id: 'AgACAgIAAxkBAAIBtest12', file_size: 800 }],
            from: { id: 42 },
            chat: { id: -100123, type: 'supergroup', title: 'Crew' }
          }
        },
        ctx
      ).kind,
      'ignore'
    )
    assert.equal(routeTelegram(g('/do steal the box', 99), ctx).kind, 'ignore')
    assert.equal(routeTelegram(g('/pair ABCDEFGH'), ctx).kind, 'pair-dm')
    assert.equal(routeTelegram(g('/do@OtherBot x'), ctx).kind, 'ignore')

    const mentioned = routeTelegram(g('@HomeAIBot why is boot slow'), ctx)
    assert.equal(mentioned.kind, 'chat')
    assert.equal(mentioned.task.includes('@HomeAIBot'), false)

    const reply = routeTelegram(g('continue the patch', 42, { reply: { from: { id: 7, is_bot: true } } }), ctx)
    assert.equal(reply.kind, 'chat')

    const topic = routeTelegram(g('/status', 42, { topicId: 17 }), ctx)
    assert.equal(topic.kind, 'status')
    assert.equal(topic.topicId, 17)
    const staged = routeTelegram(g('/stage', 42, { topicId: 17 }), ctx)
    assert.equal(staged.kind, 'stage')
    assert.equal(staged.chatId, -100123)
    assert.equal(staged.surface, 'group')
    assert.equal(routeTelegram(g('/stage', 99), ctx).kind, 'ignore')

    const hello = routeTelegram({
      my_chat_member: {
        chat: { id: -100123, type: 'supergroup', title: 'Crew' },
        new_chat_member: { status: 'member' }
      }
    })
    assert.equal(hello.kind, 'group-hello')
    assert.equal(hello.chatId, -100123)

    const groupCb = routeTelegram(
      {
        callback_query: {
          id: '3',
          data: 'run:job.1',
          from: { id: 42 },
          message: { chat: { id: -100123, type: 'supergroup' }, message_thread_id: 17 }
        }
      },
      ctx
    )
    assert.equal(groupCb.kind, 'callback')
    assert.equal(groupCb.chatId, -100123)
    assert.equal(groupCb.topicId, 17)

    const otherClick = routeTelegram(
      {
        callback_query: {
          id: '4',
          data: 'ok:job.1',
          from: { id: 99 },
          message: { chat: { id: -100123, type: 'supergroup' } }
        }
      },
      ctx
    )
    assert.equal(otherClick.kind, 'deny')
  })
})

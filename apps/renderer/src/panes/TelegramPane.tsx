import { useEffect, useState } from 'react'
import type { HomeProfile } from '@homeai/core'
import { HxEmpty, HxPage } from '../layout/HxPage'
import { useWorkbench } from '../store/useWorkbench'

type Session = {
  configured: boolean
  online: boolean
  peers: number[]
  pairing: { exp: number } | null
  mode: string
  mind: string
  llama: string
  keys: string
  cursor: string
  live: Array<{ id: string; title: string; mode: string }>
  threads: Array<{ id: string; title: string }>
  glass: boolean
}

export default function TelegramPane() {
  const w = useWorkbench()
  const [session, setSession] = useState<Session | null>(null)
  const [pairCode, setPairCode] = useState('')
  const [msg, setMsg] = useState('')
  const [home, setHome] = useState<HomeProfile | null>(null)

  const refresh = async () => {
    try {
      const s = (await window.homeai.telegramSession()) as Session
      setSession(s)
      useWorkbench.setState({ telegramOnline: Boolean(s.online || s.configured) })
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void window.homeai.profileGet().then((p) => setHome(p as HomeProfile))
    void refresh()
    const t = setInterval(() => void refresh(), 2500)
    return () => clearInterval(t)
  }, [])

  const setMind = async (mind: HomeProfile['defaultProvider']) => {
    const next = (await window.homeai.profileSet({ defaultProvider: mind })) as HomeProfile
    setHome(next)
    await refresh()
    setMsg(`mind · ${next.defaultProvider}`)
  }

  const setMode = async (mode: HomeProfile['defaultMode']) => {
    const next = (await window.homeai.profileSet({ defaultMode: mode })) as HomeProfile
    setHome(next)
    await refresh()
    setMsg(`mode · ${next.defaultMode}`)
  }

  return (
    <HxPage
      title="Telegram"
      lead="Same kernel as the phone. Pair once, then Manage on the glass and this pane stay in lockstep. Ready follows a live or configured session."
      actions={
        <button type="button" className="ghost" onClick={() => void refresh()}>
          Refresh
        </button>
      }
    >
    <div className="hx-form">
      {!session && !msg ? (
        <HxEmpty compact title="Loading session" body="Asking the kernel for the Telegram DTO. Pairing and mind stay on this page." />
      ) : null}
      {msg ? <div className="warn-banner">{msg}</div> : null}

      <div className="hx-card">
        <strong>
          {session?.online ? 'LIVE' : session?.configured ? 'TOKEN' : 'OFF'} · mind {session?.mind || 'local'}
        </strong>
        <p className="hx-mono">
          llama {session?.llama || 'off'} · keys {session?.keys || 'none'} · cursor {session?.cursor || 'off'}
          {session?.glass ? ' · glass on' : ''}
        </p>
        <div className="hx-row">
          <button
            className="ghost"
            onClick={async () => {
              await window.homeai.telegramRestart()
              await refresh()
              setMsg('poller restarted')
            }}
          >
            Restart poller
          </button>
          <button
            className="ghost"
            onClick={async () => {
              await window.homeai.llmStart()
              await refresh()
              setMsg('llama warm requested')
            }}
          >
            Load 2B
          </button>
        </div>
      </div>

      <div className="hx-card">
        <strong>Mind</strong>
        <div className="hx-row">
          {(['local', 'openai', 'openrouter', 'cursor'] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={session?.mind === id ? 'ghost primary' : 'ghost'}
              onClick={() => void setMind(id)}
            >
              {id}
            </button>
          ))}
        </div>
        <label>Mode</label>
        <select
          value={home?.defaultMode || session?.mode || 'ask'}
          onChange={(e) => void setMode(e.target.value as HomeProfile['defaultMode'])}
        >
          <option value="ask">ask</option>
          <option value="think">think</option>
          <option value="agent">agent</option>
        </select>
      </div>

      <div className="hx-card">
        <strong>Pair</strong>
        <p className="hx-hint">
          Private chat only. Send the code to the bot. Shown once.
        </p>
        <button
          type="button"
          className="ghost"
          onClick={async () => {
            const p = await window.homeai.telegramPairStart()
            setPairCode(p.code)
            await refresh()
          }}
        >
          Pair phone
        </button>
        {pairCode ? <p className="hx-mono">/pair {pairCode}</p> : null}
        {(session?.peers ?? []).length ? (
          <p className="hx-hint">
            Paired ids:{' '}
            {session?.peers.map((id) => (
              <span key={id}>
                {id}{' '}
                <button
                  type="button"
                  className="ghost tiny"
                  onClick={async () => {
                    await window.homeai.telegramUnpair(id)
                    await refresh()
                  }}
                >
                  unpair
                </button>
              </span>
            ))}
          </p>
        ) : (
          <p className="hx-hint">No paired users yet.</p>
        )}
      </div>

      <div className="hx-card">
        <strong>Live jobs</strong>
        {(session?.live ?? []).length ? (
          session?.live.map((job) => (
            <div key={job.id} className="hx-row">
              <span className="hx-mono">
                {job.mode} · {job.title}
              </span>
              <button className="ghost tiny" onClick={() => window.homeai.stopAgent(job.id)}>
                Halt
              </button>
            </div>
          ))
        ) : (
          <p className="hx-hint">No phone jobs.</p>
        )}
      </div>

      <div className="hx-card">
        <strong>Phone threads</strong>
        {(session?.threads ?? []).length ? (
          session?.threads.map((t) => (
            <button
              key={t.id}
              type="button"
              className="ghost"
              onClick={async () => {
                await window.homeai.threadSelect(t.id)
                await w.load()
                useWorkbench.setState({ chatOpen: true })
                setMsg(`now on ${t.id}`)
              }}
            >
              {t.title}
            </button>
          ))
        ) : (
          <p className="hx-hint">No Telegram threads yet. Pair, then talk.</p>
        )}
      </div>
    </div>
    </HxPage>
  )
}

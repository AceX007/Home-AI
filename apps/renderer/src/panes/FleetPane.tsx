import { useEffect, useState } from 'react'
import { HxEmpty, HxPage } from '../layout/HxPage'

type Tab = 'stacks' | 'sites' | 'bots' | 'accounts' | 'broadcasts' | 'email'
type Repo = {
  id: string
  title: string
  kind: string
  rel: string
  recipe: string
  cloneOf?: string
  domain?: string
  running?: boolean
}
type Node = Repo & { clones: Node[] }
type Bot = { id: string; role: string; repoId: string; username: string; hasToken: boolean; last4: string }
type Account = { id: string; label: string; hasSession: boolean; last4: string }
type Sub = { kind: string; chatId?: number; email?: string; botId?: string }
type Snap = {
  repos: Repo[]
  bots: Bot[]
  accounts: Account[]
  subscribers: Sub[]
  smtp: { provider: string; user: string; hasPass: boolean }
  recipes: string[]
  kinds: string[]
  smtpProviders: string[]
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'stacks', label: 'Telegram stacks' },
  { id: 'sites', label: 'Websites' },
  { id: 'bots', label: 'Bot fleet' },
  { id: 'accounts', label: 'TG accounts' },
  { id: 'broadcasts', label: 'Bot broadcasts' },
  { id: 'email', label: 'Email' }
]

function nestRepos(repos: Repo[]): Node[] {
  const byId = new Map<string, Node>()
  for (const r of repos) byId.set(r.id, { ...r, clones: [] })
  const roots: Node[] = []
  for (const r of repos) {
    const node = byId.get(r.id)
    if (!node) continue
    const p = r.cloneOf
    if (p && p !== r.id && byId.has(p)) byId.get(p)!.clones.push(node)
    else roots.push(node)
  }
  return roots
}

function nextCloneSlug(from: string, ids: string[]) {
  const have = new Set(ids)
  const stem = from.slice(0, 28)
  for (let n = 2; n < 40; n++) {
    const id = `${stem}-c${n}`.slice(0, 32)
    if (/^[a-z][a-z0-9-]{1,32}$/.test(id) && !have.has(id)) return id
  }
  return ''
}

function findNode(nodes: Node[], id: string): Node | undefined {
  for (const n of nodes) {
    if (n.id === id) return n
    const hit = findNode(n.clones, id)
    if (hit) return hit
  }
  return undefined
}

function StackCard({
  node,
  ids,
  depth,
  onRun,
  onLog,
  showDomain,
  embedded
}: {
  node: Node
  ids: string[]
  depth: number
  onRun: (fn: () => Promise<unknown>, ok: string) => void
  onLog: (id: string) => void
  showDomain?: boolean
  embedded?: boolean
}) {
  const [domain, setDomain] = useState(node.domain || '')
  useEffect(() => {
    setDomain(node.domain || '')
  }, [node.domain])
  return (
    <div className={depth || embedded ? 'fleet-clone hx-card' : 'hx-card'}>
      <strong>
        {node.running ? 'LIVE' : 'OFF'} · {node.title}
      </strong>
      <p className="fleet-meta">
        {node.id} · {node.kind} · {node.recipe}
        {node.cloneOf ? ` · clone of ${node.cloneOf}` : ''}
        {node.domain ? ` · ${node.domain}` : ''}
      </p>
      <p className="fleet-meta">{node.rel}</p>
      {showDomain ? (
        <div className="hx-row">
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
          />
          <button
            className="ghost tiny"
            onClick={() => void onRun(() => window.homeai.fleetPatchRepo({ id: node.id, domain }), 'domain saved')}
          >
            Save domain
          </button>
        </div>
      ) : null}
      <div className="hx-row">
        <button className="ghost tiny" onClick={() => void onRun(() => window.homeai.fleetStart({ id: node.id }), 'started')}>
          Start
        </button>
        <button className="ghost tiny" onClick={() => void onRun(() => window.homeai.fleetStop({ id: node.id }), 'stopped')}>
          Stop
        </button>
        <button
          className="ghost tiny"
          onClick={() => void onRun(() => window.homeai.fleetRestart({ id: node.id }), 'restarted')}
        >
          Restart
        </button>
        <button className="ghost tiny" onClick={() => onLog(node.id)}>
          Log
        </button>
        <button
          className="ghost tiny"
          onClick={() => {
            const id = nextCloneSlug(node.id, ids)
            if (!id) return
            void onRun(() => window.homeai.fleetCloneLocal({ id, fromId: node.id }), 'cloned')
          }}
        >
          Clone
        </button>
        <button
          className="ghost tiny"
          onClick={() => void onRun(() => window.homeai.fleetRemoveRepo({ id: node.id }), 'removed')}
        >
          Remove
        </button>
      </div>
      {depth < 4
        ? node.clones.map((c) => (
            <StackCard
              key={c.id}
              node={c}
              ids={ids}
              depth={depth + 1}
              onRun={onRun}
              onLog={onLog}
              showDomain={showDomain}
            />
          ))
        : null}
    </div>
  )
}

export default function FleetPane() {
  const [tab, setTab] = useState<Tab>('stacks')
  const [snap, setSnap] = useState<Snap | null>(null)
  const [msg, setMsg] = useState('')
  const [log, setLog] = useState('')
  const [draft, setDraft] = useState('')

  const refresh = async () => {
    try {
      const s = (await window.homeai.fleetSnapshot()) as Snap
      setSnap(s)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void refresh()
    const t = setInterval(() => void refresh(), 2500)
    return () => clearInterval(t)
  }, [])

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      const next = await fn()
      if (next && typeof next === 'object' && 'repos' in (next as object)) setSnap(next as Snap)
      else await refresh()
      setMsg(ok)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    }
  }

  const repos = snap?.repos ?? []
  const bots = snap?.bots ?? []

  return (
    <HxPage
      title="Fleet"
      lead="Run Telegram bots and websites under Repos/. Tokens stay in data/secrets/fleet/. This pane does not fetch or open stored domains."
      actions={
        <button type="button" className="ghost" onClick={() => void refresh()}>
          Refresh
        </button>
      }
    >
    <div className="lib-wrap">
      {msg ? <div className="warn-banner">{msg}</div> : null}
      <div className="lib-tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="fleet-body">
        {tab === 'stacks' ? (
          <div className="hx-form">
            {nestRepos(repos.filter((r) => r.kind !== 'website')).length === 0 ? (
              <HxEmpty
                compact
                title="No Telegram stacks yet"
                body="Add a repo under Repos/ or clone https. Forks land in data/fleet/clones/."
              />
            ) : null}
            {nestRepos(repos.filter((r) => r.kind !== 'website')).map((node) => (
              <StackCard
                key={node.id}
                node={node}
                ids={repos.map((r) => r.id)}
                depth={0}
                onRun={run}
                onLog={(id) => {
                  void window.homeai.fleetLog({ id }).then(setLog)
                }}
              />
            ))}
            <AddRepo defaultKind="telegram-bot" onDone={(s) => { setSnap(s); setMsg('repo added') }} />
            <CloneWeb defaultKind="telegram-bot" onDone={(s) => { setSnap(s); setMsg('cloned') }} />
            {log ? <pre className="lib-md">{log}</pre> : null}
          </div>
        ) : null}

        {tab === 'sites' ? (
          <div className="hx-form">
            <p className="fleet-lead">
              Website stacks store a hostname label only. This pane does not fetch or open the domain.
            </p>
            {nestRepos(repos.filter((r) => r.kind === 'website')).length === 0 ? (
              <HxEmpty
                compact
                title="No websites yet"
                body="Add an existing folder or clone https. Hostname labels are stored only — this pane does not fetch them."
              />
            ) : null}
            {nestRepos(repos.filter((r) => r.kind === 'website')).map((node) => (
              <StackCard
                key={node.id}
                node={node}
                ids={repos.map((r) => r.id)}
                depth={0}
                showDomain
                onRun={run}
                onLog={(id) => {
                  void window.homeai.fleetLog({ id }).then(setLog)
                }}
              />
            ))}
            <AddRepo defaultKind="website" onDone={(s) => { setSnap(s); setMsg('repo added') }} />
            <CloneWeb defaultKind="website" onDone={(s) => { setSnap(s); setMsg('cloned') }} />
            {log ? <pre className="lib-md">{log}</pre> : null}
          </div>
        ) : null}

        {tab === 'bots' ? (
          <div className="hx-form">
            <p className="fleet-lead">
              Hub + worker tokens for Link INFO (and any other TG repo). Each bot lists that repo’s clones. Fork
              copies into <code>data/fleet/clones/</code>. Probe stores <code>@username</code>. Announce posts the
              new t.me link to telegram subscribers.
            </p>
            {bots.length === 0 ? (
              <HxEmpty compact title="No bot tokens yet" body="Store a hub or worker token. Tokens never go to the phone." />
            ) : null}
            {bots.map((b) => {
              const node = findNode(nestRepos(repos), b.repoId)
              return (
                <div key={b.id} className="hx-card">
                  <strong>
                    @{b.username || 'unknown'} · {b.role}
                  </strong>
                  <p className="fleet-meta">
                    {b.id} · repo {b.repoId} · token {b.hasToken ? b.last4 || 'set' : 'missing'}
                  </p>
                  <div className="hx-row">
                    <button className="ghost tiny" onClick={() => void run(() => window.homeai.fleetProbeBot({ id: b.id }), 'probed')}>
                      Probe getMe
                    </button>
                    <button
                      className="ghost tiny"
                      onClick={() => void run(() => window.homeai.fleetAnnounce({ botId: b.id }), 'announced')}
                    >
                      Announce username
                    </button>
                    <button className="ghost tiny" onClick={() => void run(() => window.homeai.fleetRemoveBot({ id: b.id }), 'removed')}>
                      Remove
                    </button>
                  </div>
                  {node ? (
                    <StackCard
                      node={node}
                      ids={repos.map((r) => r.id)}
                      depth={0}
                      embedded
                      showDomain={node.kind === 'website'}
                      onRun={run}
                      onLog={(id) => {
                        void window.homeai.fleetLog({ id }).then(setLog)
                      }}
                    />
                  ) : (
                    <p className="fleet-meta">No stack registered for {b.repoId}. Add or clone a repo, then fork it here.</p>
                  )}
                </div>
              )
            })}
            <AddBot repos={repos} onDone={(s) => { setSnap(s); setMsg('bot stored') }} />
          </div>
        ) : null}

        {tab === 'accounts' ? (
          <div className="hx-form">
            <p className="fleet-lead">User sessions are files only. This pane does not run a userbot farm.</p>
            {(snap?.accounts ?? []).map((a) => (
              <div key={a.id} className="hx-card">
                <strong>{a.label}</strong>
                <p className="fleet-meta">
                  {a.id} · {a.hasSession ? `session ${a.last4}` : 'empty'}
                </p>
                <button className="ghost tiny" onClick={() => void run(() => window.homeai.fleetRemoveAccount({ id: a.id }), 'removed')}>
                  Remove
                </button>
              </div>
            ))}
            <AddAccount onDone={(s) => { setSnap(s); setMsg('account stored') }} />
          </div>
        ) : null}

        {tab === 'broadcasts' ? (
          <div className="hx-form">
            <p className="fleet-lead">Plain text only. Recipients are the telegram chat ids you add. Cap 50 per send.</p>
            {(snap?.subscribers ?? [])
              .filter((s) => s.kind === 'telegram')
              .map((s) => (
                <div key={`tg-${s.chatId}`} className="hx-card">
                  chat {s.chatId} {s.botId ? `· ${s.botId}` : ''}
                  <button
                    className="ghost tiny"
                    onClick={() =>
                      void run(() => window.homeai.fleetRemoveSub({ kind: 'telegram', chatId: s.chatId }), 'removed')
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            <AddTgSub bots={bots} onDone={(s) => { setSnap(s); setMsg('subscriber added') }} />
            <label>Draft</label>
            <textarea rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="hx-row">
              <button
                className="ghost"
                onClick={async () => {
                  const u = bots.find((b) => b.role === 'hub')?.username || bots[0]?.username
                  const d = await window.homeai.fleetDraft({ username: u, hint: draft })
                  setDraft(d.text)
                  setMsg('draft ready — edit then send')
                }}
              >
                AI draft
              </button>
              <select id="fleet-bc-bot" defaultValue={bots[0]?.id || ''}>
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.username || b.id}
                  </option>
                ))}
              </select>
              <button
                className="primary"
                onClick={() => {
                  const sel = document.getElementById('fleet-bc-bot') as HTMLSelectElement | null
                  void run(
                    () => window.homeai.fleetBroadcast({ channel: 'telegram', body: draft, botId: sel?.value }),
                    'sent'
                  )
                }}
              >
                Send to subscribers
              </button>
            </div>
          </div>
        ) : null}

        {tab === 'email' ? (
          <div className="hx-form">
            <p className="fleet-lead">
              Proton Bridge on 127.0.0.1:1025 or Tuta SMTP. Password is a secret file. Host is never chosen by this form.
            </p>
            <p className="fleet-meta">
              {snap?.smtp.provider || 'none'} · {snap?.smtp.user || 'no user'} · pass {snap?.smtp.hasPass ? 'set' : 'missing'}
            </p>
            <SmtpForm provider={snap?.smtp.provider} onDone={(s) => { setSnap(s); setMsg('smtp saved') }} />
            {(snap?.subscribers ?? [])
              .filter((s) => s.kind === 'email')
              .map((s) => (
                <div key={s.email} className="hx-card">
                  {s.email}
                  <button
                    className="ghost tiny"
                    onClick={() => void run(() => window.homeai.fleetRemoveSub({ kind: 'email', email: s.email }), 'removed')}
                  >
                    Remove
                  </button>
                </div>
              ))}
            <AddEmailSub onDone={(s) => { setSnap(s); setMsg('email added') }} />
            <label>Body</label>
            <textarea rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button
              className="primary"
              onClick={() => void run(() => window.homeai.fleetBroadcast({ channel: 'email', body: draft, subject: 'Notice' }), 'sent')}
            >
              Send email broadcast
            </button>
          </div>
        ) : null}
      </div>
    </div>
    </HxPage>
  )
}

function AddRepo({ defaultKind = 'telegram-bot', onDone }: { defaultKind?: string; onDone: (s: Snap) => void }) {
  const [id, setId] = useState(defaultKind === 'website' ? 'site-1' : 'link-info')
  const [rel, setRel] = useState(defaultKind === 'website' ? 'Repos/site-1' : 'Repos/Link INFO BOT')
  const [kind, setKind] = useState(defaultKind)
  const [recipe, setRecipe] = useState(defaultKind === 'website' ? 'npm-dev' : 'python-app-main')
  const [domain, setDomain] = useState('')
  return (
    <div className="card">
      <strong>Add existing repo</strong>
      <label>id</label>
      <input value={id} onChange={(e) => setId(e.target.value)} />
      <label>rel (Repos/… or data/fleet/clones/…)</label>
      <input value={rel} onChange={(e) => setRel(e.target.value)} />
      <label>kind</label>
      <select value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="telegram-bot">telegram-bot</option>
        <option value="website">website</option>
        <option value="generic">generic</option>
      </select>
      <label>recipe</label>
      <select value={recipe} onChange={(e) => setRecipe(e.target.value)}>
        <option value="python-app-main">python -m app.main</option>
        <option value="npm-start">npm start</option>
        <option value="npm-dev">npm run dev</option>
      </select>
      {kind === 'website' ? (
        <>
          <label>domain (hostname only)</label>
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
        </>
      ) : null}
      <button
        className="ghost"
        onClick={async () => {
          const s = (await window.homeai.fleetAddRepo({
            id,
            rel,
            kind,
            recipe,
            title: id,
            domain: kind === 'website' ? domain : undefined
          })) as Snap
          onDone(s)
        }}
      >
        Add
      </button>
    </div>
  )
}

function CloneWeb({ defaultKind = 'website', onDone }: { defaultKind?: string; onDone: (s: Snap) => void }) {
  const [id, setId] = useState(defaultKind === 'telegram-bot' ? 'tg-clone' : 'site-clone')
  const [url, setUrl] = useState('https://github.com/')
  const [kind, setKind] = useState(defaultKind)
  const [recipe, setRecipe] = useState(defaultKind === 'telegram-bot' ? 'python-app-main' : 'npm-dev')
  const [domain, setDomain] = useState('')
  return (
    <div className="hx-card">
      <strong>Clone https website or TG repo</strong>
      <label>id</label>
      <input value={id} onChange={(e) => setId(e.target.value)} />
      <label>https url</label>
      <input value={url} onChange={(e) => setUrl(e.target.value)} />
      <label>kind</label>
      <select value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="website">website</option>
        <option value="telegram-bot">telegram-bot</option>
        <option value="generic">generic</option>
      </select>
      <label>recipe</label>
      <select value={recipe} onChange={(e) => setRecipe(e.target.value)}>
        <option value="npm-dev">npm run dev</option>
        <option value="npm-start">npm start</option>
        <option value="python-app-main">python -m app.main</option>
      </select>
      {kind === 'website' ? (
        <>
          <label>domain (hostname only)</label>
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
        </>
      ) : null}
      <button
        className="ghost"
        onClick={async () => {
          const s = (await window.homeai.fleetClone({
            id,
            url,
            kind,
            recipe,
            title: id,
            domain: kind === 'website' ? domain : undefined
          })) as Snap
          onDone(s)
        }}
      >
        Clone
      </button>
    </div>
  )
}

function AddBot({ repos, onDone }: { repos: Repo[]; onDone: (s: Snap) => void }) {
  const [id, setId] = useState('hub')
  const [repoId, setRepoId] = useState(repos[0]?.id || 'link-info')
  const [role, setRole] = useState('hub')
  const [token, setToken] = useState('')
  return (
    <div className="card">
      <strong>Add bot token</strong>
      <label>id</label>
      <input value={id} onChange={(e) => setId(e.target.value)} />
      <label>repo</label>
      <select value={repoId} onChange={(e) => setRepoId(e.target.value)}>
        {repos.map((r) => (
          <option key={r.id} value={r.id}>
            {r.id}
            {r.cloneOf ? ` · clone of ${r.cloneOf}` : ''}
            {r.kind === 'website' ? ' · site' : ''}
          </option>
        ))}
      </select>
      <label>role</label>
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="hub">hub</option>
        <option value="worker">worker</option>
      </select>
      <label>token</label>
      <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
      <button
        className="ghost"
        onClick={async () => {
          const s = (await window.homeai.fleetAddBot({ id, repoId, role, token })) as Snap
          setToken('')
          onDone(s)
        }}
      >
        Store token
      </button>
    </div>
  )
}

function AddAccount({ onDone }: { onDone: (s: Snap) => void }) {
  const [id, setId] = useState('acct-1')
  const [label, setLabel] = useState('ops')
  const [session, setSession] = useState('')
  return (
    <div className="card">
      <strong>Add TG account session</strong>
      <label>id</label>
      <input value={id} onChange={(e) => setId(e.target.value)} />
      <label>label</label>
      <input value={label} onChange={(e) => setLabel(e.target.value)} />
      <label>session string</label>
      <textarea rows={3} value={session} onChange={(e) => setSession(e.target.value)} />
      <button
        className="ghost"
        onClick={async () => {
          const s = (await window.homeai.fleetAddAccount({ id, label, session })) as Snap
          setSession('')
          onDone(s)
        }}
      >
        Store
      </button>
    </div>
  )
}

function AddTgSub({ bots, onDone }: { bots: Bot[]; onDone: (s: Snap) => void }) {
  const [chatId, setChatId] = useState('')
  const [botId, setBotId] = useState(bots[0]?.id || '')
  return (
    <div className="card">
      <strong>Add telegram subscriber chat id</strong>
      <input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="123456789" />
      <select value={botId} onChange={(e) => setBotId(e.target.value)}>
        <option value="">any bot</option>
        {bots.map((b) => (
          <option key={b.id} value={b.id}>
            {b.username || b.id}
          </option>
        ))}
      </select>
      <button
        className="ghost"
        onClick={async () => {
          const s = (await window.homeai.fleetAddSub({
            kind: 'telegram',
            chatId: Number(chatId),
            botId: botId || undefined
          })) as Snap
          onDone(s)
        }}
      >
        Add
      </button>
    </div>
  )
}

function AddEmailSub({ onDone }: { onDone: (s: Snap) => void }) {
  const [email, setEmail] = useState('')
  return (
    <div className="card">
      <strong>Add email subscriber</strong>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ops@example.com" />
      <button
        className="ghost"
        onClick={async () => {
          const s = (await window.homeai.fleetAddSub({ kind: 'email', email })) as Snap
          setEmail('')
          onDone(s)
        }}
      >
        Add
      </button>
    </div>
  )
}

function SmtpForm({ provider, onDone }: { provider?: string; onDone: (s: Snap) => void }) {
  const [prov, setProv] = useState(provider || 'proton-bridge')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  return (
    <div className="card">
      <strong>SMTP</strong>
      <select value={prov} onChange={(e) => setProv(e.target.value)}>
        <option value="none">none</option>
        <option value="proton-bridge">Proton Bridge 127.0.0.1:1025</option>
        <option value="tuta-smtp">Tuta smtp.tutanota.com:587</option>
      </select>
      <label>user</label>
      <input value={user} onChange={(e) => setUser(e.target.value)} />
      <label>password</label>
      <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" />
      <button
        className="ghost"
        onClick={async () => {
          const s = (await window.homeai.fleetSmtpSet({ provider: prov, user, pass })) as Snap
          setPass('')
          onDone(s)
        }}
      >
        Save
      </button>
    </div>
  )
}

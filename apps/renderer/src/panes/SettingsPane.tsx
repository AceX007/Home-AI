import { useEffect, useState } from 'react'
import type { ApprovalMode, FileEntry, HardwareProbe, HomeProfile, PermissionsFile, ProviderStatus, SecretName, VisualTier, VramProfile } from '@homeai/core'
import { HxPage } from '../layout/HxPage'
import { useWorkbench } from '../store/useWorkbench'
import { domainPackLines } from '@homeai/runtime/browser'

const SECTIONS = [
  { id: 'trust', label: 'Trust' },
  { id: 'keys', label: 'Keys' },
  { id: 'hardware', label: 'Hardware' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'visual', label: 'Visual' }
] as const

type Section = (typeof SECTIONS)[number]['id']

function CaptureList({ workspace }: { workspace?: string }) {
  const [names, setNames] = useState<string[]>([])
  useEffect(() => {
    if (!workspace) return
    void window.homeai
      .list(`${workspace}/browser/captures`)
      .then((rows) => {
        const list = Array.isArray(rows) ? (rows as FileEntry[]) : []
        setNames(
          list
            .filter((e) => e && !e.dir)
            .map((e) => String(e.name || '').replace(/[<>]/g, '').slice(0, 80))
            .filter(Boolean)
            .slice(0, 8)
        )
      })
      .catch(() => setNames([]))
  }, [workspace])
  if (!names.length) return <p className="hx-hint">No captures yet.</p>
  return (
    <ul className="cap-list">
      {names.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  )
}

export default function SettingsPane() {
  const w = useWorkbench()
  const [section, setSection] = useState<Section>('trust')
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [probe, setProbe] = useState<HardwareProbe | undefined>(w.boot?.probe)
  const [vramProfile, setVramProfile] = useState<VramProfile | 'auto'>('auto')
  const [tier, setTier] = useState<VisualTier | 'auto'>('auto')
  const [msg, setMsg] = useState('')
  const [perms, setPerms] = useState<PermissionsFile | null>(null)
  const [termList, setTermList] = useState('')
  const [netList, setNetList] = useState('')
  const [mcpList, setMcpList] = useState('')
  const [extraRoots, setExtraRoots] = useState('')
  const [allowReview, setAllowReview] = useState('')
  const [blockReview, setBlockReview] = useState('')
  const [allowRun, setAllowRun] = useState('')
  const [blockRun, setBlockRun] = useState('')
  const [home, setHome] = useState<HomeProfile | null>(null)
  const [tgToken, setTgToken] = useState('')
  const [tgStatus, setTgStatus] = useState<{ configured?: boolean; online?: boolean; peers?: number[]; pairing?: { exp: number } | null }>({})
  const [pairCode, setPairCode] = useState('')
  const [unrestrictedOk, setUnrestrictedOk] = useState(false)
  const [glass, setGlass] = useState<{ listening?: boolean; url?: string } | null>(null)
  const [hwHint, setHwHint] = useState('')

  useEffect(() => {
    void window.homeai.secretsStatus().then((s) => setProviders(s as ProviderStatus[]))
    void window.homeai.profileGet().then((p) => setHome(p as HomeProfile))
    void window.homeai.telegramStatus().then((s) => setTgStatus(s as typeof tgStatus))
    void window.homeai.miniappStatus().then((s) => setGlass(s as { listening?: boolean; url?: string }))
    void window.homeai.hardwareGate().then((g) => setHwHint(String(g.hint || '')))
    void window.homeai.permissions().then((p) => {
      const file = p as PermissionsFile
      setPerms(file)
      setTermList((file.terminalAllowlist ?? []).join('\n'))
      setNetList((file.netAllowlist ?? []).join('\n'))
      setMcpList((file.mcpAllowlist ?? []).join('\n'))
      setExtraRoots((file.fsExtraRoots ?? []).join('\n'))
      setAllowReview((file.autoReview?.allow_instructions ?? []).join('\n'))
      setBlockReview((file.autoReview?.block_instructions ?? []).join('\n'))
      setAllowRun((file.autoRun?.allow_instructions ?? []).join('\n'))
      setBlockRun((file.autoRun?.block_instructions ?? []).join('\n'))
    })
  }, [])

  const saveKey = async (name: SecretName) => {
    const v = draft[name]
    if (!v) return
    await window.homeai.secretsSet(name, v)
    setDraft((d) => ({ ...d, [name]: '' }))
    setProviders((await window.homeai.secretsStatus()) as ProviderStatus[])
    setMsg(`${name} stored in data/secrets (chmod 600)`)
  }

  return (
    <HxPage
      title="Settings"
      lead="Local 2B is the default mind. Keys are optional muscle. ChatGPT Plus is not an API — paste an OpenAI or OpenRouter key. Cursor is Cloud Agents, not chat-completions."
      actions={
        <div className="hx-rail" role="tablist" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={section === s.id}
              className={section === s.id ? 'ghost primary' : 'ghost'}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="hx-form">
        {msg ? <div className="warn-banner">{msg}</div> : null}

        {section === 'trust' ? (
          <>
            <div className="hx-card">
              <h3>Think → Implement</h3>
              <p className="hx-hint">
                Mode Think always runs the local 2B with explore, outline, library_pack, git_pack, and plan_write. It
                cannot edit product files or use the shell. Footer Implement follows the latest RAG/plans/*.think.md
                with status ready — OpenRouter/OpenAI if a key exists, otherwise the 2B. Approvals still gate writes.
              </p>
            </div>
            <div className="hx-card">
              <h3>Trust</h3>
              <span className="set-chip">pending {w.kernelPulse?.pending ?? w.pending.length}</span>
              <span className="set-chip">allow {w.allowCount}</span>
              <span className="set-chip">deny {w.denyCount}</span>
              <span className="set-chip">file delete · not a tool</span>
              <span className="set-chip">writes Ask · no Landlock</span>
              <p className="hx-hint">
                Tool approvals live in data/permissions.json. This kernel has no Landlock — unlisted shell/net asks
                Allow. Writes to workspace data/permissions.json (also honors .cursor/permissions.json on load).
              </p>
              {perms ? (
                <>
                  <label>Approval mode</label>
                  <select
                    value={perms.approvalMode}
                    onChange={(e) => setPerms({ ...perms, approvalMode: e.target.value as ApprovalMode })}
                  >
                    <option value="allowlist">allowlist (default)</option>
                    <option value="manual">manual (ask on exec/net)</option>
                    <option value="auto-review">auto-review (judge, then reviewer, then you)</option>
                    <option value="unrestricted">unrestricted (no prompts)</option>
                  </select>
                  {perms.approvalMode === 'unrestricted' ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={unrestrictedOk}
                        onChange={(e) => setUnrestrictedOk(e.target.checked)}
                      />{' '}
                      I understand there is no Landlock
                    </label>
                  ) : null}
                  <label>Terminal allowlist (one prefix per line)</label>
                  <textarea rows={6} value={termList} onChange={(e) => setTermList(e.target.value)} />
                  <label>Net allowlist (URL prefixes)</label>
                  <textarea rows={4} value={netList} onChange={(e) => setNetList(e.target.value)} />
                  <label>MCP allowlist (server:tool, server:*, *:tool)</label>
                  <textarea rows={3} value={mcpList} onChange={(e) => setMcpList(e.target.value)} />
                  <label>Extra FS roots (absolute paths, not $HOME itself; tools use the folder name as root id; writes always Ask)</label>
                  <textarea rows={3} value={extraRoots} onChange={(e) => setExtraRoots(e.target.value)} />
                  {perms.approvalMode === 'auto-review' ? <span className="set-chip">auto-review · judge then you</span> : null}
                  <p className="hx-hint">
                    Auto-review: a deterministic Judge allows known-safe git/test/read argv. Unknown commands go to a
                    classifier or Ask. Too-destructive never runs. Not a sandbox and not Landlock.
                  </p>
                  <label>Auto-review allow instructions (one line; never skips too-destructive)</label>
                  <textarea rows={3} value={allowReview} onChange={(e) => setAllowReview(e.target.value)} />
                  <label>Auto-review block instructions (one line; forces Ask)</label>
                  <textarea rows={3} value={blockReview} onChange={(e) => setBlockReview(e.target.value)} />
                  <label>Auto-run allow hints (honored in auto-review; never skips too-destructive)</label>
                  <textarea rows={2} value={allowRun} onChange={(e) => setAllowRun(e.target.value)} />
                  <label>Auto-run block hints</label>
                  <textarea rows={2} value={blockRun} onChange={(e) => setBlockRun(e.target.value)} />
                  <p className="hx-hint">
                    Tool packs: core always. Add /pack research, browser, design, life, or mcp-domain so the 2B does not
                    see every MCP schema. Domain MCP stays behind mcp-domain + this allowlist:
                  </p>
                  <ul className="cap-list">
                    {domainPackLines().map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <div className="hx-row">
                    <button
                      type="button"
                      className="ghost"
                      onClick={async () => {
                        const next = await window.homeai.permissionsSet(
                          {
                            ...perms,
                            terminalAllowlist: termList.split('\n'),
                            netAllowlist: netList.split('\n'),
                            mcpAllowlist: mcpList.split('\n'),
                            fsExtraRoots: extraRoots.split('\n'),
                            autoReview: {
                              allow_instructions: allowReview.split('\n'),
                              block_instructions: blockReview.split('\n')
                            },
                            autoRun: {
                              allow_instructions: allowRun.split('\n'),
                              block_instructions: blockRun.split('\n')
                            }
                          },
                          unrestrictedOk === true
                        )
                        const file = next as PermissionsFile
                        setPerms(file)
                        setTermList((file.terminalAllowlist ?? []).join('\n'))
                        setNetList((file.netAllowlist ?? []).join('\n'))
                        setMcpList((file.mcpAllowlist ?? []).join('\n'))
                        setExtraRoots((file.fsExtraRoots ?? []).join('\n'))
                        setAllowReview((file.autoReview?.allow_instructions ?? []).join('\n'))
                        setBlockReview((file.autoReview?.block_instructions ?? []).join('\n'))
                        setAllowRun((file.autoRun?.allow_instructions ?? []).join('\n'))
                        setBlockRun((file.autoRun?.block_instructions ?? []).join('\n'))
                        setMsg('permissions saved to data/permissions.json')
                      }}
                    >
                      Save permissions
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={async () => {
                        const r = await window.homeai.mcpEnableStarter()
                        setMsg(`MCP starter: ${(r.servers || []).join(', ') || 'none resolved'} · still ask until allowlisted`)
                      }}
                    >
                      Enable MCP starter
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={async () => {
                        const file = (await window.homeai.mcpTrustStarter()) as PermissionsFile
                        setPerms(file)
                        setMcpList((file.mcpAllowlist ?? []).join('\n'))
                        setMsg(`Trusted starter MCP: ${(file.mcpAllowlist ?? []).join(', ') || 'none'} · DesktopCommander still blocked`)
                      }}
                    >
                      Trust starter MCP
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={async () => {
                        const r = await window.homeai.mcpEnableStarter('blender')
                        setMsg(
                          `Blender MCP: ${(r.servers || []).join(', ') || 'none resolved'} · uv local checkout · still ask until allowlisted`
                        )
                      }}
                    >
                      Enable Blender MCP
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </>
        ) : null}

        {section === 'hardware' ? (
          <div className="hx-card">
            <h3>Local mind</h3>
            <label>VRAM profile</label>
            <select
              value={vramProfile}
              onChange={async (e) => {
                const v = e.target.value as VramProfile | 'auto'
                setVramProfile(v)
                const p = (await window.homeai.probe({ profile: v, visualTier: tier })) as HardwareProbe
                setProbe(p)
                document.getElementById('root')?.setAttribute('data-tier', p.visualTier)
              }}
            >
              <option value="auto">auto (0–5 GB governor)</option>
              <option value="cpu">cpu · 0 GB</option>
              <option value="tiny">tiny · 1–2 GB</option>
              <option value="small">small · 2–3 GB</option>
              <option value="standard">standard · 3–5 GB</option>
            </select>
            <label>Visual tier</label>
            <select
              value={tier}
              onChange={async (e) => {
                const v = e.target.value as VisualTier | 'auto'
                setTier(v)
                const p = (await window.homeai.probe({ profile: vramProfile, visualTier: v })) as HardwareProbe
                setProbe(p)
                document.getElementById('root')?.setAttribute('data-tier', p.visualTier)
              }}
            >
              <option value="auto">auto from VRAM</option>
              <option value="potato">potato</option>
              <option value="balanced">balanced</option>
              <option value="cinematic">cinematic</option>
            </select>
            {probe ? (
              <p className="hx-mono">
                {probe.gpuName} · {probe.vramMb}MB · ngl {probe.nGpuLayers} · ctx {probe.contextSize} · reserve{' '}
                {probe.reservedVramMb}MB UI
                {probe.coderEnabled ? ` · coder ${probe.coderModelName}` : ''}
              </p>
            ) : null}
            {hwHint ? <p className="hx-hint">{hwHint}</p> : null}
            <div className="hx-row">
              <button
                type="button"
                className="ghost"
                onClick={async () => {
                  setMsg('Downloading GGUF…')
                  try {
                    const r = (await window.homeai.modelDownload()) as { ok?: boolean; hint?: string }
                    setMsg(r.ok ? 'Model saved in profile.' : String(r.hint || 'Download skipped'))
                    const g = await window.homeai.hardwareGate()
                    setHwHint(String(g.hint || ''))
                  } catch (err) {
                    setMsg(String(err instanceof Error ? err.message : err).slice(0, 160))
                  }
                }}
              >
                Download GGUF
              </button>
              <button
                type="button"
                className="ghost"
                onClick={async () => {
                  await window.homeai.llmStart()
                  await w.load()
                  setMsg('llama-server start requested')
                }}
              >
                Load 2B
              </button>
              <button
                type="button"
                className="ghost"
                onClick={async () => {
                  await window.homeai.llmStop()
                  await w.load()
                }}
              >
                Unload
              </button>
            </div>
          </div>
        ) : null}

        {section === 'visual' ? (
          <>
            <div className="hx-card">
              <h3>Index</h3>
              <p className="hx-hint">
                {w.boot?.ragStats?.documents ?? 0} documents in RAG
                {w.boot?.ragStats?.lastIngest
                  ? ` · last ingest ${new Date(w.boot.ragStats.lastIngest).toISOString().slice(0, 16).replace('T', ' ')}Z`
                  : ''}
                . Capture pages from Browser. Ignore still honors .cursorignore / ignore sets — no Instant Grep.
              </p>
              <CaptureList workspace={w.boot?.workspace} />
            </div>
            {home ? (
              <div className="hx-card">
                <h3>You</h3>
                <label>Display name</label>
                <input value={home.displayName} onChange={(e) => setHome({ ...home, displayName: e.target.value })} />
                <label>About you (standing instruction)</label>
                <textarea rows={3} value={home.aboutMe} onChange={(e) => setHome({ ...home, aboutMe: e.target.value })} />
                <label>Default mode</label>
                <select
                  value={home.defaultMode}
                  onChange={(e) => setHome({ ...home, defaultMode: e.target.value as HomeProfile['defaultMode'] })}
                >
                  <option value="ask">ask</option>
                  <option value="think">think</option>
                  <option value="agent">agent</option>
                </select>
                <label>Default mind</label>
                <select
                  value={home.defaultProvider}
                  onChange={(e) => setHome({ ...home, defaultProvider: e.target.value as HomeProfile['defaultProvider'] })}
                >
                  <option value="local">local · offline 2B</option>
                  <option value="openai">openai</option>
                  <option value="openrouter">openrouter · cloud</option>
                  <option value="cursor">cursor · Cloud Agents</option>
                </select>
                <label>
                  <input
                    type="checkbox"
                    checked={home.telegramNotifyDesktopRuns}
                    onChange={(e) => setHome({ ...home, telegramNotifyDesktopRuns: e.target.checked })}
                  />{' '}
                  Notify Telegram when the PC starts a run
                </label>
                <div className="hx-row">
                  <button
                    type="button"
                    className="ghost"
                    onClick={async () => {
                      const next = (await window.homeai.profileSet(home)) as HomeProfile
                      setHome(next)
                      setMsg('profile saved')
                    }}
                  >
                    Save you
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {section === 'telegram' ? (
          <div className="hx-card">
            <h3>Telegram</h3>
            <div className="hx-row">
              <button type="button" className="ghost" onClick={() => w.setActivity('telegram')}>
                Open Telegram session
              </button>
            </div>
            <p className="hx-hint">
              The phone is the glass. This window is the kernel. Pair once, then Home feels like a flagship AI app —
              Pulse, Stack, Board, Ship on PC — with every builtin and MCP. Private chat or a group. Only your paired
              account can command. The Mini App is the same kernel in Telegram&apos;s sheet — HMAC at the door, no
              second agent.
              {tgStatus.online ? ' · online' : tgStatus.configured ? ' · token stored' : ' · no token'}
              {glass?.listening ? ` · glass ${glass.url}` : ''}
            </p>
            <label>Mini App public URL (HTTPS tunnel to 127.0.0.1:18766)</label>
            <input
              placeholder="https://your-tunnel.example"
              value={home?.miniAppUrl || ''}
              onChange={(e) => home && setHome({ ...home, miniAppUrl: e.target.value })}
            />
            <div className="hx-row">
              <button
                type="button"
                className="ghost"
                onClick={async () => {
                  const r = await window.homeai.miniappOpen()
                  setGlass(await window.homeai.miniappStatus())
                  setMsg(`opened ${r.url}`)
                }}
              >
                Open glass
              </button>
              <button
                type="button"
                className="ghost"
                onClick={async () => {
                  if (home) {
                    const next = (await window.homeai.profileSet(home)) as HomeProfile
                    setHome(next)
                  }
                  const r = await window.homeai.miniappPush()
                  setGlass(await window.homeai.miniappStatus())
                  setMsg(`pushed HOME menu · ${r.url}`)
                }}
              >
                Push to Telegram
              </button>
            </div>
            <label>Bot token</label>
            <div className="hx-row">
              <input type="password" placeholder="paste telegram token" value={tgToken} onChange={(e) => setTgToken(e.target.value)} />
              <button
                type="button"
                className="ghost"
                onClick={async () => {
                  await window.homeai.telegramSetToken(tgToken)
                  setTgToken('')
                  setTgStatus((await window.homeai.telegramStatus()) as typeof tgStatus)
                  setMsg('telegram token stored')
                }}
              >
                Save
              </button>
            </div>
            <div className="hx-row">
              <button
                type="button"
                className="ghost"
                onClick={async () => {
                  const p = await window.homeai.telegramPairStart()
                  setPairCode(p.code)
                  setTgStatus((await window.homeai.telegramStatus()) as typeof tgStatus)
                }}
              >
                Pair phone
              </button>
            </div>
            {pairCode ? <p className="hx-mono">Send /pair {pairCode} to the bot. Shown once.</p> : null}
            {(tgStatus.peers ?? []).length ? (
              <p className="hx-hint">
                Paired ids:{' '}
                {tgStatus.peers?.map((id) => (
                  <span key={id}>
                    {id}{' '}
                    <button
                      type="button"
                      className="ghost tiny"
                      onClick={async () => {
                        await window.homeai.telegramUnpair(id)
                        setTgStatus((await window.homeai.telegramStatus()) as typeof tgStatus)
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
        ) : null}

        {section === 'keys' ? (
          <div className="hx-card">
            <h3>Keys</h3>
            {(['openai', 'openrouter', 'cursor'] as SecretName[]).map((name) => {
              const st = providers.find((p) => p.id === name)
              return (
                <div key={name}>
                  <label>
                    {name} {st?.configured ? '· configured' : '· empty'}
                  </label>
                  <div className="hx-row">
                    <input
                      type="password"
                      placeholder={`paste ${name} key`}
                      value={draft[name] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
                    />
                    <button type="button" className="ghost" onClick={() => void saveKey(name)}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={async () => {
                        await window.homeai.secretsDelete(name)
                        setProviders((await window.homeai.secretsStatus()) as ProviderStatus[])
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </HxPage>
  )
}

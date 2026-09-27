import { useEffect, useState } from 'react'
import { HxEmpty, HxPage, HxSideHead } from '../layout/HxPage'
import { useWorkbench } from '../store/useWorkbench'

interface McpRow {
  id: string
  ok: boolean
  tools: string[]
  error?: string
  transport?: 'stdio' | 'http'
  url?: string
}

export default function ModsPane({ listOnly }: { listOnly?: boolean }) {
  const w = useWorkbench()
  const [mcp, setMcp] = useState<McpRow[]>([])
  const [busy, setBusy] = useState(false)
  const [skillName, setSkillName] = useState('')
  const [skillBody, setSkillBody] = useState('')
  const [ruleName, setRuleName] = useState('')
  const [ruleBody, setRuleBody] = useState('')
  const [note, setNote] = useState('')

  const refresh = async () => {
    try {
      const rows = await window.homeai.mcpList()
      setMcp((rows as McpRow[]) ?? [])
    } catch {
      setMcp([])
    }
  }

  useEffect(() => {
    void refresh()
  }, [w.boot?.root])

  if (listOnly) {
    return (
      <>
        <HxSideHead
          title="Skills"
          hint="Click a skill to pin it on Agents. Open the full pane to add SKILL.md."
          actions={
            <button type="button" className="ghost" onClick={() => w.setActivity('mods')}>
              Open
            </button>
          }
        />
        <div className="side-list">
          {w.skills.length === 0 && w.mods.length === 0 ? (
            <HxEmpty
              compact
              title="No skills loaded"
              body="Add one in the Skills pane or drop SKILL.md under RAG/skills."
            />
          ) : (
            <>
              {w.skills.slice(0, 40).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="note-row"
                  title={`Pin /${s.slash ?? s.name} on Agents`}
                  onClick={() => {
                    void w.pinSkill(s.slash ?? s.name)
                    w.setActivity('mods')
                    useWorkbench.setState({ chatOpen: true })
                  }}
                >
                  <strong>/{s.slash ?? s.name}</strong>
                  <small>{s.description}</small>
                </button>
              ))}
              {w.mods.map((m) => (
                <div key={m.id} className="note-row">
                  <strong>{m.name}</strong>
                  <small>{m.enabled ? 'enabled' : 'disabled'}</small>
                </div>
              ))}
            </>
          )}
        </div>
      </>
    )
  }

  return (
    <HxPage
      title="Skills"
      lead="Load order: project .cursor/rules and nested AGENTS.md, then mods, then RAG. Pin a skill onto Agents. MCP tools stay behind the allowlist — this pane does not open stored URLs."
    >
    <div className="hx-form">
      <div className="hx-card">
        <strong>Add skill</strong>
        <p className="hx-hint">Writes RAG/skills/slug/SKILL.md. Phone can do the same with /skill new.</p>
        <input placeholder="name" value={skillName} onChange={(e) => setSkillName(e.target.value)} />
        <textarea rows={4} placeholder="body" value={skillBody} onChange={(e) => setSkillBody(e.target.value)} />
        <button
          className="ghost"
          onClick={async () => {
            if (!skillName.trim() || !skillBody.trim()) return
            await window.homeai.knowledgeWriteSkill({ name: skillName.trim(), description: skillName.trim(), body: skillBody })
            setSkillName('')
            setSkillBody('')
            setNote('skill saved')
            await w.load()
          }}
        >
          Save skill
        </button>
      </div>
      <div className="hx-card">
        <strong>Add instruction</strong>
        <p className="hx-hint">Standing rule in RAG/rules. Always applied.</p>
        <input placeholder="name" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
        <textarea rows={3} placeholder="instruction" value={ruleBody} onChange={(e) => setRuleBody(e.target.value)} />
        <button
          className="ghost"
          onClick={async () => {
            if (!ruleName.trim() || !ruleBody.trim()) return
            await window.homeai.knowledgeWriteRule({ name: ruleName.trim(), body: ruleBody })
            setRuleName('')
            setRuleBody('')
            setNote('instruction saved')
            await w.load()
          }}
        >
          Save instruction
        </button>
      </div>
      {note ? <p className="hx-mono">{note}</p> : null}
      <h3>
        MCP servers ({mcp.length}){' '}
        <button
          type="button"
          className="ghost tiny"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const rows = await window.homeai.mcpReload()
              setMcp((rows as McpRow[]) ?? [])
            } catch {
              await refresh()
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? '…' : 'Reload MCP'}
        </button>
      </h3>
      {mcp.length === 0 ? (
        <HxEmpty
          compact
          title="No MCP servers loaded"
          body="Add .homeai/mcp.json or .cursor/mcp.json, then Reload. Domain MCP stays behind mcp-domain plus the Trust allowlist."
        />
      ) : (
        mcp.map((s) => (
          <div key={s.id} className="hx-card">
            <strong>
              {s.id} {s.ok ? 'connected' : 'down'}
            </strong>
            {s.transport ? <p className="hx-hint">{s.transport}</p> : null}
            {s.ok ? (
              <p className="hx-hint">{s.tools.join(', ') || 'no tools'}</p>
            ) : (
              <p className="hx-hint">{s.error}</p>
            )}
          </div>
        ))
      )}
      {w.mods.map((m) => (
        <div key={m.id} className="hx-card">
          <strong>
            {m.name} v{m.version}
          </strong>
          <p className="hx-hint">{m.description}</p>
          <small>{m.enabled ? 'enabled' : 'disabled'}</small>
        </div>
      ))}
      <h3>Rules ({w.rules.length})</h3>
      {w.rules.map((r) => (
        <div key={r.id} className="hx-card">
          <strong>{r.title}</strong>
          <small className="hx-hint">
            {r.kind ?? 'always'} · {r.source.replace(/\\/g, '/').split('/').slice(-3).join('/')}
          </small>
        </div>
      ))}
      <h3>Skills ({w.skills.length})</h3>
      {w.skills.map((s) => (
        <div key={s.id} className="hx-card">
          <strong>/{s.slash ?? s.name}</strong>
          <p className="hx-hint">{s.description}</p>
          <button
            type="button"
            className="ghost tiny"
            onClick={() => {
              void w.pinSkill(s.slash ?? s.name)
              useWorkbench.setState({ chatOpen: true })
            }}
          >
            Pin on Agents
          </button>
        </div>
      ))}
    </div>
    </HxPage>
  )
}

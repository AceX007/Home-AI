import { useEffect, useMemo, useState } from 'react'
import { AGENT_MODES } from '@homeai/core'
import { publicSkillPeek, publicStackPeek, takeGoTab } from '@homeai/runtime/browser'
import { HxEmpty } from '../layout/HxPage'
import { useWorkbench } from '../store/useWorkbench'

const CORE_STACK = [
  'explore',
  'fs_read',
  'grep',
  'glob',
  'rag_search',
  'terminal_run',
  'plan_write',
  'ask_user',
  'git_status'
]

interface McpRow {
  tools?: string[]
}

/** One strip to start a chat and pick mode / tools / skills. Sessions stay in the list below. */
export function StageGo({ onUseSkill }: { onUseSkill: (slash: string) => void }) {
  const w = useWorkbench()
  const [tab, setTab] = useState<'mode' | 'stack' | 'skills' | null>(null)
  const [mcp, setMcp] = useState<McpRow[]>([])
  useEffect(() => {
    if (tab !== 'stack') return
    void window.homeai
      .mcpList()
      .then((rows) => setMcp(Array.isArray(rows) ? (rows as McpRow[]) : []))
      .catch(() => setMcp([]))
  }, [tab])

  const skills = useMemo(() => publicSkillPeek(w.skills), [w.skills])
  const stack = useMemo(() => {
    const extra = mcp.flatMap((row) => (Array.isArray(row.tools) ? row.tools : []))
    return publicStackPeek([...CORE_STACK, ...extra])
  }, [mcp])

  const go = (next: string) => {
    const ok = takeGoTab(next)
    if (ok !== 'mode' && ok !== 'stack' && ok !== 'skills') return
    setTab(tab === ok ? null : ok)
  }

  return (
    <div className="stage-go">
      <div className="stage-go-row">
        <button
          type="button"
          className="primary"
          aria-label="New chat"
          onClick={() => {
            w.newChat()
            useWorkbench.setState({ chatOpen: true })
          }}
        >
          New
        </button>
        <button
          type="button"
          className={tab === 'mode' ? 'on' : ''}
          aria-pressed={tab === 'mode'}
          onClick={() => go('mode')}
        >
          Mode · {w.agentMode}
        </button>
        <button
          type="button"
          className={tab === 'stack' ? 'on' : ''}
          aria-pressed={tab === 'stack'}
          onClick={() => go('stack')}
        >
          Tools
        </button>
        <button
          type="button"
          className={tab === 'skills' ? 'on' : ''}
          aria-pressed={tab === 'skills'}
          onClick={() => go('skills')}
        >
          Skills
        </button>
      </div>
      {tab !== 'skills' && skills.length === 0 && !w.customSkill ? (
        <p className="sess-empty-hint">No skill pinned. Open Skills, or type / then Alt+click to pin.</p>
      ) : null}
      {w.customSkill ? (
        <p className="sess-empty-hint">
          Pinned /{w.customSkill}
          <button type="button" className="ghost tiny" aria-label="Unpin skill" onClick={() => void w.clearSkill()}>
            Unpin
          </button>
        </p>
      ) : null}
      {tab === 'mode' ? (
        <div className="stage-go-peek">
          {AGENT_MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={m === w.agentMode ? 'on' : ''}
              onClick={() => {
                useWorkbench.setState({ agentMode: m, chatOpen: true })
                setTab(null)
              }}
            >
              {m}
            </button>
          ))}
        </div>
      ) : null}
      {tab === 'stack' ? (
        <div className="stage-go-peek">
          {stack.map((row) => (
            <button key={row.name} type="button" onClick={() => w.setActivity('mods')}>
              {row.name}
            </button>
          ))}
          <button type="button" className="on" onClick={() => w.setActivity('mods')}>
            All tools
          </button>
        </div>
      ) : null}
      {tab === 'skills' ? (
        <div className="stage-go-peek">
          {skills.length ? (
            skills.map((row) => (
              <button
                key={row.slash}
                type="button"
                title={row.hint}
                onClick={(e) => {
                  if (e.altKey) {
                    void w.pinSkill(row.slash)
                    setTab(null)
                    return
                  }
                  onUseSkill(row.slash)
                  setTab(null)
                }}
              >
                /{row.slash}
                {row.hint ? <small>{row.hint}</small> : null}
              </button>
            ))
          ) : (
            <HxEmpty
              compact
              title="No skills loaded"
              body="Add a SKILL.md in Skills, then pin here or Alt+click a /slash in the composer."
            />
          )}
          <button type="button" className="on" onClick={() => w.setActivity('mods')}>
            All skills
          </button>
        </div>
      ) : null}
    </div>
  )
}

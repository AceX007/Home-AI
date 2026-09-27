import { useState } from 'react'
import type { DesignListItem } from '@homeai/core'
import { HxEmpty } from '../../layout/HxPage'
import { useWorkbench } from '../../store/useWorkbench'

const TEMPLATES: Array<{ id: string; label: string }> = [
  { id: 'blank', label: 'Blank' },
  { id: 'mobile', label: 'Mobile app design' },
  { id: 'slides', label: 'Slides' },
  { id: 'doc', label: 'Document' },
  { id: 'wire', label: 'Wireframe' },
  { id: 'anim', label: 'Animation' },
  { id: 'ui', label: 'UI mockups' },
  { id: 'resume', label: 'Résumé' },
  { id: '3d', label: '3D object' },
  { id: 'research', label: 'Research' },
  { id: 'email', label: 'HTML email' },
  { id: 'type', label: 'Color + type pairing' }
]

export default function DesignHome(props: {
  prompt: string
  onPrompt: (s: string) => void
  template: string
  onTemplate: (id: string) => void
  onCreate: () => void
  onOpen: (id: string) => void
  projects: DesignListItem[]
  creating?: boolean
  q: string
  onQ: (s: string) => void
  tab: 'projects' | 'systems' | 'templates'
  onTab: (t: 'projects' | 'systems' | 'templates') => void
  ingestNote?: string
  onIngest?: () => void
}) {
  const w = useWorkbench()
  const mind = w.provider === 'openai' || w.provider === 'openrouter' ? w.provider : 'local'
  const localBlocked =
    mind === 'local' && (w.kernelPulse?.llama === 'off' || w.kernelPulse?.llama === 'missing')
  const [layout, setLayout] = useState<'star' | 'list' | 'grid'>('list')
  const projects = (props.projects ?? []).filter(
    (p) => !props.q || p.name.toLowerCase().includes(props.q.toLowerCase()) || p.slug.toLowerCase().includes(props.q.toLowerCase())
  )
  const when = (ms: number) => {
    const d = Date.now() - ms
    if (d < 60_000) return 'just now'
    if (d < 3600_000) return `${Math.floor(d / 60_000)}m ago`
    if (d < 86_400_000) return `${Math.floor(d / 3600_000)}h ago`
    return new Date(ms).toLocaleDateString()
  }

  return (
    <div className="cd-home">
      <header className="cd-home-top">
        <div>
          <p className="hx-kicker">Hex AI</p>
          <h1>Design</h1>
          <p className="hx-lead">Brief below grows a DesignIR under designs/*.json. Local 2B is the default mind.</p>
        </div>
      </header>
      <div className="cd-create">
        <textarea
          rows={2}
          value={props.prompt}
          placeholder="Make a pitch deck for a new product"
          onChange={(e) => props.onPrompt(e.target.value.slice(0, 2000))}
        />
        <div className="cd-create-bar">
          <label>
            Model
            <select
              value={w.provider === 'openai' || w.provider === 'openrouter' ? w.provider : 'local'}
              onChange={(e) => {
                const v = e.target.value
                useWorkbench.setState({
                  provider: v === 'openai' || v === 'openrouter' ? v : 'local'
                })
              }}
            >
              <option value="local">Local 2B</option>
              <option value="openai">OpenAI</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </label>
          <button
            type="button"
            className="cd-go"
            onClick={props.onCreate}
            aria-label="Create"
            disabled={props.creating || localBlocked}
            title={localBlocked ? 'Local 2B is offline' : 'Create'}
          >
            ↑
          </button>
        </div>
        <div className="cd-kind">
          <p className="hx-hint">Kind (seeds the first DesignIR page, not a Claude template gallery)</p>
          <div className="hx-row">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" className={props.template === t.id ? 'ghost primary' : 'ghost'} onClick={() => props.onTemplate(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="cd-proj">
        <div className="cd-proj-bar">
          <div className="cd-seg">
            {(['projects', 'systems', 'templates'] as const).map((k) => (
              <button key={k} type="button" className={props.tab === k ? 'on' : ''} onClick={() => props.onTab(k)}>
                {k === 'projects' ? 'Projects' : k === 'systems' ? 'Design systems' : 'Templates'}
              </button>
            ))}
          </div>
          <input value={props.q} placeholder="Search" onChange={(e) => props.onQ(e.target.value.slice(0, 80))} />
          <div className="cd-view-btns">
            <button type="button" className={layout === 'star' ? 'on' : ''} title="Starred" onClick={() => setLayout('star')}>
              ★
            </button>
            <button type="button" className={layout === 'list' ? 'on' : ''} title="List" onClick={() => setLayout('list')}>
              ≡
            </button>
            <button type="button" className={layout === 'grid' ? 'on' : ''} title="Grid" onClick={() => setLayout('grid')}>
              ▦
            </button>
          </div>
        </div>
        {props.tab === 'systems' ? (
          <>
          <HxEmpty
            title="No design systems linked"
            body="GitHub sync is out of scope. Import a local DTCG file from designs/*.json (path is allowlisted in main)."
            actions={
              <button type="button" className="cd-save" onClick={props.onIngest}>
                Import designs/tokens.json
              </button>
            }
          />
          {props.ingestNote ? <p className="cd-empty">{props.ingestNote}</p> : null}
          </>
        ) : props.tab === 'templates' ? (
          <div className="hx-row">
            {TEMPLATES.filter((t) => !props.q || t.label.toLowerCase().includes(props.q.toLowerCase())).map((t) => (
              <button key={t.id} type="button" className={props.template === t.id ? 'ghost primary' : 'ghost'} onClick={() => props.onTemplate(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        ) : layout === 'star' ? (
          <HxEmpty
            title="Starred is not stored"
            body="This kernel does not keep a starred list. Use List or Grid for designs/*.json projects."
          />
        ) : layout === 'grid' ? (
          <div className="cd-grid-list">
            {projects.map((p) => (
              <button key={p.slug} type="button" className="cd-grid-card" onClick={() => props.onOpen(p.slug)}>
                <span className="cd-thumb" />
                <strong>{p.name}</strong>
                <small>{when(p.mtime)}</small>
              </button>
            ))}
            {projects.length === 0 ? (
              <HxEmpty compact title="No matching projects" body="Type a brief and hit ↑ — Design generates screens you can open and edit." />
            ) : null}
          </div>
        ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Last viewed</th>
              <th>Where</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.slug}>
                <td>
                  <button type="button" className="cd-proj-name" onClick={() => props.onOpen(p.slug)}>
                    <span className="cd-thumb" />
                    {p.name}
                  </button>
                </td>
                <td>{when(p.mtime)}</td>
                <td>You · local</td>
              </tr>
            ))}
            {projects.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <HxEmpty
                    compact
                    title="No projects yet"
                    body="Type a brief and hit ↑ — Design generates screens you can open and edit."
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        )}
      </div>
    </div>
  )
}

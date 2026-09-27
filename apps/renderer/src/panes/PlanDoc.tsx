import { Check } from 'lucide-react'
import { HxEmpty } from '../layout/HxPage'
import { useWorkbench } from '../store/useWorkbench'
import { parseThinkFront } from '@homeai/runtime/browser'

type Block =
  | { t: 'h'; d: number; s: string }
  | { t: 'p'; s: string }
  | { t: 'li'; s: string }
  | { t: 'todo'; done: boolean; s: string }
  | { t: 'todos'; n: number }
  | { t: 'refs'; agents: string[] }

function parse(md: string): Block[] {
  const out: Block[] = []
  const agents: string[] = []
  let collectingRefs = false
  for (const raw of md.split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) continue
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      const s = h[2]
      if (/^referenced by/i.test(s)) {
        collectingRefs = true
        continue
      }
      collectingRefs = false
      const todoHead = /^(\d+)\s+To-dos?/i.exec(s)
      if (todoHead) out.push({ t: 'todos', n: Number(todoHead[1]) })
      else out.push({ t: 'h', d: h[1].length, s })
      continue
    }
    const todo = /^[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line)
    if (todo) {
      collectingRefs = false
      out.push({ t: 'todo', done: todo[1] !== ' ', s: todo[2] })
      continue
    }
    const li = /^[-*]\s+(.*)$/.exec(line)
    if (li) {
      if (collectingRefs) {
        agents.push(li[1])
        continue
      }
      out.push({ t: 'li', s: li[1] })
      continue
    }
    collectingRefs = false
    out.push({ t: 'p', s: line })
  }
  if (agents.length) out.push({ t: 'refs', agents })
  return out
}

function isPathish(s: string): boolean {
  if (s.length > 180 || /\s/.test(s)) return false
  return /[./]/.test(s) && !s.startsWith('http')
}

function resolveLinked(workspace: string, planPath: string, rel: string): string {
  const n = rel.replace(/\\/g, '/').replace(/^\.\//, '')
  if (n.startsWith('/')) return n
  const root = workspace.replace(/\/$/, '')
  const dir = planPath.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
  if (n.startsWith('RAG/') || n.startsWith('apps/') || n.startsWith('packages/') || n.startsWith('docs/')) {
    return `${root}/${n}`
  }
  return `${dir}/${n}`
}

function linkedResources(md: string, workspace: string, planPath: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of md.matchAll(/`([^`]+)`/g)) {
    const raw = m[1]
    if (!isPathish(raw)) continue
    const abs = resolveLinked(workspace, planPath, raw)
    if (seen.has(abs)) continue
    seen.add(abs)
    out.push(abs)
  }
  return out.slice(0, 12)
}

function rich(s: string, open?: (path: string) => void, workspace?: string, planPath?: string) {
  const parts = s.split(/(`[^`]+`)/g)
  return parts.map((p, i) => {
    if (!(p.startsWith('`') && p.endsWith('`'))) return <span key={i}>{p}</span>
    const inner = p.slice(1, -1)
    if (open && workspace && planPath && isPathish(inner)) {
      const abs = resolveLinked(workspace, planPath, inner)
      return (
        <button key={i} type="button" className="plan-code linkish" onClick={() => open(abs)}>
          {inner}
        </button>
      )
    }
    return (
      <code key={i} className="plan-code">
        {inner}
      </code>
    )
  })
}

export default function PlanDoc({ path, content }: { path: string; content: string }) {
  const w = useWorkbench()
  const blocks = parse(content)
  const mapRefs = (w.map.edges ?? []).filter((e) => e.dst === path || e.src === path).length
  const related = (w.map.nodes ?? []).filter((n) => n.kind !== 'session').slice(0, 3)
  const parsedRefs = blocks.find((b) => b.t === 'refs')
  const agentNames =
    parsedRefs && parsedRefs.t === 'refs'
      ? parsedRefs.agents
      : related[0]
        ? [related[0].title]
        : [w.chats.find((c) => c.title !== 'New agent')?.title || 'Hex AI Kernel v2']
  const todosN = blocks.filter((x) => x.t === 'todo').length
  const name = path.split('/').pop() ?? path
  const model = w.provider === 'local' ? 'local 2B' : w.provider
  const workspace = w.boot?.workspace ?? ''
  const links = workspace ? linkedResources(content, workspace, path) : []
  const open = (p: string) => void w.openFile(p)
  const think = /\.think\.md$/i.test(path.replace(/\\/g, '/'))
  const thinkFm = think ? parseThinkFront(content) : null
  const canImplement = thinkFm && (thinkFm.status === 'ready' || thinkFm.status === 'implementing')

  const toggle = async (text: string, done: boolean) => {
    const next = content
      .split('\n')
      .map((ln) => {
        if (ln.includes(text) && /\[([ xX])\]/.test(ln)) {
          return ln.replace(/\[[ xX]\]/, done ? '[ ]' : '[x]')
        }
        return ln
      })
      .join('\n')
    w.setContent(path, next)
    await window.homeai.write(path, next)
  }

  return (
    <div className="plan-wrap">
      <div className="plan-chrome">
        <div>
          <p className="hx-kicker">Hex AI</p>
          <div className="plan-crumbs">
            <span>Plans</span>
            <span className="sep">›</span>
            <span>{name}</span>
          </div>
        </div>
        <div className="plan-built">
          {model}
          <span className="sep">|</span>
          {think ? (
            <>
              <span className="built">Think · {thinkFm?.status || 'draft'}</span>
              {canImplement ? (
                <>
                  <span className="sep">|</span>
                  <button
                    type="button"
                    className="ghost tiny"
                    aria-label={thinkFm?.status === 'implementing' ? 'Resume implement' : 'Implement'}
                    title="Implement this think file"
                    onClick={() => void w.implementThink(path)}
                  >
                    {thinkFm?.status === 'implementing' ? 'Resume' : 'Implement'}
                  </button>
                </>
              ) : null}
            </>
          ) : thinkFm?.status === 'done' ? (
            <span className="built">
              <Check size={12} /> Built
            </span>
          ) : (
            <button
              type="button"
              className="ghost tiny"
              aria-label="Build this plan"
              title="Run the kernel against this plan"
              onClick={() => {
                useWorkbench.setState({ agentMode: 'agent', chatOpen: true })
                w.run(`Build this plan. Follow ${path} exactly. Execute remaining unchecked todos in order.`)
              }}
            >
              Build
            </button>
          )}
        </div>
      </div>
      {think && thinkFm ? (
        <div className="plan-pipe">
          {['draft', 'ready', 'implementing', 'done'].map((s) => (
            <span key={s} className={thinkFm.status === s || (s === 'draft' && !thinkFm.status) ? 'on' : ''}>
              {s}
            </span>
          ))}
        </div>
      ) : null}
      {think && thinkFm?.files?.length ? (
        <div className="plan-files">
          {thinkFm.files.slice(0, 12).map((f) => (
            <button
              key={f}
              type="button"
              className="plan-link-chip"
              onClick={() => workspace && void w.openFile(`${workspace}/${f}`)}
            >
              {f.split('/').pop()}
            </button>
          ))}
        </div>
      ) : null}
      {links.length > 0 ? (
        <div className="plan-links">
          {links.map((p) => (
            <button key={p} type="button" className="plan-link-chip" onClick={() => open(p)}>
              {p.split('/').pop()}
            </button>
          ))}
        </div>
      ) : null}
      {blocks.length === 0 ? (
        <HxEmpty
          title="This plan is empty"
          body="Think writes RAG/plans/*.think.md. Add headings and unchecked to-dos. Backtick paths stay text links, not HTML."
        />
      ) : (
      <div className="plan-doc">
        {blocks.map((b, i) => {
          if (b.t === 'h')
            return (
              <h2 key={i} className={b.s.toLowerCase().includes('honesty') ? 'plan-h2' : `plan-h${b.d}`}>
                {b.s}
              </h2>
            )
          if (b.t === 'todos') {
            const n = blocks.filter((x) => x.t === 'todo').length || b.n
            return (
              <div key={i} className="plan-todos-head">
                <span>{n} To-dos</span>
                <button
                  type="button"
                  className="ghost tiny"
                  aria-label="Add to-do"
                  onClick={() => {
                    const next = `${content.trimEnd()}\n- [ ] New task\n`
                    w.setContent(path, next)
                    void window.homeai.write(path, next)
                  }}
                >
                  + New
                </button>
              </div>
            )
          }
          if (b.t === 'todo')
            return (
              <button
                type="button"
                key={i}
                className={`plan-todo ${b.done ? 'done' : ''}`}
                onClick={() => void toggle(b.s, b.done)}
              >
                <span className="plan-check">{b.done ? <Check size={11} strokeWidth={3} /> : null}</span>
                <span className="plan-todo-text">{rich(b.s, open, workspace, path)}</span>
                <span className="plan-dot" />
              </button>
            )
          if (b.t === 'refs') return null
          if (b.t === 'li')
            return (
              <div key={i} className="plan-li">
                {rich(b.s, open, workspace, path)}
              </div>
            )
          return (
            <p key={i} className="plan-p">
              {rich(b.s, open, workspace, path)}
            </p>
          )
        })}
        <div className="plan-refs">
          Referenced by {Math.max(mapRefs, agentNames.length)} Agent
          {agentNames.map((title) => (
            <button key={title} type="button" className="plan-ref-chip" onClick={() => w.openAgent(title)}>
              <span className="plan-ref-title">{title}</span>
              <span className="plan-ref-meta">
                {' '}
                · Author{todosN ? ` · ${todosN} todos assigned` : ''}
              </span>
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  )
}

export function isPlanPath(path?: string): boolean {
  if (!path) return false
  const n = path.replace(/\\/g, '/')
  return n.endsWith('.plan.md') || n.includes('/RAG/plans/')
}

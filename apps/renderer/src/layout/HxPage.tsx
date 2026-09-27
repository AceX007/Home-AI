import type { ReactNode } from 'react'

/** Shared Hex AI page chrome. Titles and leads are React text nodes only. */
export function HxPage({
  kicker = 'Hex AI',
  title,
  lead,
  actions,
  children
}: {
  kicker?: string
  title: string
  lead?: string
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="hx-page">
      <header className="hx-hero">
        <p className="hx-kicker">{kicker}</p>
        <div className="hx-hero-row">
          <h1>{title}</h1>
          {actions ? <div className="hx-hero-act">{actions}</div> : null}
        </div>
        {lead ? <p className="hx-lead">{lead}</p> : null}
      </header>
      <div className="hx-page-body">{children}</div>
    </div>
  )
}

export function HxEmpty({
  title,
  body,
  actions,
  compact
}: {
  title: string
  body: string
  actions?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={compact ? 'hx-empty compact' : 'hx-empty'}>
      <p className="hx-kicker">Ready</p>
      <h2>{title}</h2>
      <p>{body}</p>
      {actions ? <div className="hx-empty-act">{actions}</div> : null}
    </div>
  )
}

export function HxSideHead({
  title,
  hint,
  actions
}: {
  title: string
  hint?: string
  actions?: ReactNode
}) {
  return (
    <div className="hx-side-head">
      <p className="hx-kicker">Hex AI</p>
      <div className="hx-side-row">
        <h2>{title}</h2>
        {actions ? <div className="hx-side-act">{actions}</div> : null}
      </div>
      {hint ? <p className="hx-side-hint">{hint}</p> : null}
    </div>
  )
}

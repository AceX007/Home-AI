import { Component, type ErrorInfo, type ReactNode } from 'react'
import { HxEmpty } from './HxPage'

type Props = { children: ReactNode; label: string }
type State = { err: string }

export default class PaneErrorBoundary extends Component<Props, State> {
  state: State = { err: '' }

  static getDerivedStateFromError(e: Error): State {
    return { err: String(e?.message || e).replace(/[<>]/g, '').slice(0, 240) }
  }

  componentDidCatch(e: Error, info: ErrorInfo) {
    console.error(this.props.label, e, info.componentStack)
  }

  render() {
    if (this.state.err) {
      return (
        <HxEmpty
          title={`${this.props.label} failed to render`}
          body={this.state.err}
          actions={
            <button type="button" className="ghost" onClick={() => this.setState({ err: '' })}>
              Retry
            </button>
          }
        />
      )
    }
    return this.props.children
  }
}

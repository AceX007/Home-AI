import { chromeRoute } from '@homeai/runtime/browser'
import { useWorkbench } from '../store/useWorkbench'

/** Bible pills: Chat and Cowork | Code | Design. Stage is kebab Open in, not a fourth pill. */
export function StagePills() {
  const w = useWorkbench()
  const route = chromeRoute(w.activity, w.cowork)
  return (
    <div className="sess-pills">
      <button
        type="button"
        className={route === 'cowork' ? 'on' : ''}
        onClick={() => {
          w.setActivity('files')
          useWorkbench.setState({ cowork: true, chatOpen: true })
        }}
      >
        Chat and Cowork
      </button>
      <button
        type="button"
        className={route === 'code' ? 'on' : ''}
        title="Code session"
        onClick={() => {
          w.setActivity('files')
          useWorkbench.setState({ cowork: false, chatOpen: true })
        }}
      >
        Code
      </button>
      <button
        type="button"
        className={route === 'design' ? 'on' : ''}
        onClick={() => w.setActivity('design')}
      >
        Design
      </button>
    </div>
  )
}

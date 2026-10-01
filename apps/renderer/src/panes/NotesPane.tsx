import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { wikiNoteRel } from '@homeai/runtime/browser'
import { HxEmpty, HxSideHead } from '../layout/HxPage'
import { useWorkbench } from '../store/useWorkbench'

function wikiNames(body: string): string[] {
  const out: string[] = []
  const re = /\[\[([^\]\n]{1,64})\]\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const rel = wikiNoteRel(m[1])
    if (rel && !out.includes(rel)) out.push(rel)
  }
  return out
}

export default function NotesPane({ listOnly }: { listOnly?: boolean }) {
  const w = useWorkbench()
  const [title, setTitle] = useState('new-note')
  const [wikiMiss, setWikiMiss] = useState('')

  const open = async (path: string) => {
    const body = await window.homeai.read(path)
    useWorkbench.setState({ notePath: path, noteBody: body })
    w.setActivity('notes')
  }

  if (listOnly) {
    return (
      <>
        <HxSideHead
          title="Notes"
          hint="New writes notes/*.md, then the editor opens on the right."
          actions={
            <button
              type="button"
              className="ghost"
              onClick={async () => {
                const name = `${title.replace(/\s+/g, '-').toLowerCase()}.md`
                const path = `${w.boot?.root}/notes/${name}`
                await window.homeai.write(path, `# ${title}\n\n`)
                await w.refreshGrounds()
                await open(path)
              }}
            >
              New
            </button>
          }
        />
        <input
          className="side-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="new note name"
        />
        <div className="notes-list">
          {w.notes.length === 0 ? (
            <HxEmpty compact title="No notes yet" body="New writes notes/*.md, then the editor opens on the right." />
          ) : (
            w.notes.map((n) => (
              <button key={n.path} type="button" className="note-row" onClick={() => void open(n.path)}>
                <strong>{n.title}</strong>
                <small>{n.preview}</small>
              </button>
            ))
          )}
        </div>
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <HxSideHead
        title={w.notePath?.split('/').pop() ?? 'Notes'}
        hint="Wiki links: [[other-note]]. Pick a note in the sidebar, or create one there."
        actions={
          <button
            type="button"
            className="ghost"
            disabled={!w.notePath}
            title={w.notePath ? 'Save note' : 'Pick a note in the sidebar first'}
            onClick={async () => {
              if (!w.notePath) return
              await window.homeai.write(w.notePath, w.noteBody)
              await w.refreshGrounds()
            }}
          >
            Save
          </button>
        }
      />
      {wikiNames(w.noteBody).length ? (
        <div className="mention-chips">
          {wikiNames(w.noteBody).map((rel) => (
            <button
              key={rel}
              type="button"
              className="chip"
              onClick={() => {
                const root = w.boot?.workspace
                if (!root) return
                setWikiMiss('')
                void open(`${root}/${rel}`).catch(() => setWikiMiss(rel))
              }}
            >
              {rel.split('/').pop()}
            </button>
          ))}
        </div>
      ) : null}
      <div style={{ flex: 1, minHeight: 0 }}>
        {w.notePath ? (
          <Editor
            theme="vs-dark"
            language="markdown"
            value={w.noteBody}
            onChange={(v) => useWorkbench.setState({ noteBody: v ?? '' })}
            options={{ wordWrap: 'on', minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
          />
        ) : (
          <HxEmpty
            title="Pick a note"
            body="Pick a note in the sidebar, or create one there. Wiki links: [[other-note]]."
          />
        )}
      </div>
    </div>
  )
}

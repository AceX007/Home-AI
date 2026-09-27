import { useEffect, useState } from 'react'
import { ChevronRight, File, FileCode, FileJson, FileText, Folder, FilePlus, FolderPlus } from 'lucide-react'
import type { FileEntry, GitFileStatus } from '@homeai/core'
import { HxEmpty, HxSideHead } from '../layout/HxPage'
import { useWorkbench } from '../store/useWorkbench'
import GitDensity from './GitDensity'

function gitMark(files: GitFileStatus[], rel: string, dir: boolean): { letter: string; cls: string } | null {
  const hits = files.filter((f) => {
    const n = f.path.replace(/\\/g, '/').replace(/^.* -> /, '').replace(/^"|"$/g, '')
    if (dir) return n === rel || n.startsWith(`${rel}/`)
    return n === rel || n.endsWith(`/${rel}`) || n.split('/').pop() === rel.split('/').pop()
  })
  if (!hits.length) return null
  const xy = hits[0].xy || ' M'
  if (xy.includes('?')) return { letter: 'U', cls: 'git-u' }
  if (xy.includes('A')) return { letter: 'A', cls: 'git-a' }
  if (xy.includes('D')) return { letter: 'D', cls: 'git-d' }
  if (xy.includes('R')) return { letter: 'R', cls: 'git-r' }
  return { letter: 'M', cls: 'git-m' }
}

function FileIco({ name, dir }: { name: string; dir: boolean }) {
  if (dir) return <Folder size={14} className="ico" />
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx' || ext === 'py') {
    return <FileCode size={14} className="ico ico-code" />
  }
  if (ext === 'json') return <FileJson size={14} className="ico ico-json" />
  if (ext === 'md' || ext === 'txt') return <FileText size={14} className="ico ico-md" />
  return <File size={14} className="ico" />
}

function safeName(raw: string): string | null {
  const s = raw.trim()
  if (!s || s.includes('/') || s.includes('\\') || s.includes('..') || s.includes('\0')) return null
  if (/\.key$/i.test(s) || /^\.env(\.|$)/.test(s)) return null
  if (!/^[\w][\w.\- ]{0,79}$/.test(s)) return null
  return s
}

function Node({
  entry,
  depth,
  root,
  filter,
  onMenu
}: {
  entry: FileEntry
  depth: number
  root: string
  filter: string
  onMenu: (e: React.MouseEvent, entry: FileEntry) => void
}) {
  const w = useWorkbench()
  const [open, setOpen] = useState(false)
  const [kids, setKids] = useState<FileEntry[] | null>(null)

  const toggle = async () => {
    if (!entry.dir) {
      await w.openFile(entry.path)
      return
    }
    const next = !open
    setOpen(next)
    if (next && !kids) {
      setKids((await window.homeai.list(entry.path)) as FileEntry[])
    }
  }

  const gitFiles = useWorkbench((s) => s.gitFiles)
  const active = useWorkbench((s) => s.activePath)
  const treeFocus = useWorkbench((s) => s.treeFocus)
  const rel = entry.path.replace(/\\/g, '/').replace(root.replace(/\\/g, '/').replace(/\/$/, '') + '/', '')
  const mark = gitMark(gitFiles, rel, entry.dir)
  const q = filter.trim().toLowerCase()

  useEffect(() => {
    if (!entry.dir || !treeFocus) return
    const relNorm = rel.replace(/\\/g, '/')
    if (treeFocus !== relNorm && !treeFocus.startsWith(`${relNorm}/`)) return
    setOpen(true)
    void window.homeai.list(entry.path).then((rows) => setKids(Array.isArray(rows) ? (rows as FileEntry[]) : []))
  }, [treeFocus, entry.dir, entry.path, rel])

  if (q && !entry.name.toLowerCase().includes(q) && !entry.dir) return null

  return (
    <>
      <div
        className={`file ${!entry.dir && active === entry.path ? 'active-file' : ''}`}
        style={{ ['--pad' as string]: `${8 + depth * 12}px` }}
        onClick={() => void toggle()}
        onContextMenu={(e) => {
          e.preventDefault()
          onMenu(e, entry)
        }}
      >
        {depth > 0 ? <span className="indent-guide" /> : null}
        {entry.dir ? (
          <ChevronRight size={12} style={{ transform: open ? 'rotate(90deg)' : undefined }} />
        ) : (
          <span style={{ width: 12 }} />
        )}
        <FileIco name={entry.name} dir={entry.dir} />
        <span className="file-name">{entry.name}</span>
        {mark ? (
          <span
            className={`git-letter ${mark.cls}`}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              if (entry.path.includes('..')) return
              void w.openFile(entry.path)
              useWorkbench.setState({ reviewOpen: true })
              useWorkbench.getState().setActivity('files')
            }}
          >
            {mark.letter}
          </span>
        ) : null}
      </div>
      {open && kids?.map((k) => (
        <Node key={k.path} entry={k} depth={depth + 1} root={root} filter={filter} onMenu={onMenu} />
      ))}
    </>
  )
}

export default function FileTreePane() {
  const w = useWorkbench()
  const tree = useWorkbench((s) => s.tree)
  const path = useWorkbench((s) => s.treePath)
  const [filter, setFilter] = useState('')
  const [draft, setDraft] = useState<{ kind: 'file' | 'folder' | 'rename'; dir: string; name: string; from?: string } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null)
  const [note, setNote] = useState('')
  const q = filter.trim().toLowerCase()
  const visible = tree.filter((e) => !q || e.dir || e.name.toLowerCase().includes(q))

  const refresh = async () => {
    const treeNext = (await window.homeai.list(path)) as FileEntry[]
    useWorkbench.setState({ tree: treeNext })
  }

  const parentOf = (entry: FileEntry) => (entry.dir ? entry.path : entry.path.replace(/\/[^/]+$/, '') || path)

  const commit = async () => {
    if (!draft) return
    const name = safeName(draft.name)
    if (!name) {
      setNote('Name refused.')
      return
    }
    try {
      if (draft.kind === 'folder') {
        await window.homeai.mkdir(`${draft.dir}/${name}`)
      } else if (draft.kind === 'file') {
        await window.homeai.write(`${draft.dir}/${name}`, '')
        await w.openFile(`${draft.dir}/${name}`)
      } else if (draft.from) {
        const dest = `${draft.dir}/${name}`
        await window.homeai.rename(draft.from, dest)
        if (w.activePath === draft.from) useWorkbench.setState({ activePath: dest })
      }
      setDraft(null)
      setNote('')
      await refresh()
      await w.refreshGit()
    } catch {
      setNote('Tree change refused.')
    }
  }

  const remove = async (entry: FileEntry) => {
    if (!window.confirm(`Delete ${entry.name}?`)) return
    try {
      await window.homeai.remove(entry.path)
      if (w.activePath === entry.path) w.closeTab(entry.path)
      await refresh()
      await w.refreshGit()
    } catch {
      setNote('Delete refused (dir not empty or jailed).')
    }
  }

  return (
    <>
      <HxSideHead
        title={path.split('/').pop() || 'Files'}
        hint="Workspace files. Filter, then new file or folder. Names are jailed."
      />
      <div className="explorer-tools">
        <input
          value={filter}
          placeholder="Filter"
          onChange={(e) => setFilter(e.target.value)}
        />
        <button type="button" title="New file" onClick={() => setDraft({ kind: 'file', dir: path, name: '' })}>
          <FilePlus size={14} />
        </button>
        <button type="button" title="New folder" onClick={() => setDraft({ kind: 'folder', dir: path, name: '' })}>
          <FolderPlus size={14} />
        </button>
      </div>
      {draft ? (
        <div className="explorer-draft">
          <input
            autoFocus
            value={draft.name}
            placeholder={draft.kind}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commit()
              if (e.key === 'Escape') setDraft(null)
            }}
          />
        </div>
      ) : null}
      {note ? <div className="explorer-note">{note}</div> : null}
      <GitDensity />
      <div className="tree" onClick={() => setMenu(null)}>
        {tree.length === 0 ? (
          <HxEmpty compact title="Empty folder" body="New file or New folder in the toolbar. This tree is the workspace root." />
        ) : q && visible.length === 0 ? (
          <HxEmpty compact title="No matching files" body="Filter matches names in this list. Clear the filter or open a folder." />
        ) : (
          tree.map((e) => (
          <Node
            key={e.path}
            entry={e}
            depth={0}
            root={path}
            filter={filter}
            onMenu={(ev, entry) => setMenu({ x: ev.clientX, y: ev.clientY, entry })}
          />
          ))
        )}
      </div>
      {menu ? (
        <div className="tree-menu" style={{ left: menu.x, top: menu.y }}>
          {!menu.entry.dir ? (
            <button type="button" onClick={() => { void w.openFile(menu.entry.path); setMenu(null) }}>
              Open
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setDraft({ kind: 'file', dir: parentOf(menu.entry), name: '' })
              setMenu(null)
            }}
          >
            New file
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft({ kind: 'folder', dir: parentOf(menu.entry), name: '' })
              setMenu(null)
            }}
          >
            New folder
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft({
                kind: 'rename',
                dir: menu.entry.path.replace(/\/[^/]+$/, '') || path,
                name: menu.entry.name,
                from: menu.entry.path
              })
              setMenu(null)
            }}
          >
            Rename
          </button>
          <button type="button" onClick={() => { void remove(menu.entry); setMenu(null) }}>
            Delete
          </button>
        </div>
      ) : null}
    </>
  )
}

import { existsSync } from 'node:fs'
import { mkdir, writeFile, chmod } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { GROUND_DIRS, RAG_SUBDIRS } from '@homeai/core'
import { seedPermissions, takeLibraryStub } from '@homeai/runtime'

const RAG_READMES: Record<string, string> = {
  code: '# RAG / code\n\nDrop working code here. Hex AI chunks functions and indexes them.\n',
  thoughts: '# Thoughts\n\nScratch thinking. The agent retrieves these when relevant.\n',
  discoveries: '# Discoveries\n\nAuto-written after successful Forge runs. You can edit them.\n',
  conversations: '# Conversations\n\nPaste or save important chats to keep them in memory.\n',
  maps: '# Maps\n\nHuman notes for the conversation graph. The live graph lives in SQLite.\n',
  skills: '# Skills\n\nCursor-style SKILL.md folders or markdown cards.\n',
  rules: '# Rules\n\nStanding instructions. Short beats long.\n',
  routines: '# Routines\n\nRepeatable checklists the agent can follow.\n',
  tasks: '# Tasks\n\nFreeform task notes. The kanban lives in taskboards/.\n',
  plans: '# Plans\n\nPlan mode writes `.plan.md`. Think mode writes `.think.md` (local 2B). Implement runs Agent against a ready think file.\n',
  library: '# Library\n\nPer-repo roadmap, features, required tests, and edge cases. See ROADMAP.md.\n',
  recipes: '# Recipes\n\nReusable delivery cards. Skill recipe-refine.\n'
}

export async function seedWorkspace(root: string): Promise<void> {
  const subdirs = [...RAG_SUBDIRS, 'plans'] as const
  for (const name of subdirs) {
    const dir = join(root, 'RAG', name)
    await mkdir(dir, { recursive: true })
    const readme = join(dir, 'README.md')
    if (!existsSync(readme)) await writeFile(readme, RAG_READMES[name] ?? `# ${name}\n`, 'utf8')
  }
  for (const name of GROUND_DIRS) {
    await mkdir(join(root, name), { recursive: true })
  }
  await mkdir(join(root, 'data', 'secrets'), { recursive: true })
  await mkdir(join(root, 'data', 'debug'), { recursive: true })
  await mkdir(join(root, 'mods'), { recursive: true })
  await chmod(join(root, 'data', 'secrets'), 0o700).catch(() => undefined)
  seedPermissions(root)

  const ignore = join(root, '.homeaiignore')
  if (!existsSync(ignore)) {
    await writeFile(
      ignore,
      `# Hex AI tool ignore (also honors .gitignore + .cursorignore)
node_modules/
out/
dist/
vendor/
data/
*.gguf
cursor_*.amd64/
cursor_*.deb
`,
      'utf8'
    )
  }

  const agents = join(root, 'AGENTS.md')
  if (!existsSync(agents)) {
    await writeFile(
      agents,
      `# AGENTS.md — Hex AI Kernel

This file is standing law for any agent in this workspace (Hex AI or Cursor).

## How to work
- PERCEIVE with \`explore\` first. Do not dump grep into the parent context.
- Surgical \`str_replace\`. New files only via \`fs_write\`.
- Ask with \`ask_user\` when the product decision is not yours.
- Plan mode writes \`RAG/plans/\` only. Debug mode logs hypotheses to \`data/debug/\`.
- Local 2B is default. Cloud is muscle, never required.

## Safety
- Stay inside the workspace.
- Shell and network go through allowlist / human approval.
- Do not copy Cursor proprietary bits from any \`.deb\`.
`,
      'utf8'
    )
  }

  const board = join(root, 'taskboards', 'default.json')
  if (!existsSync(board)) {
    await writeFile(
      board,
      JSON.stringify(
        {
          id: 'default',
          title: 'Workbench',
          columns: [
            { id: 'backlog', title: 'Backlog' },
            { id: 'doing', title: 'Doing' },
            { id: 'review', title: 'Review' },
            { id: 'done', title: 'Done' }
          ],
          cards: [
            {
              id: 'welcome',
              title: 'Index RAG and load the 2B',
              body: 'Open Chat, run doctor, then ask the local model to search memory.',
              column: 'backlog',
              createdAt: Date.now()
            }
          ]
        },
        null,
        2
      ),
      'utf8'
    )
  }

  const note = join(root, 'notes', 'welcome.md')
  if (!existsSync(note)) {
    await writeFile(
      note,
      '# Welcome to Hex AI\n\nThis notes ground is yours. Link ideas with `[[other-note]]`.\n\nThe 2B GGUF is the offline brain. Cloud keys in Settings are optional muscle.\n',
      'utf8'
    )
  }

  const qa = join(root, 'qa', 'golden.md')
  if (!existsSync(qa)) {
    await writeFile(
      qa,
      '# QA ground\n\nReplay Forge traces here. Mark pass/fail after you verify a skill still works.\n',
      'utf8'
    )
  }
  await seedLibraryIfMissing(root)
}

export async function seedLibraryIfMissing(root: string): Promise<void> {
  const stub = takeLibraryStub(new Date().toISOString().slice(0, 10))
  if (!stub) return
  const roadmap = join(root, 'RAG', 'library', 'ROADMAP.md')
  if (existsSync(roadmap)) return
  for (const [rel, body] of Object.entries(stub)) {
    if (rel.includes('..')) continue
    const dest = join(root, rel)
    await mkdir(dirname(dest), { recursive: true })
    if (!existsSync(dest)) await writeFile(dest, body, 'utf8')
  }
}

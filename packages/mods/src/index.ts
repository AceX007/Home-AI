import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ModManifest, RuleCard, SkillCard, ToolDef } from '@homeai/core'
import { skipSkillFile } from '../../runtime/src/search-proof.mjs'
import { parseSkillFrontMatter } from '../../runtime/src/front-matter.mjs'
import { packFromName } from '../../runtime/src/tool-packs.mjs'
import { cachedKnowledge } from './knowledge-stamp.mjs'

function read(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

function parseFrontMatter(md: string): { meta: Record<string, string>; body: string } {
  return parseSkillFrontMatter(md)
}

function walkMd(dir: string, acc: string[] = [], exts = ['.md', '.mdc']): string[] {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) walkMd(p, acc, exts)
    else if (exts.some((e) => name.endsWith(e))) acc.push(p)
  }
  return acc
}

export function loadModManifest(modDir: string): ModManifest | null {
  const p = join(modDir, 'mod.json')
  if (!existsSync(p)) return null
  try {
    const json = JSON.parse(read(p)) as Partial<ModManifest>
    if (!json.id || !json.name) return null
    return {
      id: json.id,
      name: json.name,
      version: json.version ?? '0.1.0',
      enabled: json.enabled !== false,
      description: json.description ?? '',
      permissions: json.permissions ?? ['read'],
      contributes: json.contributes
    }
  } catch {
    return null
  }
}

export function listMods(modsRoot: string): Array<{ dir: string; manifest: ModManifest }> {
  if (!existsSync(modsRoot)) return []
  const out: Array<{ dir: string; manifest: ModManifest }> = []
  for (const name of readdirSync(modsRoot)) {
    const dir = join(modsRoot, name)
    try {
      if (!statSync(dir).isDirectory()) continue
    } catch {
      continue
    }
    const manifest = loadModManifest(dir)
    if (manifest) out.push({ dir, manifest })
  }
  return out
}

function boolish(v?: string): boolean | undefined {
  if (v == null || v === '') return undefined
  return /^(true|1|yes)$/i.test(v)
}

function csv(v?: string): string[] | undefined {
  if (!v) return undefined
  const inner = v.replace(/^\[/, '').replace(/\]$/, '')
  const parts = inner
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
  return parts.length ? parts : undefined
}

export function loadSkillsFromDir(dir: string, source: string): SkillCard[] {
  const cards: SkillCard[] = []
  for (const file of walkMd(dir, [], ['.md'])) {
    const parts = file.split(/[\\/]/)
    const base = parts[parts.length - 1] ?? ''
    if (skipSkillFile(file)) continue
    if (base !== 'SKILL.md' && existsSync(join(dirname(file), 'SKILL.md'))) continue
    const { meta, body } = parseFrontMatter(read(file))
    const folder = file.split(/[\\/]/).slice(-2, -1)[0] || 'skill'
    const name = meta.name || (base === 'SKILL.md' ? folder : base.replace(/\.md$/, ''))
    cards.push({
      id: meta.id || `${source}:${file}`,
      name,
      description: meta.description || body.slice(0, 160).replace(/\n/g, ' '),
      body,
      source: file,
      slash: (meta.name || name).toLowerCase().replace(/\s+/g, '-'),
      disableModelInvocation: boolish(meta.disable_model_invocation)
    })
  }
  return cards
}

export function loadRulesFromDir(dir: string, source: string): RuleCard[] {
  const cards: RuleCard[] = []
  for (const file of walkMd(dir, [], ['.md', '.mdc'])) {
    const { meta, body } = parseFrontMatter(read(file))
    const globs = csv(meta.globs)
    const always = boolish(meta.alwaysApply)
    let kind: RuleCard['kind'] = 'always'
    if (globs?.length) kind = 'glob'
    else if (always === false) kind = 'manual'
    else if (meta.description && always !== true && !globs) kind = 'intelligent'
    cards.push({
      id: meta.id || `${source}:${file}`,
      title: meta.title || meta.name || file.split(/[\\/]/).pop() || 'rule',
      body,
      source: file,
      alwaysApply: always,
      globs,
      description: meta.description,
      kind
    })
  }
  return cards
}

function loadAgentsMd(dir: string, acc: RuleCard[], depth = 0): void {
  if (depth > 3 || !existsSync(dir)) return
  const file = join(dir, 'AGENTS.md')
  if (existsSync(file)) {
    acc.push({
      id: `agentsmd:${file}`,
      title: `AGENTS.md (${dir.split(/[\\/]/).pop()})`,
      body: read(file),
      source: file,
      alwaysApply: true,
      kind: 'always'
    })
  }
  let names: string[] = []
  try {
    names = readdirSync(dir)
  } catch {
    return
  }
  for (const name of names) {
    if (name === 'node_modules' || name === '.git' || name === 'out' || name === 'dist' || name === 'cursor_3.17.21_amd64')
      continue
    const p = join(dir, name)
    try {
      if (statSync(p).isDirectory() && !name.startsWith('.')) loadAgentsMd(p, acc, depth + 1)
    } catch {
      /* skip */
    }
  }
}

function skillSearchRoots(projectRoot: string): Array<{ dir: string; source: string }> {
  const home = process.env.HOME || ''
  return [
    { dir: join(projectRoot, '.cursor', 'skills'), source: 'project-cursor' },
    { dir: join(projectRoot, '.agents', 'skills'), source: 'project-agents' },
    { dir: join(projectRoot, '.homeai', 'skills'), source: 'project-homeai' },
    { dir: join(home, '.cursor', 'skills'), source: 'user-cursor' },
    { dir: join(home, '.agents', 'skills'), source: 'user-agents' },
    { dir: join(home, '.homeai', 'skills'), source: 'user-homeai' }
  ]
}

export { knowledgeStamp } from './knowledge-stamp.mjs'

function collectKnowledge(projectRoot: string): { mods: ModManifest[]; skills: SkillCard[]; rules: RuleCard[] } {
  const mods = listMods(join(projectRoot, 'mods'))
  const skills: SkillCard[] = []
  const rules: RuleCard[] = []
  for (const m of mods) {
    if (!m.manifest.enabled) continue
    skills.push(...loadSkillsFromDir(join(m.dir, 'skills'), m.manifest.id))
    rules.push(...loadRulesFromDir(join(m.dir, 'rules'), m.manifest.id))
  }
  skills.push(...loadSkillsFromDir(join(projectRoot, 'RAG', 'skills'), 'rag'))
  rules.push(...loadRulesFromDir(join(projectRoot, 'RAG', 'rules'), 'rag'))
  rules.push(...loadRulesFromDir(join(projectRoot, '.cursor', 'rules'), 'cursor-rules'))
  loadAgentsMd(projectRoot, rules, 0)
  for (const root of skillSearchRoots(projectRoot)) {
    skills.push(...loadSkillsFromDir(root.dir, root.source))
  }
  const seenSource = new Set<string>()
  const seenName = new Set<string>()
  const dedupSkills = skills.filter((s) => {
    if (seenSource.has(s.source)) return false
    seenSource.add(s.source)
    const key = s.name.toLowerCase()
    if (seenName.has(key)) return false
    seenName.add(key)
    return true
  })
  return { mods: mods.map((m) => m.manifest), skills: dedupSkills, rules }
}

export function loadAllKnowledge(projectRoot: string): { mods: ModManifest[]; skills: SkillCard[]; rules: RuleCard[] } {
  return cachedKnowledge(projectRoot, collectKnowledge)
}

export function matchSkills(skills: SkillCard[], query: string, limit = 4): SkillCard[] {
  const q = query.toLowerCase()
  return skills
    .map((s) => {
      const hay = `${s.name} ${s.description} ${s.body}`.toLowerCase()
      let score = 0
      for (const w of q.split(/\s+/).filter((x) => x.length > 2)) {
        if (hay.includes(w)) score += 1
      }
      return { s, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s)
}

export function builtinToolDefs(): ToolDef[] {
  const list: ToolDef[] = [
    {
      name: 'fs_read',
      description:
        'Read a UTF-8 text file. path is relative to the workspace, or to an extra-root folder when root is that folder basename (never a raw path).',
      permissions: ['read'],
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          root: { type: 'string', description: 'workspace (default) or extra-root folder basename' }
        },
        required: ['path']
      }
    },
    {
      name: 'fs_write',
      description:
        'Write a UTF-8 text file. Extra-root writes always Ask. root is an extra-root folder basename, never a path.',
      permissions: ['write'],
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
          root: { type: 'string' }
        },
        required: ['path', 'content']
      }
    },
    {
      name: 'fs_list',
      description: 'List a directory. Optional root is an extra-root folder basename.',
      permissions: ['read'],
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, root: { type: 'string' } },
        required: ['path']
      }
    },
    {
      name: 'grep',
      description: 'Search file contents with a regex.',
      permissions: ['read'],
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          path: { type: 'string' },
          glob: { type: 'string' }
        },
        required: ['pattern']
      }
    },
    {
      name: 'glob',
      description: 'Find files by glob (e.g. **/*.ts). Skips node_modules.',
      permissions: ['read'],
      parameters: {
        type: 'object',
        properties: { pattern: { type: 'string' } },
        required: ['pattern']
      }
    },
    {
      name: 'str_replace',
      description: 'Surgical edit: replace one unique old_string with new_string in a file.',
      permissions: ['write'],
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          old_string: { type: 'string' },
          new_string: { type: 'string' },
          root: { type: 'string', description: 'extra-root folder basename; writes always Ask' }
        },
        required: ['path', 'old_string', 'new_string']
      }
    },
    {
      name: 'rag_search',
      description: 'Search RAG / notes / skills memory.',
      permissions: ['read'],
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' }, limit: { type: 'number' } },
        required: ['query']
      }
    },
    {
      name: 'rag_write',
      description: 'Write a markdown document into RAG (thoughts, discoveries, skills, notes, plans). Plan folder is RAG/plans/*.md only — never .think.md.',
      permissions: ['write'],
      parameters: {
        type: 'object',
        properties: {
          folder: { type: 'string', description: 'code|thoughts|discoveries|skills|rules|notes|routines|plans' },
          name: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['folder', 'name', 'content']
      }
    },
    {
      name: 'git_status',
      description: 'Run git status in the workspace.',
      permissions: ['read'],
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'git_diff',
      description: 'Run git diff (optionally staged).',
      permissions: ['read'],
      parameters: {
        type: 'object',
        properties: { staged: { type: 'boolean' } }
      }
    },
    {
      name: 'terminal_run',
      description: 'Run a shell command in the workspace. Prefer non-interactive commands.',
      permissions: ['exec'],
      parameters: {
        type: 'object',
        properties: { command: { type: 'string' }, timeoutMs: { type: 'number' } },
        required: ['command']
      }
    },
    {
      name: 'http_fetch',
      description: 'HTTP GET a URL and return text (truncated).',
      permissions: ['net'],
      parameters: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url']
      }
    },
    {
      name: 'code_outline',
      description: 'List functions/classes in a source file.',
      permissions: ['read'],
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path']
      }
    },
    {
      name: 'test_run',
      description: 'Detect and run tests (npm test or pytest).',
      permissions: ['exec'],
      parameters: {
        type: 'object',
        properties: { kind: { type: 'string', description: 'auto|npm|pytest' } }
      }
    },
    {
      name: 'ask_user',
      description: 'Ask the human a clarifying question. Use when the task is ambiguous.',
      permissions: ['read'],
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } }
        },
        required: ['prompt']
      }
    },
    {
      name: 'explore',
      description: 'Fast codebase search. Returns a short digest of files + matching lines. Use instead of dumping grep into context.',
      permissions: ['read'],
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query']
      }
    },
    {
      name: 'debug_log',
      description: 'Append a debug hypothesis or observation to data/debug/session.jsonl',
      permissions: ['write'],
      parameters: {
        type: 'object',
        properties: { hypothesis: { type: 'string' }, evidence: { type: 'string' } },
        required: ['hypothesis']
      }
    },
    {
      name: 'debug_start',
      description: 'Start a loopback Node Inspector session on a jailed JS/TS file.',
      permissions: ['exec'],
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          args: { type: 'array', items: { type: 'string' } }
        },
        required: ['path']
      }
    },
    {
      name: 'debug_breakpoint',
      description: 'Set or clear a jailed breakpoint at path:line.',
      permissions: ['exec'],
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          line: { type: 'number' },
          enabled: { type: 'boolean' }
        },
        required: ['path', 'line']
      }
    },
    {
      name: 'debug_stack',
      description: 'Read the current Inspector stack, locals, and status.',
      permissions: ['read'],
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'debug_evaluate',
      description: 'Evaluate a primitive identifier or arithmetic on the paused frame.',
      permissions: ['exec'],
      parameters: {
        type: 'object',
        properties: { expression: { type: 'string' } },
        required: ['expression']
      }
    },
    {
      name: 'debug_continue',
      description: 'Continue, step over, step into, or step out of a paused Inspector session.',
      permissions: ['exec'],
      parameters: {
        type: 'object',
        properties: { kind: { type: 'string', description: 'continue|stepOver|stepInto|stepOut' } }
      }
    },
    {
      name: 'debug_stop',
      description: 'Stop the Inspector child. Does not touch PTYs.',
      permissions: ['exec'],
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'browser_navigate',
      description: 'Navigate the workbench browser to a URL.',
      permissions: ['net'],
      parameters: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url']
      }
    },
    {
      name: 'browser_extract',
      description: 'Read visible text from the workbench browser and save a capture.',
      permissions: ['read'],
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'browser_click',
      description: 'Click a CSS selector in the workbench browser.',
      permissions: ['net'],
      parameters: {
        type: 'object',
        properties: { selector: { type: 'string' } },
        required: ['selector']
      }
    },
    {
      name: 'browser_type',
      description: 'Type into a CSS selector in the workbench browser.',
      permissions: ['net'],
      parameters: {
        type: 'object',
        properties: { selector: { type: 'string' }, text: { type: 'string' } },
        required: ['selector', 'text']
      }
    },
    {
      name: 'browser_screenshot',
      description: 'Capture the workbench browser to browser/captures/.',
      permissions: ['read'],
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'browser_console',
      description: 'Read recent console messages from the workbench browser (also saved under browser/captures/console.log).',
      permissions: ['read'],
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'git_log',
      description: 'Recent git history (oneline).',
      permissions: ['read'],
      parameters: {
        type: 'object',
        properties: { n: { type: 'number' } }
      }
    },
    {
      name: 'git_worktree',
      description: 'List or add a git worktree under .cursor/worktrees.',
      permissions: ['exec'],
      parameters: {
        type: 'object',
        properties: { action: { type: 'string', description: 'list|add' }, name: { type: 'string' } }
      }
    },
    {
      name: 'web_search',
      description: 'Search the web (DuckDuckGo HTML). Truncated results.',
      permissions: ['net'],
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query']
      }
    },
    {
      name: 'tasks_update',
      description: 'Create or move a taskboard card.',
      permissions: ['write'],
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          column: { type: 'string' },
          id: { type: 'string' },
          body: { type: 'string' }
        },
        required: ['title']
      }
    },
    {
      name: 'design_get',
      description:
        'Read a DesignIR by slug id (designs/<id>.design.json). Omit id to use the active artifact. Never pass a filesystem path.',
      permissions: ['read'],
      parameters: { type: 'object', properties: { id: { type: 'string', description: 'jailed slug, not a path' } } }
    },
    {
      name: 'design_patch',
      description:
        'Apply a scoped RFC 6902 patch envelope to DesignIR. Prefer add/replace on /pages /nodes/{id} /tokens. Example patch: [{"op":"add","path":"/pages/-","value":{"id":"p3","name":"Ask"}}]. Never send HTML. Pass baseRevision from design_get. Pass id (slug) for the artifact you are designing.',
      permissions: ['write'],
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'jailed slug, not a path' },
          baseRevision: { type: 'string' },
          intentId: { type: 'string' },
          patch: { type: 'array', description: 'ops: add|remove|replace with path starting /nodes /tokens /brief /locks /pages /comments' }
        },
        required: ['patch']
      }
    },
    {
      name: 'design_ingest_tokens',
      description:
        'Load a DTCG 2025.10 JSON file under designs/ into DesignIR tokens. Default designs/tokens.json. Does not fetch URLs from $value.',
      permissions: ['write'],
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } }
      }
    },
    {
      name: 'library_pack',
      description: 'Compact ROADMAP/STATUS/recipes INDEX/anti-patterns for local Think. Prefer this over reading those files one by one.',
      permissions: ['read'],
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'git_pack',
      description: 'Branch + porcelain + short diff. Use in Think instead of shell git.',
      permissions: ['read'],
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'plan_write',
      description:
        'Write a Think handoff, or compile kind=dna / name=dna-* into CapabilityIR plus deterministic web, CLI, loopback API, and sandboxed desktop emitters under RAG/plans/dna-*. DNA cites recipe shapes and never copies source or foreign UI.',
      permissions: ['write'],
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          content: { type: 'string' },
          kind: { type: 'string', enum: ['think', 'dna'] },
          recipes: { type: 'array', items: { type: 'string' }, maxItems: 8 }
        },
        required: ['name', 'content']
      }
    },
    {
      name: 'task',
      description:
        'Spawn an Explore/Bash/Browser/Research worker. Returns a digest, never a grep dump. Parallel jobs max 4. Think mode: explore only.',
      permissions: ['read'],
      parameters: {
        type: 'object',
        properties: {
          subagent_type: { type: 'string', description: 'explore|bash|browser|research' },
          query: { type: 'string' },
          jobs: { type: 'array', description: 'optional parallel jobs {name,kind,query}' }
        }
      }
    },
    {
      name: 'compute_run',
      description:
        'Jailed python3 -I or node. No network. Timeout. Script under data/compute/runs/; figures under data/compute/plots/ only. Use for math, CSV, plots — not terminal_run python -c.',
      permissions: ['exec'],
      parameters: {
        type: 'object',
        properties: {
          runtime: { type: 'string', description: 'python|node' },
          code: { type: 'string' },
          timeoutMs: { type: 'number' }
        },
        required: ['code']
      }
    },
    {
      name: 'notes_list',
      description: 'List notes/*.md (jailed).',
      permissions: ['read'],
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'notes_write',
      description: 'Write notes/<name>.md only. Name is a slug, not a path.',
      permissions: ['write'],
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' }, content: { type: 'string' } },
        required: ['name', 'content']
      }
    },
    {
      name: 'calendar_list',
      description: 'List data/calendar/*.ics.',
      permissions: ['read'],
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'calendar_upsert',
      description: 'Write one VEVENT to data/calendar/<name>.ics. Fields: summary, dtstart, dtend.',
      permissions: ['write'],
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          summary: { type: 'string' },
          dtstart: { type: 'string' },
          dtend: { type: 'string' }
        },
        required: ['name', 'summary']
      }
    },
    {
      name: 'web_extract',
      description: 'HTTP GET and return title + stripped text (truncated). Prefer over stuffing HTML.',
      permissions: ['net'],
      parameters: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url']
      }
    },
    {
      name: 'inbox_ocr',
      description: 'OCR a file under data/inbox/ via local tesseract. No extra-root paths.',
      permissions: ['read'],
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path']
      }
    },
    {
      name: 'inbox_stt',
      description: 'Transcribe audio under data/inbox/ via local whisper. ogg/wav/mp3/webm/m4a only.',
      permissions: ['exec'],
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path']
      }
    },
    {
      name: 'speak',
      description: 'Speak text to a wav under data/tts/ via local piper. Does not play speakers.',
      permissions: ['exec'],
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text']
      }
    }
  ]
  return list.map((t) => ({ ...t, pack: packFromName(t.name) as ToolDef['pack'] }))
}

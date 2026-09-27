import { basename, isAbsolute, join, resolve } from 'node:path'

const DEFAULT_MODEL = 'Qwen3.5-2B-Q8_0.gguf'

/** Drop asar, NUL, `..` segments, and secrets trees as a workspace. */
export function takeWorkspaceJail(raw) {
  if (typeof raw !== 'string') return ''
  const t = raw.trim()
  if (!t || t.includes('\0') || /[\n\r]/.test(t)) return ''
  const n = t.replace(/\\/g, '/')
  if (n.includes('.asar')) return ''
  if (n.split('/').includes('..')) return ''
  if (n.includes('/data/secrets') || n.endsWith('/data/secrets')) return ''
  if (n.length > 1024) return ''
  return t
}

export function takeHexHome(home) {
  const h = takeWorkspaceJail(home)
  return h ? join(h, 'Hex') : ''
}

/**
 * Split packaged app resources vs profile vs workspace jail.
 * Operator (unpackaged): workspace = cwd/HOME_AI_ROOT; profile = <workspace>/data.
 * Packaged: profile = userData; workspace = last folder or ~/Hex; never the asar.
 */
export function takeAppRoots(raw = {}) {
  const packaged = Boolean(raw.packaged)
  const home = takeWorkspaceJail(raw.home)
  const userData = takeWorkspaceJail(raw.userData)
  const cwd = takeWorkspaceJail(raw.cwd)
  const appPath = takeWorkspaceJail(raw.appPath)
  const envRoot = takeWorkspaceJail(raw.envRoot)
  const last = takeWorkspaceJail(raw.lastWorkspace)
  const resources = takeWorkspaceJail(raw.resourcesPath) || appPath
  const hexHome = takeHexHome(home)
  const operatorRoot = envRoot || cwd || appPath
  const appResources = packaged ? resources || appPath : operatorRoot
  const profile = packaged
    ? userData || (hexHome ? join(hexHome, 'profile') : '')
    : join(operatorRoot || '.', 'data')
  let workspace = ''
  if (envRoot) workspace = envRoot
  else if (last) workspace = last
  else if (packaged) workspace = hexHome
  else workspace = operatorRoot
  workspace = takeWorkspaceJail(workspace)
  if (!workspace) workspace = packaged ? hexHome : operatorRoot
  return {
    packaged,
    operator: !packaged,
    appResources,
    profile,
    workspace,
    secretsDir: profile ? join(profile, 'secrets') : '',
    modelsDir: profile ? join(profile, 'models') : '',
    hexHome,
    vendorDir: appResources ? join(appResources, 'vendor') : ''
  }
}

export function takeOnboardNeeded(roots, onboardDone) {
  if (!roots || !roots.packaged) return false
  return onboardDone !== true
}

export function takeModelCandidates(roots, modelName = DEFAULT_MODEL) {
  const name = basename(String(modelName || DEFAULT_MODEL))
  if (name !== DEFAULT_MODEL || name.includes('..')) return []
  const out = []
  const add = (dir) => {
    if (!dir) return
    out.push(join(dir, name))
  }
  add(roots.workspace)
  add(roots.modelsDir)
  add(roots.appResources)
  add(roots.profile)
  return out
}

export function takeModelPath(roots, existsFn, modelName = DEFAULT_MODEL) {
  const cands = takeModelCandidates(roots, modelName)
  for (const p of cands) {
    if (typeof existsFn === 'function' ? existsFn(p) : false) return p
  }
  return roots.modelsDir ? join(roots.modelsDir, basename(modelName || DEFAULT_MODEL)) : cands[0] || ''
}

export function takeGgufDest(modelsDir, modelName = DEFAULT_MODEL) {
  const dir = takeWorkspaceJail(modelsDir)
  const name = basename(String(modelName || ''))
  if (!dir || name !== DEFAULT_MODEL) return ''
  const dest = join(dir, name)
  const root = resolve(dir)
  const abs = resolve(dest)
  if (!abs.startsWith(root)) return ''
  return abs
}

export function takeLastWorkspaceFile(profile) {
  const dir = takeWorkspaceJail(profile)
  return dir ? join(dir, 'hex-roots.json') : ''
}

export function takeRootsState(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const workspace = takeWorkspaceJail(o.workspace)
  const onboardDone = o.onboardDone === true
  const crashOptIn = o.crashOptIn === 'local' ? 'local' : 'off'
  return { workspace, onboardDone, crashOptIn }
}

export function takeLibraryStub(day) {
  const d = String(day || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  return {
    'RAG/library/README.md':
      '# Repo library\n\nSee ROADMAP.md, STATUS.md, FEATURES.md, TESTS.md, EDGES.md. Skill: repo-library.\n',
    'RAG/library/ROADMAP.md': `# Roadmap\n\nLast analyzed: ${d}.\n\n## Phase 1/3 — Understand\n- [x] Scaffold library\n- [ ] Fill FEATURES from fingerprint\n\n## Next\n- Open this folder in Hex AI and fill FEATURES.\n`,
    'RAG/library/FEATURES.md': '# Features\n\n| Slug | What | How made |\n|------|------|----------|\n',
    'RAG/library/TESTS.md':
      '# Tests\n\n| id | proves | feature | status | path |\n|----|--------|---------|--------|------|\n',
    'RAG/library/EDGES.md': '# Edges\n\n| id | case | feature | status |\n|----|------|---------|--------|\n',
    'RAG/library/STATUS.md': `# Status\n- Phase: 1/3 — Understand\n- Features: documented 0\n- Tests: done 0 / required 0\n- Edges: tested 0 / tracked 0\n- Updated: ${d}\n`
  }
}

export function takeSecretName(raw) {
  const n = String(raw || '')
  if (!['openai', 'openrouter', 'cursor', 'groq', 'gemini', 'telegram'].includes(n)) return ''
  return n
}

export function secretFileNames(name) {
  const n = takeSecretName(name)
  if (!n) return null
  return { plain: `${n}.key`, enc: `${n}.enc` }
}

export { DEFAULT_MODEL as DEFAULT_GGUF_NAME }

/** Tests: never treat an absolute extra path as a workspace when it is the asar. */
export function isPackedAppPath(p) {
  const n = String(p || '').replace(/\\/g, '/')
  return n.includes('.asar') || n.endsWith('/app.asar')
}

export function takeOpenFolder(picked) {
  const p = takeWorkspaceJail(picked)
  if (!p || !isAbsolute(p)) return ''
  if (isPackedAppPath(p)) return ''
  return p
}

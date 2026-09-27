import { existsSync, readdirSync, statSync } from 'node:fs'
import { assertInside } from '../../runtime/src/paths.mjs'
import { skipSkillFile } from '../../runtime/src/search-proof.mjs'

/** Cap directory entries visited while stamping skill trees. */
export const KNOWLEDGE_WALK_CAP = 400

const SKIP_DIRS = new Set(['reference', 'scripts', 'assets', 'node_modules', '.git'])

let cachedRoot = ''
let cachedStamp = ''
let cachedValue = null

function posixRel(rel) {
  return String(rel || '')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
}

function jailedStat(root, rel) {
  try {
    const abs = assertInside(root, rel)
    if (!existsSync(abs)) return null
    return { abs, st: statSync(abs) }
  } catch {
    return null
  }
}

function skipName(name) {
  const n = String(name || '')
  if (!n || n.includes('..') || n.includes('\0') || n.includes('\n')) return true
  if (SKIP_DIRS.has(n)) return true
  return false
}

/** Max mtime of jailed SKILL.md under RAG/mods and workspace .cursor/.agents/.homeai trees. Never $HOME. Stamp is count:mtime. */
export function knowledgeStamp(root) {
  let maxMs = 0
  let files = 0
  let walked = 0

  function walk(rel) {
    if (walked >= KNOWLEDGE_WALK_CAP) return
    const hit = jailedStat(root, rel)
    if (!hit || !hit.st.isDirectory()) return
    let names
    try {
      names = readdirSync(hit.abs)
    } catch {
      return
    }
    for (const name of names) {
      if (walked >= KNOWLEDGE_WALK_CAP) return
      walked += 1
      if (skipName(name)) continue
      const childRel = `${posixRel(rel)}/${name}`
      const child = jailedStat(root, childRel)
      if (!child) continue
      if (child.st.isDirectory()) {
        walk(childRel)
        continue
      }
      if (name !== 'SKILL.md') {
        const inRules = /(^|\/)rules$/.test(posixRel(rel))
        if (!(inRules && /\.(md|mdc)$/i.test(name))) continue
      }
      if (skipSkillFile(childRel) || skipSkillFile(child.abs)) continue
      files += 1
      if (child.st.mtimeMs > maxMs) maxMs = child.st.mtimeMs
    }
  }

  walk('RAG/skills')
  walk('RAG/rules')
  // Workspace skill trees the loader already reads. Never stamp $HOME/.cursor/skills.
  walk('.cursor/skills')
  walk('.cursor/rules')
  walk('.agents/skills')
  walk('.homeai/skills')
  const agents = jailedStat(root, 'AGENTS.md')
  if (agents && agents.st.isFile()) {
    files += 1
    if (agents.st.mtimeMs > maxMs) maxMs = agents.st.mtimeMs
  }
  const mods = jailedStat(root, 'mods')
  if (mods && mods.st.isDirectory()) {
    let names = []
    try {
      names = readdirSync(mods.abs)
    } catch {
      names = []
    }
    for (const name of names) {
      if (walked >= KNOWLEDGE_WALK_CAP) break
      walked += 1
      if (skipName(name) || name.startsWith('.')) continue
      walk(`mods/${name}/skills`)
      walk(`mods/${name}/rules`)
    }
  }

  return `${files}:${Math.floor(maxMs)}`
}

export function cachedKnowledge(root, load) {
  const stamp = knowledgeStamp(root)
  if (cachedValue && cachedRoot === root && cachedStamp === stamp) return cachedValue
  cachedValue = load(root)
  cachedRoot = root
  cachedStamp = stamp
  return cachedValue
}

export function resetKnowledgeCache() {
  cachedRoot = ''
  cachedStamp = ''
  cachedValue = null
}

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { assertInside } from './paths.mjs'
import { stripActivityText } from './activity.mjs'
import { thinkSlug } from './think.mjs'

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,47}$/
const BLOCK = new Set(['readme', 'index', 'agent-snippet'])

export function knowledgeSlug(name) {
  const s = thinkSlug(name)
  return BLOCK.has(s) ? 'note' : s
}

export function skillRel(name) {
  const slug = knowledgeSlug(name)
  const rel = `RAG/skills/${slug}/SKILL.md`
  if (rel.includes('..') || rel.includes('\0')) throw new Error('path escapes workspace')
  return rel
}

export function ruleRel(name) {
  const slug = knowledgeSlug(name)
  const rel = `RAG/rules/${slug}.md`
  if (rel.includes('..') || rel.includes('\0')) throw new Error('path escapes workspace')
  return rel
}

function rejectHtml(s) {
  const text = String(s ?? '')
  if (/[<>]/.test(text)) throw new Error('html')
  return text
}

function oneLine(s, max) {
  return rejectHtml(stripActivityText(s, max).replace(/\n/g, ' '))
}

export function writeSkill(root, args) {
  const name = oneLine(args?.name, 48)
  if (!name) throw new Error('name')
  const description = oneLine(args?.description || name, 160)
  const body = rejectHtml(String(args?.body ?? '').slice(0, 12_000)).trim()
  if (!body) throw new Error('body')
  const rel = skillRel(name)
  const abs = assertInside(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`, 'utf8')
  return { rel, slug: knowledgeSlug(name), name, description }
}

export function writeRule(root, args) {
  const name = oneLine(args?.name, 48)
  if (!name) throw new Error('name')
  const body = rejectHtml(String(args?.body ?? '').slice(0, 8_000)).trim()
  if (!body) throw new Error('body')
  const rel = ruleRel(name)
  const abs = assertInside(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, `---\ntitle: ${name}\nalwaysApply: true\n---\n\n${body}\n`, 'utf8')
  return { rel, slug: knowledgeSlug(name), name }
}

export function listWritableSkills(root) {
  const dir = join(root, 'RAG', 'skills')
  if (!existsSync(dir)) return []
  const out = []
  for (const name of readdirSync(dir)) {
    if (!SLUG_RE.test(name) || BLOCK.has(name)) continue
    const p = join(dir, name, 'SKILL.md')
    try {
      if (!statSync(p).isFile()) continue
    } catch {
      continue
    }
    const text = readFileSync(p, 'utf8')
    out.push({
      slug: name,
      rel: `RAG/skills/${name}/SKILL.md`,
      preview: stripActivityText(text.replace(/^---[\s\S]*?---/, ''), 120)
    })
  }
  return out
}

export function listWritableRules(root) {
  const dir = join(root, 'RAG', 'rules')
  if (!existsSync(dir)) return []
  const out = []
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md') || name === 'README.md') continue
    const slug = name.slice(0, -3)
    if (!SLUG_RE.test(slug) || BLOCK.has(slug)) continue
    const p = join(dir, name)
    try {
      if (!statSync(p).isFile()) continue
    } catch {
      continue
    }
    const text = readFileSync(p, 'utf8')
    out.push({
      slug,
      rel: `RAG/rules/${name}`,
      preview: stripActivityText(text.replace(/^---[\s\S]*?---/, ''), 120)
    })
  }
  return out
}

export function deleteSkill(root, slug) {
  const rel = skillRel(slug)
  const file = assertInside(root, rel)
  const dir = dirname(file)
  const expected = assertInside(root, `RAG/skills/${knowledgeSlug(slug)}`)
  if (dir !== expected) throw new Error('bad skill')
  if (!existsSync(file)) throw new Error('missing')
  rmSync(dir, { recursive: true, force: false })
  return rel
}

export function deleteRule(root, slug) {
  const rel = ruleRel(slug)
  if (rel.endsWith('README.md')) throw new Error('readme')
  const abs = assertInside(root, rel)
  if (!existsSync(abs)) throw new Error('missing')
  rmSync(abs, { force: false })
  return rel
}

export function kindFromPath(path) {
  let n = String(path || '').replace(/\\/g, '/')
  if (!n.startsWith('/')) n = `/${n}`
  if (n.includes('/RAG/skills/') || n.endsWith('SKILL.md')) return 'skill'
  if (n.includes('/RAG/rules/')) return 'rule'
  if (n.includes('/RAG/discoveries/')) return 'discovery'
  if (n.includes('/RAG/thoughts/')) return 'thought'
  if (n.includes('/RAG/conversations/')) return 'conversation'
  if (n.includes('/RAG/routines/')) return 'routine'
  if (n.includes('/RAG/tasks/')) return 'task'
  if (n.includes('/RAG/maps/')) return 'map'
  if (n.includes('/RAG/recipes/')) return 'recipe'
  if (n.includes('/RAG/library/')) return 'library'
  if (n.includes('/RAG/code/')) return 'code'
  if (n.includes('/notes/')) return 'note'
  if (n.includes('/qa/')) return 'qa'
  if (n.includes('/browser/')) return 'browser'
  if (n.includes('/data/bug-memory/')) return 'anti-pattern'
  return 'doc'
}

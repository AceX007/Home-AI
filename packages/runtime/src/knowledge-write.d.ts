export function knowledgeSlug(name: string): string
export function skillRel(name: string): string
export function ruleRel(name: string): string
export function writeSkill(
  root: string,
  args: { name?: string; description?: string; body?: string }
): { rel: string; slug: string; name: string; description: string }
export function writeRule(root: string, args: { name?: string; body?: string }): { rel: string; slug: string; name: string }
export function listWritableSkills(root: string): Array<{ slug: string; rel: string; preview: string }>
export function listWritableRules(root: string): Array<{ slug: string; rel: string; preview: string }>
export function deleteSkill(root: string, slug: string): string
export function deleteRule(root: string, slug: string): string

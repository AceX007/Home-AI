export const KNOWLEDGE_WALK_CAP: number
export function knowledgeStamp(root: string): string
export function cachedKnowledge<T>(root: string, load: (root: string) => T): T
export function resetKnowledgeCache(): void

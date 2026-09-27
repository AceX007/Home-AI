import {
  EMPTY_METERS,
  parseLibraryStatus,
  type LibraryMeters as RuntimeMeters
} from '@homeai/runtime/browser'

export type LibraryMeters = RuntimeMeters
export { parseLibraryStatus, EMPTY_METERS }

export type LibraryTab = 'roadmap' | 'features' | 'tests' | 'edges' | 'tasks'

export const LIBRARY_FILES: Record<Exclude<LibraryTab, 'tasks'>, string> = {
  roadmap: 'ROADMAP.md',
  features: 'FEATURES.md',
  tests: 'TESTS.md',
  edges: 'EDGES.md'
}

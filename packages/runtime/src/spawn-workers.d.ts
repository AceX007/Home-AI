export function parseWorkerJobs(
  raw: unknown
): Array<{ name: string; kind: string; query: string; path: string }>

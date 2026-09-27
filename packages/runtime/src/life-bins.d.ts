export function probeLifeBins(): { ocr: boolean; stt: boolean; tts: boolean }
export function filterLifeTools<T extends { name?: string }>(
  tools: T[] | unknown,
  bins?: { ocr?: boolean; stt?: boolean; tts?: boolean } | null
): T[]

import type { HardwareProbe, LlamaLoadArgs } from '@homeai/core'

export function coderLlamaArgs(probe: HardwareProbe, modelPath: string, port?: number): LlamaLoadArgs
export function jailedCoderModelPath(root: string, name: string): string | null

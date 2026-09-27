import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { cpus, totalmem, freemem } from 'node:os'
import { promisify } from 'node:util'
import type {
  GovernorOverride,
  HardwareProbe,
  LlamaLoadArgs,
  VisualTier,
  VramProfile
} from '@homeai/core'
import { DEFAULT_CODER_MODEL_NAMES, DEFAULT_CODER_PORT, DEFAULT_LLAMA_PORT, DEFAULT_MODEL_NAME } from '@homeai/core'
import { coderLlamaArgs as buildCoderLlamaArgs, jailedCoderModelPath } from './coder-args.mjs'

const execFileAsync = promisify(execFile)

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function profileFromVram(vramMb: number, vulkan: boolean): VramProfile {
  if (!vulkan || vramMb < 512) return 'cpu'
  if (vramMb < 2048) return 'tiny'
  if (vramMb < 3072) return 'small'
  return 'standard'
}

function visualFromProfile(profile: VramProfile): VisualTier {
  if (profile === 'cpu') return 'potato'
  if (profile === 'standard') return 'cinematic'
  return 'balanced'
}

function layersFor(profile: VramProfile): number {
  switch (profile) {
    case 'cpu':
      return 0
    case 'tiny':
      return 10
    case 'small':
      return 24
    case 'standard':
      return 99
  }
}

function ctxFor(profile: VramProfile, ramAvailMb: number): number {
  if (ramAvailMb < 2048) return 2048
  switch (profile) {
    case 'cpu':
      return ramAvailMb < 3072 ? 2048 : 4096
    case 'tiny':
      return 2048
    case 'small':
      return 4096
    case 'standard':
      return ramAvailMb < 3072 ? 4096 : 8192
  }
}

function batchFor(profile: VramProfile): number {
  return profile === 'cpu' ? 128 : 256
}

function reservedVram(vramMb: number): number {
  if (vramMb <= 0) return 0
  if (vramMb <= 2048) return 384
  if (vramMb <= 3072) return 768
  return 1100
}

async function tryExec(cmd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(cmd, args, {
      timeout: 8000,
      maxBuffer: 8 * 1024 * 1024
    })
    return stdout
  } catch {
    return ''
  }
}

function parseGlxVram(text: string): { name: string; vramMb: number } | null {
  const nameMatch = text.match(/Device:\s*(.+?)(?:\s*\(|$)/m) || text.match(/OpenGL renderer string:\s*(.+)/)
  const memMatch =
    text.match(/Video memory:\s*(\d+)\s*MB/i) ||
    text.match(/Dedicated video memory:\s*(\d+)\s*MB/i)
  if (!memMatch) return null
  return {
    name: (nameMatch?.[1] ?? 'GPU').trim(),
    vramMb: Number(memMatch[1])
  }
}

function parseVulkanSummary(text: string): { name: string; discrete: boolean } | null {
  const blocks = text.split(/GPU\d+:/)
  for (const block of blocks) {
    const name = block.match(/deviceName\s*=\s*(.+)/)?.[1]?.trim()
    const type = block.match(/deviceType\s*=\s*(.+)/)?.[1]?.trim() ?? ''
    if (!name) continue
    if (/llvmpipe|swiftshader|cpu/i.test(name)) continue
    return { name, discrete: /DISCRETE/i.test(type) }
  }
  return null
}

export async function probeHardware(override: GovernorOverride = {}): Promise<HardwareProbe> {
  const threads = cpus().length || 4
  const ramTotalMb = Math.round(totalmem() / 1024 / 1024)
  const ramAvailMb = Math.round(freemem() / 1024 / 1024)

  const vulkanText = await tryExec('vulkaninfo', ['--summary'])
  const glxText = await tryExec('glxinfo', ['-B'])
  const vulkanGpu = parseVulkanSummary(vulkanText)
  const glxGpu = parseGlxVram(glxText)

  const vulkan = Boolean(vulkanGpu)
  const gpuName = vulkanGpu?.name || glxGpu?.name || 'CPU (no discrete GPU)'
  const vramMb = vulkan ? glxGpu?.vramMb ?? 0 : 0

  let profile = override.profile && override.profile !== 'auto' ? override.profile : profileFromVram(vramMb, vulkan)
  if (override.profile === 'auto' || !override.profile) {
    profile = profileFromVram(vramMb, vulkan)
  }

  const visualTier =
    override.visualTier && override.visualTier !== 'auto'
      ? override.visualTier
      : visualFromProfile(profile)

  const nGpuLayers = override.nGpuLayers ?? layersFor(profile)
  const contextSize = override.contextSize ?? ctxFor(profile, ramAvailMb)
  const reservedVramMb = reservedVram(vramMb)

  let warning: string | undefined
  if (ramAvailMb < 3072) {
    warning = `Only ${ramAvailMb} MB RAM free. Close other apps before loading the 2B Q8 (~2 GB) or the OS will swap.`
  }
  if (profile !== 'cpu' && vramMb > 0 && vramMb - reservedVramMb < 1800) {
    warning = [
      warning,
      `VRAM budget is tight (${vramMb} MB, reserving ${reservedVramMb} MB for UI). Using partial offload.`
    ]
      .filter(Boolean)
      .join(' ')
  }

  return {
    gpuName,
    vramMb,
    vulkan,
    cpuThreads: threads,
    ramTotalMb,
    ramAvailMb,
    profile,
    visualTier,
    nGpuLayers,
    contextSize,
    batchSize: batchFor(profile),
    reservedVramMb,
    warning
  }
}

export function coderModelName(root: string, profile: VramProfile): string | undefined {
  if (profile !== 'standard') return undefined
  for (const n of DEFAULT_CODER_MODEL_NAMES) {
    if (existsSync(join(root, n))) return n
  }
  return undefined
}

export function llamaArgsFor(
  probe: HardwareProbe,
  modelPath: string,
  port = DEFAULT_LLAMA_PORT
): LlamaLoadArgs {
  const threads = clamp(probe.cpuThreads - 2, 2, 8)
  return {
    modelPath,
    host: '127.0.0.1',
    port,
    nGpuLayers: probe.nGpuLayers,
    contextSize: probe.contextSize,
    batchSize: probe.batchSize,
    threads,
    flashAttn: probe.profile !== 'cpu'
  }
}

/** Second GGUF only. Port is always DEFAULT_CODER_PORT — never a renderer argument. */
export function coderLlamaArgs(probe: HardwareProbe, modelPath: string): LlamaLoadArgs {
  return buildCoderLlamaArgs(probe, modelPath, DEFAULT_CODER_PORT)
}

export { jailedCoderModelPath }

export function fallbackOnOom(probe: HardwareProbe): HardwareProbe {
  if (probe.contextSize > 2048) {
    return { ...probe, contextSize: Math.max(2048, Math.floor(probe.contextSize / 2)), warning: 'OOM: reduced context.' }
  }
  if (probe.nGpuLayers > 0) {
    const next = Math.max(0, Math.floor(probe.nGpuLayers / 2))
    const profile: VramProfile = next === 0 ? 'cpu' : probe.profile
    return {
      ...probe,
      nGpuLayers: next,
      profile,
      visualTier: next === 0 ? 'potato' : probe.visualTier,
      warning: 'OOM: dropped GPU layers.'
    }
  }
  return { ...probe, warning: 'OOM: already on CPU with 2k context.' }
}

export { DEFAULT_MODEL_NAME }

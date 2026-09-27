import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  AgentMode,
  ChatMessage,
  ContextRing,
  ForgeRoute,
  ProviderId,
  SkillCard,
  StreamChunk,
  ToolCall,
  ToolDef,
  ToolResult
} from '@homeai/core'
import { chatCompletions, parseQwenToolCalls } from '@homeai/llm'
import { matchSkills } from '@homeai/mods'
import { forgeActHint, publicToolCall, ringFrom, selectRules, taskNeedsDesignTools, tokensOf, designToolChoice, verifyToolDefs, takeVerifyCalls, takeVerifyPatch, takeVerifyDiff, verifyUserPrompt, takeWorkflowLane, takeUsageTotal, promoteDiscovery, promoteRel, curateSkillProposal } from '@homeai/runtime'
import type { RagHit, RuleCard } from '@homeai/core'

/**
 * This is how I work. Small context. Tools first. Surgical edits.
 * Plan before building when the task is large. Debug with a log, not vibes.
 */
export const KERNEL_SYSTEM = `You are Hex AI Kernel v2 — home operator of this workbench.

You are not a chatbot. You live in the files and tools.
Loop: PERCEIVE → ROUTE → ACT → VERIFY → REMEMBER.

PERCEIVE: call explore or task(explore) — never dump grep into the parent. Then fs_read the smallest files. Open tabs and @mentions are already attached. Parallel independent tools.
ROUTE: Default local tools. Cloud only when pinned or the task is genuinely hard. Packs keep the 2B tool list tiny: /pack research|browser|design|life|mcp-domain.
ACT: Surgical str_replace. fs_write only for new files. compute_run for math/data (no network). task() for Explore/Bash/Browser/Research workers. Every write is Keep/Undo + a checkpoint.
VERIFY: A second pass may call only str_replace, debug_log, or ask_user. Workspace before/after and a jailed git diff are attached; extra-root and data/secrets are omitted. Do not call test_run from VERIFY.
REMEMBER: rag_write a discovery when a pattern worked.
Background phases (every surface): Trust = Auto Review (pre-tool Judge, not a forge phase). Hunt = perceive/act tools (explore, task, fs_*). Verify = test_run during ACT (there is no review tool). Critic = the VERIFY second pass only (str_replace|debug_log|ask_user). task() stays at most 4 workers — no fleets. Tool list is frozen for the turn. PERCEIVE pack (library, git, RAG, maps, QA, graph, debug) is already attached except in Ask.

ask_user when the task is ambiguous — do not guess product decisions.
Life pack: notes_*, calendar_*, inbox_ocr, inbox_stt, speak (data/inbox audio in; data/tts wav out). Extra-root: fs_read/fs_list/fs_write root id is the extra folder basename, never a raw path. Extra-root writes always ask.

Ask mode: read-only.
Think mode: local 2B only. Forced perceive pack is already in context. Research with explore/outline/library_pack/git_pack. task explore-only. Write the handoff with plan_write to RAG/plans/<slug>.think.md (status ready). Do not edit product code. Do not use the shell. No MCP.
Plan mode: research + ask_user + write RAG/plans/<name>.md only. Do not edit application source. End with a plan the human can Build.
Debug mode: write hypotheses via debug_log, debug_start a jailed script, then fix. No drive-by refactors.

Output: no fake tools, no essays, no whole-file dumps, no <think> blocks.`

export interface ForgeContext {
  task: string
  pinnedProvider: ProviderId
  localPort: number
  getKey: (name: string) => Promise<string | null>
  tools: ToolDef[]
  runTool: (call: ToolCall) => Promise<ToolResult>
  skills: SkillCard[]
  rules: RuleCard[]
  ragHits: RagHit[]
  openFiles: string[]
  gitBranch?: string
  workspaceRoot: string
  mode?: AgentMode
  signal?: AbortSignal
  selection?: { path: string; text: string }
  mentionBlobs?: string
  goal?: string
  customSkill?: SkillCard
  contextCap?: number
  pullSteer?: () => string
  onContext?: (ring: ContextRing) => void
  maxTurns?: number
  needsTools?: boolean
  skipRemember?: boolean
  skipVerify?: boolean
  verifyNote?: string
}

function packContext(ctx: ForgeContext, extraSkills: SkillCard[], rules: RuleCard[]): string {
  const ruleBits = rules
    .slice(0, 8)
    .map((r) => `- ${r.title}: ${r.body.slice(0, 320).replace(/\n/g, ' ')}`)
    .join('\n')
  const skillBits = extraSkills
    .slice(0, 3)
    .map((s) => `### ${s.name}\n${s.description}\n${s.body.slice(0, 900)}`)
    .join('\n')
  const ragBits = ctx.ragHits
    .slice(0, 6)
    .map((h) => `- ${h.path}${h.symbol ? '#' + h.symbol : ''}: ${h.snippet}`)
    .join('\n')
  return [
    `Workspace: ${ctx.workspaceRoot}`,
    `Mode: ${ctx.mode ?? 'agent'}`,
    ctx.goal ? `Sticky goal: ${ctx.goal}` : '',
    ctx.gitBranch ? `Git: ${ctx.gitBranch}` : '',
    ctx.openFiles.length ? `Open: ${ctx.openFiles.slice(0, 8).join(', ')}` : '',
    ctx.selection ? `Selection in ${ctx.selection.path}:\n${ctx.selection.text.slice(0, 4000)}` : '',
    ctx.mentionBlobs ? ctx.mentionBlobs : '',
    ruleBits ? `Standing rules:\n${ruleBits}` : '',
    ragBits ? `Memory hits:\n${ragBits}` : '',
    skillBits ? `Retrieved skills:\n${skillBits}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

async function classifyRoute(ctx: ForgeContext, localOk: boolean): Promise<ForgeRoute> {
  if (ctx.mode === 'ask') return 'local_gen'
  if (ctx.mode === 'plan' || ctx.mode === 'think') return 'local_tools'
  if (ctx.pinnedProvider === 'cursor') return 'cloud'
  if (ctx.pinnedProvider === 'openai' || ctx.pinnedProvider === 'openrouter') return 'mixed'
  if (!localOk) {
    if (await ctx.getKey('openai')) return 'cloud'
    if (await ctx.getKey('openrouter')) return 'cloud'
    return 'local_gen'
  }
  const t = ctx.task.toLowerCase()
  if (/\b(architect|refactor all|cursor agent|multi-repo)\b/.test(t) && (await ctx.getKey('cursor'))) {
    return 'cloud'
  }
  if (/\b(explain only|what is|summarize)\b/.test(t) && !/\b(edit|fix|implement|write)\b/.test(t)) {
    return 'local_gen'
  }
  return 'local_tools'
}

function providerFor(route: ForgeRoute, pinned: ProviderId): Exclude<ProviderId, 'cursor'> {
  if (pinned === 'openai' || pinned === 'openrouter' || pinned === 'local') return pinned
  if (route === 'cloud' || route === 'mixed') return 'openrouter'
  return 'local'
}

function modeSuffix(mode: AgentMode | undefined): string {
  if (mode === 'ask') return '\n\nASK MODE: read-only. Answer from context and read tools. Never edit files.'
  if (mode === 'think')
    return '\n\nTHINK MODE: you are the local 2B. Tools are your power: explore, code_outline, library_pack, git_pack, then plan_write. Never fs_write/str_replace/terminal_run. Finish with plan_write status: ready and a non-empty files list. Implement (cloud or local) will only read that file.'
  if (mode === 'plan')
    return '\n\nPLAN MODE: gather, ask_user if needed, write only RAG/plans/*.md. Do not edit application source. Finish with a markdown plan.'
  if (mode === 'debug')
    return '\n\nDEBUG MODE: hypotheses via debug_log first. Instrument, reproduce, then the smallest fix.'
  if (mode === 'multitask')
    return '\n\nMULTITASK: decompose and run independent work in parallel via task() Explore/Bash/Browser/Research workers. Digests only.'
  return ''
}

export async function* runForge(ctx: ForgeContext, localReady: boolean): AsyncGenerator<StreamChunk> {
  const mode = ctx.mode ?? 'agent'
  const rules = selectRules(ctx.rules, ctx.openFiles, ctx.task)
  const skills = ctx.customSkill
    ? [ctx.customSkill, ...matchSkills(ctx.skills, ctx.task, 2)]
    : matchSkills(ctx.skills, ctx.task, 3)

  const packed = packContext(ctx, skills, rules)
  const designLoop = ctx.needsTools === true || taskNeedsDesignTools(ctx.task)
  const sys =
    KERNEL_SYSTEM +
    modeSuffix(mode) +
    (designLoop
      ? '\n\nThis task is DesignIR. Only design_get, design_patch, and design_ingest_tokens. No explore. No fs_write of the IR file.'
      : '')
  const cap = ctx.contextCap ?? 8000
  const ring = ringFrom({
    system: sys,
    tools: ctx.tools.map((t) => t.name + t.description).join(' '),
    rules: rules.map((r) => r.body).join(' '),
    skills: skills.map((s) => s.body).join(' '),
    rag: ctx.ragHits.map((h) => h.snippet).join(' '),
    mentions: ctx.mentionBlobs ?? '',
    chat: ctx.task,
    cap
  })
  ctx.onContext?.(ring)
  yield { type: 'context', context: ring }

  yield { type: 'step', step: 'perceive' }
  yield {
    type: 'status',
    text: `perceive · rag ${ctx.ragHits.length} · rules ${rules.length} · skills ${skills.map((s) => s.name).join(', ') || 'none'} · ctx ${ring.total}/${ring.cap}`
  }

  yield { type: 'step', step: 'route' }
  const route = await classifyRoute(ctx, localReady)
  yield { type: 'status', text: `route=${route}`, route }

  const messages: ChatMessage[] = [
    { role: 'system', content: sys },
    {
      role: 'user',
      content: `${packed}\n\nTask:\n${ctx.task}\n\n${forgeActHint(mode, ctx.task, ctx.needsTools === true)}`
    }
  ]

  let provider = mode === 'think' ? 'local' : providerFor(route, ctx.pinnedProvider)
  if (provider !== 'local') {
    const keyName = provider === 'openai' ? 'openai' : 'openrouter'
    if (!(await ctx.getKey(keyName))) provider = localReady ? 'local' : provider
  }

  const apiKey = provider === 'local' ? null : await ctx.getKey(provider === 'openai' ? 'openai' : 'openrouter')
  const toolTrace: string[] = []
  const verifyPatches: string[] = []
  let lastText = ''
  let wroteFiles = false
  let patched = false

  const turnCap = Math.min(32, Math.max(1, Math.trunc(Number(ctx.maxTurns)) || 12))
  for (let turn = 0; turn < turnCap; turn++) {
    if (ctx.signal?.aborted) {
      yield { type: 'status', text: 'stopped' }
      yield { type: 'done' }
      return
    }
    const steered = ctx.pullSteer?.()
    if (steered) {
      messages.push({ role: 'user', content: `[steer] ${steered}` })
      yield { type: 'status', text: `steer · ${steered.slice(0, 80)}` }
    }
    yield { type: 'step', step: 'act' }
    const pendingTools: ToolCall[] = []
    let acc = ''
    try {
      for await (const chunk of chatCompletions({
        provider,
        apiKey,
        localPort: ctx.localPort,
        messages,
        tools: ctx.tools,
        temperature: mode === 'plan' || mode === 'think' ? 0.2 : 0.15,
        signal: ctx.signal,
        toolChoice: designLoop && !patched ? designToolChoice(ctx.tools) : undefined
      })) {
        if (chunk.type === 'text' && chunk.text) {
          acc += chunk.text
          lastText += chunk.text
          yield chunk
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          pendingTools.push(chunk.toolCall)
        } else if (chunk.type === 'usage') {
          const n = takeUsageTotal(chunk.usage)
          if (n) yield { type: 'usage', usage: { total: n } }
        } else if (chunk.type === 'error') {
          if (provider !== 'local' && localReady) {
            yield { type: 'status', text: `${provider} failed → local` }
            provider = 'local'
            acc = ''
            break
          }
          yield chunk
          return
        }
      }
    } catch (err) {
      if (ctx.signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
        yield { type: 'status', text: 'stopped' }
        yield { type: 'done' }
        return
      }
      yield { type: 'error', error: err instanceof Error ? err.message : String(err) }
      return
    }

    const calls = pendingTools.length ? pendingTools : parseQwenToolCalls(acc)
    if (!calls.length) break

    messages.push({ role: 'assistant', content: acc, toolCalls: calls })

    const heavy = calls.filter((c) => c.name === 'test_run' || c.name === 'terminal_run')
    if (heavy.length) {
      yield { type: 'status', text: `Waiting up to 3m 28s for shell` }
    }
    for (const call of calls) {
      const pub = publicToolCall(call)
      if (pub) {
        const lane = takeWorkflowLane(undefined, pub.name, 'act', false)
        yield { type: 'tool_call', toolCall: pub, lane }
      }
    }
    const results = await Promise.all(calls.map((call) => ctx.runTool(call)))
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i]
      const result = results[i]
      if (call.name === 'fs_write' || call.name === 'str_replace') {
        wroteFiles = true
        if (result.ok) {
          const blob = takeVerifyPatch(result.extra, ctx.workspaceRoot)
          if (blob) {
            verifyPatches.push(blob)
            if (verifyPatches.length > 3) verifyPatches.shift()
          }
        }
      }
      if (call.name === 'design_patch' && result.ok) patched = true
      toolTrace.push(`${call.name}: ${result.ok ? 'ok' : 'err'} ${result.content.slice(0, 180)}`)
      messages.push({
        role: 'tool',
        name: call.name,
        toolCallId: call.id,
        content: result.content.slice(0, 6000)
      })
      const cmd =
        typeof call.arguments.command === 'string'
          ? call.arguments.command.replace(/\s+/g, ' ').slice(0, 140)
          : typeof call.arguments.kind === 'string'
            ? `test_run ${call.arguments.kind}`
            : ''
      const extra =
        call.name === 'test_run' || call.name === 'terminal_run' ? `\n${result.content.slice(0, 8000)}` : ''
      const cap = extra && cmd ? ` ${cmd}` : ''
      yield { type: 'status', text: `${result.ok ? 'ok' : 'err'} ${call.name}${cap}${extra}` }
    }
  }

  yield { type: 'step', step: 'verify' }
  let criticRan = false
  if (ctx.skipVerify) {
    yield { type: 'status', text: 'verify · skipped (subagent)' }
  } else if (
    wroteFiles &&
    (mode === 'agent' || mode === 'debug' || mode === 'multitask') &&
    !designLoop
  ) {
    const vTools = verifyToolDefs(ctx.tools)
    if (vTools.length) {
      yield { type: 'status', text: 'verify · critic pass (str_replace|debug_log|ask_user)' }
      yield { type: 'tool_call', toolCall: { id: 'critic', name: 'critic', arguments: {} }, lane: 'critic' }
      criticRan = true
      messages.push({
        role: 'user',
        content: verifyUserPrompt(
          toolTrace,
          verifyPatches,
          takeVerifyDiff(ctx.workspaceRoot),
          ctx.verifyNote ? { note: ctx.verifyNote } : undefined
        ).slice(0, 4000)
      })
      const vCap = 2
      for (let vt = 0; vt < vCap; vt++) {
        if (ctx.signal?.aborted) break
        const pending: ToolCall[] = []
        let vacc = ''
        try {
          for await (const chunk of chatCompletions({
            provider,
            apiKey,
            localPort: ctx.localPort,
            messages,
            tools: vTools,
            temperature: 0.1,
            signal: ctx.signal
          })) {
            if (chunk.type === 'text' && chunk.text) {
              vacc += chunk.text
              lastText += chunk.text
              yield chunk
            } else if (chunk.type === 'tool_call' && chunk.toolCall) {
              pending.push(chunk.toolCall)
            } else if (chunk.type === 'usage') {
              const n = takeUsageTotal(chunk.usage)
              if (n) yield { type: 'usage', usage: { total: n } }
            } else if (chunk.type === 'error') {
              yield { type: 'status', text: 'verify · critic skipped' }
              pending.length = 0
              break
            }
          }
        } catch {
          break
        }
        const vcalls = takeVerifyCalls(pending.length ? pending : parseQwenToolCalls(vacc))
        if (!vcalls.length) break
        messages.push({ role: 'assistant', content: vacc, toolCalls: vcalls })
        for (const call of vcalls) {
          const pub = publicToolCall(call)
          if (pub) yield { type: 'tool_call', toolCall: pub, lane: 'critic' }
        }
        const vresults = await Promise.all(vcalls.map((call) => ctx.runTool(call)))
        for (let i = 0; i < vcalls.length; i++) {
          const call = vcalls[i]
          const result = vresults[i]
          if (call.name === 'str_replace') {
            wroteFiles = true
            if (result.ok) {
              const blob = takeVerifyPatch(result.extra, ctx.workspaceRoot)
              if (blob) {
                verifyPatches.push(blob)
                if (verifyPatches.length > 3) verifyPatches.shift()
              }
            }
          }
          toolTrace.push(`verify ${call.name}: ${result.ok ? 'ok' : 'err'}`)
          messages.push({
            role: 'tool',
            name: call.name,
            toolCallId: call.id,
            content: result.content.slice(0, 4000)
          })
          yield { type: 'status', text: `${result.ok ? 'ok' : 'err'} ${call.name}` }
        }
      }
    } else {
      yield { type: 'status', text: 'verify · files changed — no critic tools' }
    }
  } else if (wroteFiles) {
    yield { type: 'status', text: 'verify · files changed — kernel expects a read-back or test if you continue' }
  } else {
    yield { type: 'status', text: toolTrace.length ? `verify · ${toolTrace.length} tool calls` : 'verify · no tools' }
  }

  yield { type: 'step', step: 'remember' }
  if (toolTrace.length && mode !== 'ask' && !ctx.skipRemember) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const discovery = `---
title: ${JSON.stringify(ctx.task.slice(0, 80))}
route: ${route}
mode: ${mode}
---

# ${ctx.task.slice(0, 80)}

${lastText.slice(0, 1200)}

## Tools

${toolTrace.join('\n')}
`
    const dest = join(ctx.workspaceRoot, 'RAG', 'discoveries', `${stamp}.md`)
    try {
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, discovery, 'utf8')
      yield { type: 'status', text: `remembered discoveries/${stamp}.md` }
      const promo = promoteDiscovery({
        task: ctx.task,
        tools: toolTrace,
        text: lastText,
        mode,
        stamp
      })
      if (promo.body && promo.rel) {
        const promoDest = join(ctx.workspaceRoot, promo.rel)
        if (promo.rel === promoteRel(stamp) && !promo.rel.includes('..')) {
          await writeFile(promoDest, promo.body, 'utf8')
          yield { type: 'status', text: `promote · ${promo.kind} · ask to apply ${promo.slug}` }
        }
      }
      if (criticRan) {
        const learned = curateSkillProposal({
          discoveries: ['verify ok', 'prevent shipped', lastText.slice(0, 200)],
          task: ctx.task,
          existing: []
        })
        if (learned.body && learned.slug) {
          const skillRel = `RAG/discoveries/${stamp}.skill.md`
          if (!skillRel.includes('..')) {
            await writeFile(join(ctx.workspaceRoot, skillRel), learned.body, 'utf8')
            yield { type: 'status', text: `curate · skill ${learned.slug} · ask to install` }
          }
        }
      }
    } catch (err) {
      yield { type: 'status', text: `remember failed: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  yield { type: 'done' }
}

export async function writeNote(root: string, relative: string, content: string): Promise<void> {
  const dest = join(root, relative)
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, content, 'utf8')
}

export { tokensOf }

---
id: rec-activity-groups
title: Fold agent traces client-side; labels are text, not HTML
stack: electron
status: tried
---

# Fold agent traces client-side

## Shape (do this)
- Mechanism: consecutive tool/shell and diff log items become collapsible groups in the renderer. Background rail reads `takeWorkflow` (Hunt/Verify/Critic) from forge `step` + tagged `tool_call` lanes, plus llama status and cloud **summaries**.
- Good code shape: `groupActivity` + `stripActivityText`; `takeWorkflow` / `splitWorkflowPhases`; React text nodes; `countRunningTasks` so busy+wait is one forge row; `chromeRoute(activity, cowork === true)` → `design|cowork|code`; Effort is `EFFORT_LABELS` / 6 dots, not forge.
- Do not: `dangerouslySetInnerHTML` for captions; dump `lastTrace` or llama `error` bodies; import `@homeai/runtime` barrel into the renderer (Node `fs`); a Stage pill beside Chat and Cowork | Code | Design; treat a layoutMode string as cowork; fake Opus 5 / Hunt3 fleets; mint tokens from `text.length`.

## Ports (same idea, other systems)
- Web/API: activity DTO `{ type, label, items[] }` from a worker; same strip of `<>`
- Desktop/IPC: no new channels — group existing `StreamChunk` → `LogItem`
- Mobile: same grouping on a flattened event list
- Worker/CLI: `homeai log --group` printing `Ran N commands`

## Curiosity (open)
- Why not a new backend scheduler? The forge already emits steps and tool status; `takeWorkflow` is a jailed reducer over that stream, shared by desktop / Telegram / Mini App.
- What is weak at 10x tools? Fold headers hide failures — keep `err` lines inside the open group. Cap agents at 64; pips at 16.

## Weaknesses / bugs / holes
- Unstripped `<>` in fold labels or Background agent names would be XSS if anyone switched to HTML (AP-SEED-03, AP-20260828-11, AP-20260904-68).
- Cloud job ids in the rail must stay allowlisted (AP-20260828-8).
- Barrel-importing runtime into the renderer pulls `node:fs`.
- `chromeRoute` second arg must be `=== true` (AP-20260901-42). A layoutMode string is Code, not cowork.
- Foreign `runId` on a live workflow must not merge (AP-20260904-68).
- Token cells from `text.length` look like llama metrics (AP-20260828-13, AP-20260904-68).
- Stop that drops `runId` immediately lets the foreign listener double-fold abort chunks (AP-20260904-69).
- Usage chunks before `tool_call` used to miss the agent row; `pendingUsage` is the fix.

## Prevent / robust delivery
- Tests: `packages/runtime/src/activity.test.mjs`, `packages/runtime/src/stage-chrome.test.mjs`, `telegram-chrome.test.mjs`
- Deny-by-default: strip `<>` in every group/session/think/workflow title shown in Agents; `chromeRoute` only `design|cowork|code`; `takeWorkflow` allowlisted ids/lanes/tokens; sealed workflow ignores post-stop `tool_call`; glance `phases` is stripped text.
- Hunt layers: client, ipc, jobs

## Refinement log
- 2026-08-28 — Wave J Agents sessions + grouped log + Background rail. Worked: labels strip markup. Next: keep a tool row `running` until the status chunk; do not clone Cowork/Code product chrome.
- 2026-09-01 — Waves M–Q. Worked: compact thought fold, `parseReviewHunks` path jail, `laneBuckets` + `publicTokens`. Next: duration on tool rows still client-side from start/end, not llama n_tokens.
- 2026-09-01 — Code 01–13 session kebab + Effort. Worked: `sessionTitle`/`chatLink`/`filterTranscript` (AP-20260901-33). Failed: Effort is UI-only (no fake Ultracode fleet). Next: persist Effort into forge if a real knob exists.
- 2026-09-01 — Stage Wave O. Worked: Background lanes are `laneBuckets` running/done/error, not Hunt/Verify product clone. Next: duration still from start/end, never `text.length/40`.
- 2026-09-01 — Stage continue. Worked: compact thought groups fold like commands; `chromeRoute` returns chat|stage|focus|design. Failed: `splitHuntVerify` still exported for older tests. Next: drop Hunt/Verify helper when no tests need it.
- 2026-09-01 — Bible Hunt/Verify labels map real `splitHuntVerify` tool names (not a 22-agent Hunt3 fleet). Pills exclusive via `chromeRoute` (AP-20260901-36). Effort is 6 dots, still UI-only. Next: Effort→forge only if asked.
- 2026-09-01 — Locked `chromeRoute(activity, cowork)` → `design|cowork|code`. Stage stays kebab Open in. Hunt/Verify from `splitHuntVerify`. Failed: layoutMode Stage pill kept drifting; helper is now cowork-only. Next: Effort still UI-only.
- 2026-09-01 — Wave R. Worked: `chromeRoute` is layoutMode again (`chat|stage|focus|design`); Cowork boolean is a clone hole. Dropped fake Effort UI. Lanes stay `laneBuckets`. Next: duration still from start/end.
- 2026-09-01 — E2E bible re-lock. Worked: `chromeRoute(activity, cowork)` → `design|cowork|code` in `StagePills`; Hunt/Verify from `splitHuntVerify`; Effort visual again (not forge). Failed: layoutMode Stage pill keeps rewriting this helper. Next: keep kebab Open in → Agents Stage.
- 2026-09-01 — Wave S. Worked: `stage-chrome.test.mjs` lock; lanes `laneBuckets`; Effort UI removed; `thinkPick`/`forgeIsFault`. Next: duration still from start/end.
- 2026-09-01 — Wave T. Worked: one session list + `StageGo`; dropped duplicate agent-tabs and dead Customize. Next: duration still from start/end.
- 2026-09-01 — Remaining-gaps bible re-lock. Worked: `chromeRoute` is `design|cowork|code` with `cowork === true` (AP-20260901-42); StagePills Chat and Cowork | Code | Design; Hunt/Verify; Effort visual; Customize honest-disabled. Failed: Electron was not click-walked here. Next: keep kebab Open in → Agents Stage; do not put Stage back on the pill row.
- 2026-09-01 — Effort 6 dots + Customize restored as UI-only (not forge). Worked: `EFFORT_LABELS` / `takeEffort` React text; Customize `disabled`. Next: do not persist effort into llama.
- 2026-09-04 — Shared `takeWorkflow` Hunt/Verify/Critic DTO + BackgroundTasks panel. Worked: critic lane from VERIFY pass, not ACT `str_replace`; Stage/Glance same fractions; tokens only from SSE usage. Failed: no Electron click-walk in this agent. Next: operator Stage default-open Background; empty Tokens when the provider sends no usage.
- 2026-09-04 — Gap fill. Worked: `pendingUsage` → next agent; Stop keeps `runId` until `done` (`desktopOwnsAgentChunk`); Stage default-open only on enter; Telegram logs step/tool; `data-tool` + `revealTool`; glance top-level `phases`. Failed: still no Electron click-walk. Next: click-walk kebab → Background → Stop on a live run.
- 2026-09-04 — Debug pane reads the same `takeWorkflow` DTO (Hunt/Verify/Critic counts, no minted tokens). Stage stays off the pill row.
- 2026-09-04 — Electron click-walk. Worked: Debug pane shows Kernel/Run/Ports/Hunt-Verify-Critic empty state (not a blank QA log); BackgroundTasks already shipped, Stage still kebab-only. Next: live forge still needed to see Critic rows; empty tokens when SSE usage is absent.
- 2026-09-04 — Feature refine. Worked: Terminal Debug tab prints `workflowPhaseLine` + Open Debug pane; Customize removed again (Wave T). Next: still empty tokens without SSE usage.
- 2026-09-05 — Compiler-OS. Worked: Trust lane on Auto Review status; `workflowPhaseLine` prefixes Trust. Failed: click-walk. Next: live forge Trust row.

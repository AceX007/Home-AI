---
id: rec-agents-stage
title: One workbench, three layout regimes; chrome is a jailed DTO
stack: electron
status: tried
---

# Agents Stage layout

## Shape (do this)
- Mechanism: Dock / Stage / Focus are `layoutMode` on the same window. Stage fills the Agents column; Focus is a 28px ticker. Density folds activity client-side.
- Good code shape: `takeLayout` allowlists `layoutMode` + `density`; `groupActivity(items, { density })`; React text nodes; `publicToolCall` still drops arguments; llama popover uses `takeChromePulse` gpu/vram/ngl/ctx/llamaErr.
- Do not: persist unknown modes; stream tool args; fake token counts from `text.length`; put Stage back on the pill row (kebab Open in only).

## Ports (same idea, other systems)
- Web/API: PATCH `/layout` with the same takeLayout
- Desktop/IPC: `homeai:workbench:layout:*` + CSS `data-layout`
- Mobile: Telegram Glance/Stage already has pulse + think Implement; no third window
- Worker/CLI: `homeai layout --mode stage`

## Curiosity (open)
- Why not a separate Agents window? One kernel, one chrome, three regimes.
- What breaks at 40 sessions? Filter + pin; cap fold groups; potato skips motion.

## Weaknesses / bugs / holes
- Unknown `layoutMode` from renderer JSON would become a CSS injection if interpolated (AP-20260901-31).
- Session filter / review hunk lines as HTML (AP-SEED-03, AP-20260901-32).
- Fake tokens from chunk length look like llama metrics (AP-20260828-13 sibling).
- `chromeRoute` is `design|cowork|code` with `cowork === true` (AP-20260901-42). layoutMode stays dock|stage|focus for the window, not the pill row.
- Go strip skill/tool names as HTML or unjailed slashes (AP-20260901-41).

## Prevent / robust delivery
- Tests: `packages/runtime/src/workbench-chrome.test.mjs`, `activity.test.mjs`, `stage-chrome.test.mjs`
- Deny-by-default: layoutMode dock|stage|focus; density compact|comfortable|spacious; tokens `/^\d+k?$/`; `takeGoTab`; `publicSkillPeek` / `publicStackPeek`.
- Hunt layers: client, ipc

## Refinement log
- 2026-09-01 — Waves M–Q Stage UX. Worked: allowlisted layout + density, thought fold, lane buckets, think done-after-verify in main. Next: do not add a generic fs.stat; keep operator browser navigate open.
- 2026-09-01 — Wave R. Worked: `StagePills` owns Chat/Stage/Code/Design (`chromeRoute` is layoutMode); pins persist via `takePinnedChats`; wait-banner for shell approval; llama vram on the live rail; Think files on the wf-card. Failed: Cowork clone kept rewriting ChatPane pills — extracted `StagePills.tsx`. Next: keep operator navigate open; do not add fs.stat.
- 2026-09-01 — E2E bible: `StagePills` is Chat and Cowork | Code | Design; `takePinnedChats` still jailed. Next: do not put Stage back on the pill row.
- 2026-09-01 — Wave S. Worked: dedicated `stage-chrome.test.mjs` fails if `chromeRoute` returns cowork/code; Focus ticker Hold; `StageTrustRow` Allow/Deny + counts; `thinkPick` only ready|implementing; Map chips open files; lanes running/done/error; Effort gone. Next: Telegram glass Stage is a sibling agent; keep operator navigate open.
- 2026-09-01 — Wave T. Worked: `StageGo` New/Mode/Tools/Skills; one session list (tabs dropped); titlebar opens mode menu; palette New chat + Skills under Agents; `publicSkillPeek`/`publicStackPeek`. Failed if we had kept duplicate agent-tabs + a dead Customize button. Next: keep operator navigate open; do not add a marketplace.
- 2026-09-01 — Remaining-gaps. Worked: bible pills via `chromeRoute(activity, cowork === true)`; Stage layout still kebab. Failed: Wave S lock said never cowork — T-46 now asserts cowork|code|design. Next: keep operator navigate open.
- 2026-09-01 — Effort 6 dots UI-only on Chat follow-bar; Customize honest-disabled. Next: do not persist effort into llama.
- 2026-09-04 — Feature refine. Worked: Customize removed (was a no-op); Stage page panes keep `1fr` so Board/Library/Fleet are not a strip beside Agents. Next: still no Stage on the pill row.
- 2026-09-04 — Chat home. Worked: HxEmpty + Hex AI kicker; Density select; Skills empty hint + Alt+click pin; Background nudge when forge idle. Next: still no Stage on the pill row.

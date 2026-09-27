---
id: rec-tool-packs
title: Pack-filter tools so the 2B never sees the full MCP dump
stack: electron
status: refined
---

# Pack-filter tools so the 2B never sees the full MCP dump

## Shape (do this)
- Mechanism: tag each tool with `pack`; `toolsForMode` keeps `core` plus packs from `/pack` and task keywords; MCP only if `mcp-domain`.
- Good code shape: `detectToolPacks` → `keepFullSchema` + `shrinkToolDef`. Extra packs get full JSON; surgical core (`CORE_FULL_TOOLS`) keeps params; everything else is name + one-line. Think uses `THINK_FULL_TOOLS`.
- Do not: merge every MCP schema into the parent 2B; do not treat `/pack` as a skill strip; do not match skill substring `web` (workbench ≠ research).

## Ports (same idea, other systems)
- Web/API: capability scopes on the session
- Desktop/IPC: this recipe
- Mobile: same pack list on Telegram `/do`
- Worker/CLI: `--pack research`

## Curiosity (open)
- Why not one giant tool list? 2B tool selection collapses past a few dozen schemas.
- What if the operator needs MCP mid-run? `/pack mcp-domain` or the keyword `mcp`.
- What breaks if a skill description says “workbench”? Word-boundary match only (`\bresearch\b`, `\bweb_search\b`).

## Weaknesses / bugs / holes
- Slash `/pack` used to be consumed as a skill name (AP-20260901-47).
- Skill substring `web` used to activate research (AP-20260904-57).
- Default agent without keywords cannot call `web_search` until research pack.
- Ask used to keep `speak`/`inbox_stt`/`inbox_ocr`/browser extract/screenshot/console. Now ASK_BLOCK. Link: AP-20260904-71.

## Prevent / robust delivery
- Tests: `packages/runtime/src/tool-surface.test.mjs`
- Deny-by-default: empty detect → core only
- Hunt layers: ipc

## Refinement log
- 2026-09-01 — Home OS Wave A. Worked: core-only default; MCP schemas shrink to name + one-line, cap 24. Telegram STACK catalog stays core and prints `/pack …` instead of dumping MCP. Next: skill hot-reload is already per-forge `loadAllKnowledge`.
- 2026-09-04 — Telegram `/help` no longer claims every MCP on `/do`. Next: skill hot-reload without full boot is still recipe-next.
- 2026-09-04 — `keepFullSchema`: Think shrink; extra packs full only for that pack + surgical core. Skill keywords are word-boundary. Stamp now includes root `AGENTS.md`. Next: `.cursor/skills` still not in the stamp.
- 2026-09-04 — ASK_BLOCK covers life/browser reads; `filterLifeTools` when bins missing. Next: Think still skips pack-filter on purpose for 2B perceive.
- 2026-09-05 — Compiler-OS. Worked: `freezeToolList` at forge start. Failed: click-walk. Next: still no mid-turn MCP add.

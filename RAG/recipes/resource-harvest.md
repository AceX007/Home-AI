---
id: rec-resource-harvest
title: Resources donate backends, never chrome
stack: electron
status: tried
---

# Resources donate backends, never chrome

## Shape (do this)
- Mechanism: catalog every `AI Resources` tree as analog/port/skip-ui/skip-unjail/next. Port via Hex MCP hub or kernel tools. Never import foreign React/CSS.
- Good code shape: `RESOURCE_HARVEST` + `harvestKindForDir`; starter `takeMcpEnableOpts` own-key `pack === 'blender'` only; local `uv --directory`, not `uvx`.
- Do not: copy Code IDE / Eliza / Kirara UI; auto-enable DesktopCommander; register `gitmcp.io`; pack `AI Resources/**`.

## Ports (same idea, other systems)
- Web/API: allowlisted integration ids in a capabilities table
- Desktop/IPC: this recipe (`enableMcpStarter` + harvest catalog)
- Mobile: Telegram already; extra IM via MCP later
- Worker/CLI: same catalog, no GUI spawn

## Curiosity (open)
- Why not vendor ScrapeGraph now? Playwright + outbound LLM is SSRF until a jailed compute tool exists.
- What breaks if blender `uv` is missing? Handshake fails honestly; Settings copy stays Ask.

## Weaknesses / bugs / holes
- Renderer `pack` string must be allowlisted (AP-20260905-5).
- Relative MCP args still run from workspace; extra-root DesktopCommander is skip-unjail.
- Duplicate `mcp-main (2)` folders collapse via `harvestDirKey`.

## Prevent / robust delivery
- Tests: T-115 `resource-harvest.test.mjs`
- Deny-by-default: starterForbidden; blender only when checkout + pack
- Hunt layers: ipc, client, ci

## Refinement log
- 2026-09-05 — Catalog + Blender port. Worked: local uv checkout in example JSON. Failed if we had enabled DesktopCommander. Next: ScrapeGraph as jailed compute, not a web UI.
- 2026-09-05 — Compiler-OS. Worked: `COMPILER_OS_PORTS` analog/port/next only; Trust starter chip; harvest ids include mcp-use/activepieces. Failed: codebase-memory dist missing. Next: still no gitmcp.io.

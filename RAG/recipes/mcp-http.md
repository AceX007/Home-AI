---
id: rec-mcp-http
title: MCP over stdio or streamable HTTP, same JSON-RPC
stack: electron
status: refined
---

# MCP over stdio or streamable HTTP

## Shape (do this)
- Mechanism: config lists `command` or `url`; hub speaks JSON-RPC `initialize` / `tools/list` / `tools/call`.
- Good code shape: `HttpMcp` POSTs JSON; `Mcp-Session-Id`; SSE `data:` parsed by id; `urlAllowed` before connect.
- Do not: `Object.assign` mcp.json; `fetch` a URL off the net allowlist; log `Authorization`.

## Ports (same idea, other systems)
- Web/API: server-side MCP proxy with the same allowlist
- Desktop/IPC: this recipe (`McpHub` in main)
- Mobile: do not embed MCP stdio; HTTP only
- Worker/CLI: same client, argv `--mcp-url` jailed by allowlist

## Curiosity (open)
- Why HTTP and stdio share handshake? One tool schema for the 2B.
- What if the server wants GET+SSE legacy? First ship is streamable POST only.
- Analog: GitHub Copilot / public MCP streamable HTTP spec.

## Weaknesses / bugs / holes
- Config URL is SSRF if connect skips `urlAllowed` (AP-20260828-5).
- `mcpToolAllowed` empty list → ask every call (safe, noisy).
- Header secrets in mcp.json — do not print them.
- DNS rebinding: we match hostname text, not resolved IP.

## Prevent / robust delivery
- Tests: `packages/runtime/src/mcp-http.test.mjs`
- Deny-by-default: own-keys cfg; block `NODE_OPTIONS` / hop-by-hop headers; net allowlist at connect.
- Hunt layers: ipc, api

## Refinement log
- 2026-08-28 — Wave E first HTTP client. Worked: reuse stdio JSON-RPC methods. Next: live handshake against a local streamable server; legacy SSE GET if needed.
- 2026-08-28 — Wave G: `homeai:mcp:reload` after permissions save; list shows origin+path only. Next: live handshake vs a local streamable server.
- 2026-09-01 — Live handshake test + Settings Enable MCP starter (`mcp-packs.mjs`). Empty allowlist still asks. MCP tool JSON shrinks when the pack is on so the 2B sees names, not 80 schemas. Settings lists `domainPackLines` (HA / Blender / messaging). Next: operator enable codebase-memory when dist exists.
- 2026-09-04 — Committed `.homeai/mcp.example.json` + `exampleMcpConfig` (own-key `takeMcpServerCfg` only). Enable starter still does not auto-allowlist MCP. Next: operator enable codebase-memory when dist exists.
- 2026-09-04 — `enableMcpStarter` also writes `.homeai/mcp.example.json` via `writeMcpExample`. Next: still no auto `mcpAllowlist` rows (Ask remains default).
- 2026-09-05 — Blender MCP is opt-in `pack: blender` with local `uv --directory`, not `uvx`. DesktopCommander stays out of starter. Next: operator Enable Blender MCP with uv + Blender addon.

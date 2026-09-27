---
id: disc-wave-e-mcp
folder: discoveries
---

# Wave E — origin net allowlist + URL MCP

- **Task:** Continue after Wave D. Recipe next was origin-parse; only explicit stub was URL MCP.
- **Files:** `policy.mjs` `urlAllowed`; `mcp.ts` `HttpMcp`; `mcp-http.mjs`; forge uses `mcpToolAllowed`.
- **Commands:** `npm test`; `npm run build`; relaunch Electron by PID.
- **Worked:** default `http://127.0.0.1` still covers :8765 because allow entries without a port match any port on that host. UI browser navigate left operator-open.
- **Recipes:** [permissions-policy](../recipes/permissions-policy.md) · [mcp-http](../recipes/mcp-http.md)
- **Anti-patterns:** AP-20260828-4 · AP-20260828-5

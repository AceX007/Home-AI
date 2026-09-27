---
id: feat-mcp-starter
---
# MCP starter pack

- **Works:** Hub was empty. Settings Enable MCP starter writes `.homeai/mcp.json` and `.homeai/mcp.example.json`. **Trust starter MCP** merges `server:*` for starter ids only (not DesktopCommander). Domain pack hints listed in Settings. Calls still Ask until allowlisted. Blender is opt-in (`pack: blender`) via local `uv --directory`, not `uvx` / PyPI.
- **Made:** [`packages/runtime/src/mcp-packs.mjs`](../../../packages/runtime/src/mcp-packs.mjs) + `starterTrustRules` in [`compiler-os.mjs`](../../../packages/runtime/src/compiler-os.mjs)
- **Recipe:** [mcp-http](../../recipes/mcp-http.md) · [resource-harvest](../../recipes/resource-harvest.md) · [compiler-os](../../recipes/compiler-os.md)
- **Tests:** T-65 T-115 T-116 T-120
- **Edges:** E-22 E-111 E-113

---
id: feat-resource-harvest
---
# Resource harvest

- **Works:** Every top-level `AI Resources` folder has a kind (`analog` / `port` / `skip-ui` / `skip-unjail` / `next`). Compiler-OS ports (`COMPILER_OS_PORTS`) stay analog/port/next. Blender MCP is the first port. DesktopCommander / GitMCP / ScrapeGraph are not auto-started. Trust starter never allowlists skip-unjail.
- **Made:** [`resource-harvest.mjs`](../../../packages/runtime/src/resource-harvest.mjs), [`compiler-os.mjs`](../../../packages/runtime/src/compiler-os.mjs) `harvestPortKind`.
- **Recipe:** [resource-harvest](../../recipes/resource-harvest.md) · [compound-os](../../recipes/compound-os.md) · AP-20260905-5 · AP-20260905-9
- **Tests:** T-115 T-120
- **Edges:** E-111 E-117

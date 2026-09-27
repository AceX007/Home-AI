---
id: feat-tool-packs
---
# Tool packs

- **Works:** Agent 2B sees `core` plus packs from `/pack` and task keywords. Extra packs keep full schemas; surgical core keeps params; Think shrinks to perceive/handoff. MCP only with `mcp-domain`, schemas name-only. Ask blocks life/browser reads. Missing tesseract/whisper/piper drop those tools.
- **Made:** [`packages/runtime/src/tool-packs.mjs`](../../../packages/runtime/src/tool-packs.mjs) `keepFullSchema` + `detectToolPacks`. [`tool-surface.mjs`](../../../packages/runtime/src/tool-surface.mjs) `ASK_BLOCK` + `filterLifeTools`.
- **Recipe:** [tool-packs](../../recipes/tool-packs.md) · [kernel-loop](../../recipes/kernel-loop.md) · AP-20260904-71
- **Tests:** T-25 T-47 T-62 T-75 T-82 T-90 T-117
- **Edges:** E-56 E-69 E-114

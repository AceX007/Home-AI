---
id: feat-ts-intel
---
# Project-aware TypeScript / JavaScript intelligence

- **Works:** Main-process LanguageService over jailed reads + dirty overlays. File diagnostics/hover/completions and workspace symbol walks run in `worker_threads` with an internal cancel generation (rename stays on main + checkpoint). Monaco completions, hover, definition, references, document symbols, format, and rename. Checks lists compiler diagnostics separately from QA. `code_outline` uses the same host for TS/JS. Rename writes go through `writeFileSafe` + review pending. `lspQuery` remains the non-TS fallback.
- **Made:** [`packages/ts-intel/src/index.mjs`](../../../packages/ts-intel/src/index.mjs) `takeTsRequest` `workspaceSymbolsIsolated`; IPC `homeai:ts:*`; [`tsLanguage.ts`](../../../apps/renderer/src/lib/tsLanguage.ts); Checks in [`TerminalPane.tsx`](../../../apps/renderer/src/panes/TerminalPane.tsx).
- **Recipe:** [ts-intel](../../recipes/ts-intel.md) · [agent-ide](../../recipes/agent-ide.md) · AP-20260905-22 · AP-20260905-25 · AP-20260905-28
- **Tests:** T-125 T-126 T-127 T-131
- **Edges:** E-130 E-131 E-135 E-138

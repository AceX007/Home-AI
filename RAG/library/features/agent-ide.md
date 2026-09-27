---
id: feat-agent-ide
---
# Agent-smart IDE (LSP / DAP / git impact)

- **Works:** `code_outline` returns TypeScript LanguageService symbols/refs/diagnostics for TS/JS, else brace/symbol `lspQuery`. `explore` appends same-file `refs`. Node Inspector + `test_run` write jailed `data/debug/*.evidence.json`. `git_diff` lists impact hunks; Monaco shows jailed added-line gutters. Chrome DevTools analog names are allowlisted; DesktopCommander names are not.
- **Made:** [`compiler-os.mjs`](../../../packages/runtime/src/compiler-os.mjs) `lspQuery` `takeDapEvidence` `gitImpactHunks` `chromeDevtoolsDepth`. Host: [`tools.ts`](../../../apps/desktop/src/main/tools.ts). TS host: [`ts-intel`](../../../packages/ts-intel/src/index.mjs). Inspector: [`debug`](../../../packages/debug/src/index.mjs).
- **Recipe:** [agent-ide](../../recipes/agent-ide.md) · [ts-intel](../../recipes/ts-intel.md) · [node-inspect](../../recipes/node-inspect.md) · AP-20260905-8 · AP-20260905-22 · AP-20260905-23 · AP-20260905-24
- **Tests:** T-118 T-126 T-127 T-128 T-129 T-130 T-131
- **Edges:** E-115 E-130 E-131 E-132 E-133 E-134

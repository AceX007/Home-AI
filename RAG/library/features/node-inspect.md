---
id: feat-node-inspect
---
# Loopback Node Inspector

- **Works:** Main-process Inspector session on a jailed JS/TS file. Runtime tab shows stack, locals, watch, continue/step/stop. Agent `debug_*` tools share the same host. Workflow / Kernel log stay distinct. Stop does not touch PTYs. `takeTestFailure` parses node:test `at Fn (file://…:line:col)` frames.
- **Made:** [`packages/debug/src/index.mjs`](../../../packages/debug/src/index.mjs) `takeDebugLaunch` `takeTestFailure` `NodeDebugHost`; IPC `homeai:debug:*`; [`RuntimeDebugPane.tsx`](../../../apps/renderer/src/panes/RuntimeDebugPane.tsx).
- **Recipe:** [node-inspect](../../recipes/node-inspect.md) · [agent-ide](../../recipes/agent-ide.md) · AP-20260905-23 · AP-20260905-27
- **Tests:** T-128 T-129
- **Edges:** E-132 E-133 E-137

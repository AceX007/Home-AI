---
id: feat-coder-sidecar
---
# Coder GGUF sidecar

- **Works:** 2B stays orchestrator. If `probe.profile === 'standard'` and a `DEFAULT_CODER_MODEL_NAMES` GGUF sits in the workspace root, a **second** `LlamaServerManager` binds `127.0.0.1:8766` with ctx ≤2048 and half ngl. Tab/FIM prefers that port. Explore `task` may nested-`runForge` there (`skipVerify`, `skipRemember`, `maxTurns` 2, `toolsForSubagent('explore')`). Think: no nested LLM. Sidecar start failure never stops the 2B. Nested `task` still denied via `host.depth`. Sidecar does not attach to a leftover `/health`; ports pane lists `coder` only when `ownedLlamaPort` is set.
- **Made:** [`coderLlamaArgs`](../../../packages/governor/src/coder-args.mjs) · [`shouldAttachExistingListener`](../../../packages/llm/src/sidecar-own.mjs) · [`ensureCoder`](../../../apps/desktop/src/main/index.ts) · [`runSubagentJobs` nestedForge](../../../packages/runtime/src/subagent.mjs)
- **Recipe:** [kernel-loop](../../recipes/kernel-loop.md) · [subagents](../../recipes/subagents.md)
- **Tests:** T-69 T-72
- **Edges:** E-62 · E-65 · AP-20260901-52 · AP-20260901-54

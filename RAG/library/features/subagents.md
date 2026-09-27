---
id: feat-subagents
---
# Subagents

- **Works:** Parent `task` spawns Explore/Bash/Browser/Research workers; digest return (HTML stripped); research URLs use `web_extract`; Explore finished banner; max 4; nested `task` denied; Think explore-only.
- **Made:** [`packages/runtime/src/subagent.mjs`](../../../packages/runtime/src/subagent.mjs) + [`packages/subagent/src/index.ts`](../../../packages/subagent/src/index.ts)
- **Recipe:** [subagents](../../recipes/subagents.md)
- **Tests:** T-63 T-77
- **Edges:** E-57

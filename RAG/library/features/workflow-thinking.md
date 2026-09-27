---
id: feat-workflow-thinking
---
# Shared Hunt / Verify / Critic workflow

- **Works:** every `runForge` surface reduces the same jailed `WorkflowDto` — Trust (Auto Review) / Hunt / Verify / Critic. Background panel and Stage/Glance print X/Y from that DTO. Not a fake Opus fleet.
- **Made:** [`packages/runtime/src/activity.mjs`](../../../packages/runtime/src/activity.mjs) `takeWorkflow`, [`BackgroundTasks.tsx`](../../../apps/renderer/src/panes/BackgroundTasks.tsx).
- **Recipe:** [activity-groups](../../recipes/activity-groups.md) · [compiler-os](../../recipes/compiler-os.md) · AP-20260904-68
- **Tests:** T-85 T-86 T-87 T-88 T-89 T-120
- **Edges:** E-79 E-80 E-81 E-82 E-83

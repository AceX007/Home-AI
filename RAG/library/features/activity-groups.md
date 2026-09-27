---
id: feat-activity-groups
---
# Agents activity + Background

- **Works:** session rail + Go strip (New/Mode/Tools/Skills), grouped log, Background rail from `takeWorkflow` (Hunt/Verify/Critic); pills are Chat and Cowork | Code | Design (`chromeRoute` cowork === true); Effort 6 dots UI-only; Customize honest-disabled.
- **Made:** [`packages/runtime/src/activity.mjs`](../../../packages/runtime/src/activity.mjs), [`ChatPane.tsx`](../../../apps/renderer/src/panes/ChatPane.tsx), [`BackgroundTasks.tsx`](../../../apps/renderer/src/panes/BackgroundTasks.tsx), [`StagePills.tsx`](../../../apps/renderer/src/panes/StagePills.tsx), [`StageGo.tsx`](../../../apps/renderer/src/panes/StageGo.tsx), `runForge` `publicToolCall`.
- **Recipe:** [activity-groups](../../recipes/activity-groups.md) · AP-20260828-11 · AP-20260828-13 · AP-20260901-33 · AP-20260901-36 · AP-20260901-41 · AP-20260901-42 · AP-20260904-68 · AP-20260904-69
- **Tests:** T-13 T-15 T-43 T-46 T-54 T-53 T-85 T-86 T-87 T-88 T-89
- **Edges:** E-10 E-12 E-38 E-41 E-47 E-48 E-79 E-80 E-81 E-82 E-83

---
id: feat-agents-stage
---
# Agents Stage

- **Works:** Dock / Stage / Focus layout; Chat and Cowork | Code | Design pills (`chromeRoute(activity, cowork === true)` → `design|cowork|code`; Stage is kebab Open in); page activities keep the center `1fr` in Stage; Go strip New/Mode/Tools/Skills as 32px amber-on chips (not Stage pills); sticky Trust row; Focus Hold ticker; Think pick ready|implementing; Hunt/Verify lanes; Effort 6 dots UI-only; llama on rail; PlanDoc think pipeline; pinned chats via `takePinnedChats`.
- **Made:** [`activity.mjs`](../../../packages/runtime/src/activity.mjs) `chromeRoute` / `thinkPick` / `splitHuntVerify` / `takeGoTab`, [`StagePills.tsx`](../../../apps/renderer/src/panes/StagePills.tsx), [`StageGo.tsx`](../../../apps/renderer/src/panes/StageGo.tsx), [`StageFocus.tsx`](../../../apps/renderer/src/panes/StageFocus.tsx), [`StageTrustRow.tsx`](../../../apps/renderer/src/panes/StageTrustRow.tsx).
- **Recipe:** [agents-stage](../../recipes/agents-stage.md) · [activity-groups](../../recipes/activity-groups.md) · [think-handoff](../../recipes/think-handoff.md) · AP-20260901-31 · AP-20260901-38 · AP-20260901-39 · AP-20260901-41 · AP-20260901-42
- **Tests:** T-41 T-42 T-45 T-20 T-43 T-46 T-49 T-50 T-53 T-54 T-101
- **Edges:** E-36 E-37 E-40 E-44 E-45 E-47 E-48

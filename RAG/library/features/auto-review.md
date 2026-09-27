---
id: feat-auto-review
---
# Auto Review v2 PRO

- **Works:** Pre-tool Trust when `approvalMode` is `auto-review`. Judge allows known-safe git/test/read argv plus `node --version`; unmodeled commands go to a local 2B classifier or Ask; too-destructive never runs. Settings persist allow/block via `takeInstructionPair`. Stage/Chat/Telegram help·menu·stage show a jailed Trust line only when that mode is set. Palette and Git share store `reviewText`. Not Landlock, not VERIFY/Critic, not an AST parser.
- **Made:** [`auto-review.mjs`](../../../packages/runtime/src/auto-review.mjs) · [`decideTool`](../../../packages/runtime/src/approvals.ts) · deny halt in [`index.ts`](../../../apps/desktop/src/main/index.ts) · Settings / StageTrustRow / ChatPane / GitPane / CommandPalette
- **Recipe:** [auto-review](../../recipes/auto-review.md) · [permissions-policy](../../recipes/permissions-policy.md) · AP-20260904-74–79 AP-20260904-82–84
- **Tests:** T-92 T-93 T-95 T-120
- **Edges:** E-84 E-85 E-88 E-89 E-90
- **Leftovers:** Electron click-walk; no vendored shell parser. `autoRun` is honored as hints. Not marked click-walk done.

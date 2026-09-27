---
id: feat-think-handoff
---
# Think → Implement

- **Works:** Think mode is local 2B with packs + `plan_write` (`.think.md` only). Plan mode `rag_write` folder `plans` writes human `RAG/plans/*.md`. Implement follows `RAG/plans/*.think.md` and bumps status to implementing. PlanDoc shows Think chrome. Design create also writes a Think handoff via `designThinkMarkdown`.
- **Made:** [`packages/runtime/src/think.mjs`](../../../packages/runtime/src/think.mjs), `ragWriteRel`, ChatPane / PlanDoc Implement, [`compiler-os.mjs`](../../../packages/runtime/src/compiler-os.mjs) `designThinkMarkdown`.
- **Recipe:** [think-handoff](../../recipes/think-handoff.md) · [compiler-os](../../recipes/compiler-os.md) · AP-20260828-10 · AP-20260828-18 · AP-20260901-44
- **Tests:** T-12 T-20 T-57 T-116
- **Edges:** E-09 E-17 E-51

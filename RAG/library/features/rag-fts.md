---
id: feat-rag-fts
---
# RAG FTS

- **Works:** chunk + FTS over `RAG/*` and code; `data/bug-memory` is kind `anti-pattern` without ingesting secrets; `rag_search` in the kernel; Search pane Memory (FTS) + Workspace (`workspaceGrep` ignore-honoring).
- **Made:** [`packages/rag/src/index.ts`](../../../packages/rag/src/index.ts) `kindFromPath`; [`compiler-os.mjs`](../../../packages/runtime/src/compiler-os.mjs) `ragIngestAllowed`.
- **Recipe:** [skill-cards](../../recipes/skill-cards.md) · [compiler-os](../../recipes/compiler-os.md) · AP-20260905-6 · AP-20260905-10
- **Tests:** T-04 T-58 T-116
- **Edges:** E-52 E-112 E-118

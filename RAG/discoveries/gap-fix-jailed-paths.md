# Discovery — jailed push, plan docs, workspace grep

Plan mode can write human `RAG/plans/*.md` through `rag_write` (`ragWriteRel`). Think artifacts stay `plan_write` → `.think.md` only. Git push is a dedicated IPC with argv `['push']`, never extra remotes from the renderer. Search Workspace tab greps from the workspace root with ignore rules; hits are stripped text. Effort chrome is gone because it never reached llama. See AP-20260901-44.

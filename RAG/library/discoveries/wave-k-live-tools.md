---
id: disc-wave-k-live-tools
date: 2026-08-28
---
# Live tool rows + ff-only pull

- **What:** Forge yields name-only `tool_call` before `runTool`. Git pull argv is fixed `pull --ff-only`.
- **Files:** `activity.mjs` `publicToolCall`, `runForge`, `useWorkbench`, `git-safe.mjs`, GitPane.
- **Do not:** stream tool arguments; `git pull` extra remotes from the renderer.

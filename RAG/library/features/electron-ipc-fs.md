---
id: feat-electron-ipc-fs
---
# Electron IPC filesystem

- **Works:** renderer calls `homeai:fs:*`; main jails paths to the workspace. Pull is `git pull --ff-only` and push is `git push` with no extra argv. mkdir/rename/remove + writes refuse `data/secrets` and `*.key`. `web_search` jails DuckDuckGo via `assertAgentUrl`. Preload `HomeAiApi` includes fleet + `onPtyExit` + `browserConsole`.
- **Made:** [`apps/desktop/src/main/tools.ts`](../../../apps/desktop/src/main/tools.ts) `editablePath` / `readFileSafe` / `assertInside`; [`git-safe.mjs`](../../../packages/runtime/src/git-safe.mjs) `gitPullArgv` / `gitPushArgv`; [`preload/index.ts`](../../../apps/desktop/src/preload/index.ts).
- **Recipe:** [ipc-workspace-fs](../../recipes/ipc-workspace-fs.md) · AP-20260828-1 · AP-20260828-2 · AP-20260901-29 · AP-20260901-44 · AP-20260904-71 · AP-20260904-73
- **Tests:** T-01 T-02 T-16 T-56 T-108 T-109 T-127
- **Edges:** E-01 E-02 E-13 E-33 E-50

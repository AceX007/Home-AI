---
id: disc-wave-d-trust
folder: discoveries
---

# Wave D — git jail, permissions policy, browser_console

- **Task:** Continue after Wave C. Half-wired hang-ons plus IPC hunt.
- **Files:** `packages/runtime/src/paths.mjs`, `policy.mjs`, `git.ts`, `approvals.ts`; GitDensity Stage/Unstage; `browser_console`; `code_outline` ignore; `shell:open` jail.
- **Commands:** `npm test` (node:test + strip-types); `npm run build`; relaunch Electron by PID.
- **Worked:** One `assertInside` for fs + git pathspecs; sanitizers in `.mjs` so `node --test` runs (this Node has no TypeScript strip).
- **Recipes:** [ipc-workspace-fs](../recipes/ipc-workspace-fs.md) · [permissions-policy](../recipes/permissions-policy.md)
- **Anti-patterns:** AP-20260828-2 · AP-20260828-3

---
id: rec-node-inspect
title: Loopback Node Inspector, not a PTY
stack: electron
status: tried
---

# Loopback Node Inspector

## Shape (do this)
- Mechanism: main spawns `node --inspect-brk=127.0.0.1:port` on a jailed script, speaks CDP over `ws://127.0.0.1`, and returns primitive stack/locals.
- Good code shape: `takeDebugLaunch` → `NodeDebugHost.start`; evaluate `takeDebugEval`; stop kills the child only.
- Do not: `node-pty`; public inspect bind; `eval`/`require`/`process` in the watch box; HTML locals.

## Ports (same idea, other systems)
- Web/API: debug proxy with a workspace jail and primitive JSON
- Desktop/IPC: this recipe
- Mobile: stack summaries only
- Worker/CLI: `node --inspect-brk=127.0.0.1:0` under `--root`

## Curiosity (open)
- Why not vscode-js-debug / full DAP? One Inspector session is enough for Node; keep Kernel Workflow on the `debug` tab.
- What breaks at 10x frames? Cap frames/locals; omit objects; 8s inspector timeout.

## Weaknesses / bugs / holes
- Extra-root launch or `0.0.0.0` inspect URL. AP-20260905-23
- Side-effect evaluate (`process.exit()`). Same AP. Catch-retry without `throwOnSideEffect`. AP-20260905-27
- PTY kill on debug stop. T-128 proves spawn is `child_process`.

## Prevent / robust delivery
- Tests: T-128 T-129
- Deny-by-default: launch jail, eval regex, loopback WS only
- Hunt layers: ipc, client

## Refinement log
- 2026-09-05 — Wave 4 host. Worked: inspect-brk loopback, primitive evaluate, Runtime tab distinct from Workflow. Failed: not a DAP adapter; no Chromium/renderer debug. Next: operator click-walk of F9 / Continue / Stop.
- 2026-09-06 — Evaluate guard. Worked: one `evaluateOnCallFrame` with `throwOnSideEffect`. Next: still operator F9 click-walk.

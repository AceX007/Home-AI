---
id: rec-agent-ide
title: LSP DAP git as agent tools
stack: electron
status: tried
---

# LSP DAP git as agent tools

## Shape (do this)
- Mechanism: `lspQuery` on **non-TS** file text; DAP evidence under `data/debug`; git hunks + fan-in; chrome analog names only. TS/JS uses `TsIntelligence` (`ts-intel`).
- Good code shape: `code_outline` → `host.tsIntel` for `.ts`/`.js`, else `lspQuery`; `debug_log` → `takeDapEvidence`; `gitImpactHunks`.
- Do not: IntelliSense theatre; DAP paths with `..`; DesktopCommander tools; Monaco `ts.worker` as the project checker.

## Ports (same idea, other systems)
- Web/API: language-server proxy with workspace jail
- Desktop/IPC: this recipe
- Mobile: evidence summaries only
- Worker/CLI: `--dap-bundle`

## Curiosity (open)
- Why not a full LSP process yet? Agent tools first; Monaco go-to-def can consume the same index later.

## Weaknesses / bugs / holes
- Brace diagnostic is heuristic for non-TS. Full DAP adapter is still off. AP-20260905-8
- Evidence rel strips `../` to `data/debug/x.evidence.json`.
- TS/JS outline now shares `TsIntelligence` with the editor (AP-20260905-22).
- Node Inspector is loopback `child_process`, not vscode-js-debug (AP-20260905-23).

## Prevent / robust delivery
- Tests: T-118 T-126 T-127 T-128 T-129 T-130 T-131
- Deny-by-default: `takeDapEvidence` null on `/etc/` stacks; chrome depth false on commander
- Hunt layers: ipc, client

## Refinement log
- 2026-09-05 — Analog graph. Worked: `git_diff` fan-in from workspace graph callers, not same-file symbols. Failed: no vscode-languageclient / real DAP adapter. Next: feed index into Monaco.
- 2026-09-05 — Wave C continue. Worked: explore `refs` from `parseStructuralIndex`; `test_run` writes DAP evidence. Failed: no vscode-languageclient / real DAP adapter. Next: feed index into Monaco.
- 2026-09-05 — Wave C host. Worked: git_diff parses changed files for fan-in. Failed: no vscode-languageclient. Next: feed index into Monaco.
- 2026-09-05 — Wave C. Worked: outline/refs/diagnostics + jailed evidence + impact hunks. Failed: no vscode-languageclient. Next: feed index into Monaco.
- 2026-09-05 — High-end TS IDE. Worked: `code_outline` uses jailed LanguageService for TS/JS; `lspQuery` stays non-TS fallback. Failed: still no real DAP adapter. Next: Node Inspector, not a second language server.
- 2026-09-05 — Inspector. Worked: `debug_*` tools share `NodeDebugHost`; Runtime tab is not Workflow. Failed: still not vscode-js-debug. Next: operator F9 click-walk.

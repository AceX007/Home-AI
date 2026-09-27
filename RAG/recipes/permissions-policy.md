---
id: rec-permissions-policy
title: Persist allowlists as sanitized policy, not renderer JSON
stack: electron
status: tried
---

# Persist allowlists as sanitized policy

## Shape (do this)
- Mechanism: renderer edits a form; main writes `data/permissions.json` after clamping known fields.
- Good code shape: `clampApprovalMode` + `mapAllowlist(..., sanitizeNetPrefix)` — never `Object.assign` the IPC body.
- Do not: persist `*`, `file:`, or nested objects from the renderer as policy.

## Ports (same idea, other systems)
- Web/API: PATCH `/settings` with an allowlist DTO; ignore unknown keys (mass assignment).
- Desktop/IPC: this recipe (`homeai:permissions:set`)
- Mobile: same DTO through a trusted bridge
- Worker/CLI: flags / file parse with the same sanitizers

## Curiosity (open)
- Why not merge-deep the saved file? Prototype pollution and extra keys become runtime policy.
- What if every net prefix is dropped? Empty list means ask-on-net (allowlist mode), not “open”.
- Analog: IAM policy documents — typed statements, not raw JSON blobs.

## Weaknesses / bugs / holes
- Terminal prefix `*` (AP-20260828-3) auto-allows `decideTool` exec.
- `urlAllowed` used `startsWith` (AP-20260828-4) — now origin + optional path.
- `loadPermissions` still last-file-wins on most fields; instruction pairs pin from workspace `data/permissions.json` (AP-20260904-83).

## Prevent / robust delivery
- Tests: `packages/runtime/src/policy.test.mjs`
- Deny-by-default: unknown `approvalMode` → `allowlist`; drop non-http(s) net; drop shell metacharacters in terminal prefixes; origin-match URLs.
- Hunt layers: ipc, api

## Refinement log
- 2026-08-28 — Wave D `savePermissions`. Worked: sanitizers live in `policy.mjs` so `node --test` runs. Next: origin-parse net prefixes instead of `startsWith`.
- 2026-08-28 — Wave E: `urlAllowed` origin/path. Worked: default `http://127.0.0.1` still allows :8765 (no port on the entry). Next: UI browser navigate stays operator-open; do not fold it into agent net policy.
- 2026-08-28 — Wave G: `toolApprovalDetail`. Worked: search query is no longer treated as a URL. DuckDuckGo is still not in the default net allowlist (ask until added). Next: optional DDG origin if search becomes a first-class default.
- 2026-09-01 — `fsExtraRoots` via `sanitizeExtraRoot` (no `/`, no `$HOME`, no secrets). Extra-root writes Ask even in unrestricted (`extraRootWriteDecision`). DDG origin added to DEFAULT_PERMISSIONS for new installs. Workspace `data/permissions.json` now includes DDG.
- 2026-09-01 — `takePermissionsPatch` on load (not only save) so a hand-edited `/` or `*` cannot skip sanitizers. Next: autoRun/autoReview still last-file-wins raw objects.
- 2026-09-01 — `takeInstructionPair` on load/save: own-key allow/block lines, strip `<>`/newlines, cap 32. Workspace `data/permissions.json` now includes DDG origin. Next: nothing consumes autoRun for allow/deny yet.
- 2026-09-04 — Extra-root tools use `takeFsRootId` (basename), not a renderer path on `PermissionsFile`. `fsExtraRoots` still sanitized on load/save. Next: nothing consumes autoRun for allow/deny yet.
- 2026-09-04 — Auto Review consumes `approvalMode: auto-review` and `autoReview` allow/block via `takeInstructionPair`. `clampApprovalMode` keeps `auto-review`. `autoRun` still unused. Next: optional Telegram `helpCard` mode-aware Trust.
- 2026-09-04 — Save writes `autoReview`/`autoRun` null; `pinWorkspaceInstructions` after overlays so empty Settings Trust cannot resurrect `~/.homeai`. Next: nothing consumes autoRun for allow/deny yet.

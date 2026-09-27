# Stack layers — hunt + prevent

Use after `fingerprint-repo.sh`. Pick the layers that exist. Hunt siblings in each layer, then apply the prevent checklist on every edit that touches it.

## Client (web / renderer)

**Hunt:** user-controlled strings into HTML/markdown/href; auth gated only in UI; state-changing fetches without origin/CSRF tokens; open redirects (`next`, `return`, `url`).

**Prevent:** encode/sanitize at render; never `dangerouslySetInnerHTML` / `innerHTML` with untrusted input; authZ on the server or main process, not only hidden buttons; allowlist redirect targets.

## Desktop IPC (Electron)

**Hunt:** `preload` exposing too much; `ipcMain` handlers that trust renderer args (paths, commands, SQL, URLs); `shell.openExternal` with user URLs; nodeIntegration / missing sandbox.

**Prevent:** contextIsolation + allowlisted IPC channels; validate and constrain paths to the workspace; never pass renderer strings to a shell; treat renderer as untrusted.

## API / auth

**Hunt:** object IDs from the client used without ownership checks; mutations with no auth; mass assignment of role/admin flags; JWT `alg` confusion / unsigned; session not rotated on login.

**Prevent:** deny by default; authorize on every mutation; allowlist writable fields; verify tokens with an explicit algorithm; regenerate session on privilege change.

## Data

**Hunt:** string-built SQL / NoSQL operators from input; migrations that drop/widen without backfill; secrets in `.env` committed, logs, or error dumps.

**Prevent:** parameterized queries / typed query builders; never log tokens; keep secrets out of git (`data/secrets/`, `.env`).

## Async / jobs

**Hunt:** double-submit money or writes; missing idempotency keys; check-then-act races; jobs that trust payload identity without re-authz.

**Prevent:** unique constraints + idempotency keys; single writer per resource or transactional compare-and-set; re-check authZ inside the worker.

## CI / supply chain

**Hunt:** `pull_request_target` with untrusted checkout; unpinned actions (`@main`); secrets in pull-request workflows; workflow_dispatch that runs privileged scripts from PR content.

**Prevent:** pin actions to SHA; least-privilege `permissions:`; never secrets on untrusted PRs.

## How to hunt a layer

1. List entrypoints (routes, IPC, jobs, workflows).
2. For each anti-pattern in memory, grep **siblings** (same helper, other panes, copied handlers).
3. Gate 0, then prevent (test + record).

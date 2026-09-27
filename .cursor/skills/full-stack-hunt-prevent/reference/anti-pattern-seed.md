# Anti-pattern seed (day-one corpus)

Copy into `data/bug-memory/anti-patterns.md` when that file has no `### AP-` records. Do not delete records later agents add.

### AP-SEED-01 — AuthZ on the wrong layer
- Root cause: UI hides an action; server/main still performs it for any caller.
- Bad shape: renderer/button `if (!admin) return`; IPC/API handler has no role/ownership check.
- Good shape: deny by default in the handler; UI is cosmetic.
- Grep / symbols: `ipcMain.handle`, `ipcMain.on`, route handlers, `isAdmin`, `role`
- Regression: unauthenticated or non-owner caller hits the handler and is denied.
- Source: seed

### AP-SEED-02 — IDOR via object id
- Root cause: client-supplied id is trusted as “theirs”.
- Bad shape: `getThing(req.body.id)` with no owner/workspace scope.
- Good shape: load by id **and** `ownerId === session` (or ACL); 404 on miss.
- Grep / symbols: `params.id`, `body.id`, `userId`, `accountId`
- Regression: user A cannot read/mutate user B’s id.
- Source: seed

### AP-SEED-03 — XSS via unsanitized HTML/markdown
- Root cause: user or model text rendered as HTML.
- Bad shape: `dangerouslySetInnerHTML`, `innerHTML =`, markdown without sanitizer.
- Good shape: text nodes / sanitized markdown; never HTML from IPC without a sanitizer.
- Grep / symbols: `dangerouslySetInnerHTML`, `innerHTML`, `markdown`, `rehype`
- Regression: payload string shows as text, not a node.
- Source: seed

### AP-SEED-04 — Path or command injection in main/desktop
- Root cause: renderer-controlled path or shell string.
- Bad shape: `readFile(arg)`, `exec(cmd + arg)` from IPC.
- Good shape: resolve under workspace root; reject `..`; never `exec` with user strings.
- Grep / symbols: `readFile`, `writeFile`, `exec`, `spawn`, `shell.openExternal`
- Regression: `../` and absolute paths outside workspace fail.
- Source: seed

### AP-SEED-05 — Race on non-idempotent writes
- Root cause: check-then-act without a unique constraint or lock.
- Bad shape: `if (!exists) insert()` on concurrent requests.
- Good shape: idempotency key + unique index; transactional upsert.
- Grep / symbols: `INSERT`, `create(`, `setTimeout`, queue consumers
- Regression: two parallel requests produce one row / one side effect.
- Source: seed

### AP-SEED-06 — Secrets in logs or dumps
- Root cause: errors and debug print env, tokens, or request bodies.
- Bad shape: `console.log(process.env)`, dump `Authorization`, write `.env` to disk in-repo.
- Good shape: redact; secrets only in `data/secrets/` or env not committed.
- Grep / symbols: `process.env`, `getKey`, `Authorization`, `.env`
- Regression: error path does not contain token-shaped strings.
- Source: seed

### AP-SEED-07 — CI pull_request_target / unpinned actions
- Root cause: privileged workflow on untrusted PR or floating tag.
- Bad shape: `pull_request_target` + checkout PR ref; `actions/checkout@main`.
- Good shape: pin SHA; no secrets on untrusted code; least `permissions`.
- Grep / symbols: `pull_request_target`, `uses: .*@v`, `uses: .*@main`
- Regression: workflow file review checklist in PR template / this record.
- Source: seed

### AP-SEED-08 — Prototype pollution / unsafe merge
- Root cause: recursive merge of JSON body into objects.
- Bad shape: `Object.assign`, lodash `merge`/`defaultsDeep` on `req.body`.
- Good shape: allowlist keys; `Object.create(null)` maps; no `__proto__`.
- Grep / symbols: `merge(`, `Object.assign`, `defaultsDeep`
- Regression: body `{ "__proto__": { "admin": true } }` does not change Object.prototype.
- Source: seed

### AP-SEED-09 — CSRF-ish state change from renderer
- Root cause: main/API accepts state change with no origin/session binding.
- Bad shape: IPC or cookie-auth POST with no CSRF/origin check from a webview.
- Good shape: IPC is same-app only; cookie mutations need SameSite + token or custom header.
- Grep / symbols: `Set-Cookie`, `fetch(`, `ipcRenderer.invoke`
- Regression: foreign origin cannot trigger the mutation.
- Source: seed

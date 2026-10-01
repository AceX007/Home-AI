# Bug memory — anti-patterns

Living file for skill `full-stack-hunt-prevent`. Append a record after every confirmed finding. Prefer the **good shape** on the next edit.

Seed records below are day-one coverage. Agents add `AP-YYYYMMDD-N` after hunts.

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

### AP-20260828-1 — Electron IPC is the trust boundary (Home AI)
- Root cause: renderer is untrusted; every `homeai:*` handler in main must validate paths and payloads.
- Bad shape: pass renderer-controlled paths or shell strings straight into `fs` / `exec`.
- Good shape: keep `readFileSafe(workspace, path)` / equivalent prefix checks on every new `ipcMain.handle`.
- Grep / symbols: `ipcMain.handle`, `readFileSafe`, `listDir`, `apps/desktop/src/main/index.ts`
- Regression: a handler that accepts `../` or an absolute path outside the workspace is denied.
- Source: dry-run fingerprint 2026-08-28 (electron + vite + react)

### AP-20260828-2 — Git pathspec from renderer (Home AI)
- Root cause: `git add --` still ran on renderer strings; `../` and extra-root abs paths reached git.
- Bad shape: `gitAdd(root, paths)` → `spawn('git', ['add', '--', ...paths])` with no jail.
- Good shape: `gitPathspecs(root, paths)` via `assertInside` (realpath when the file exists); refuse workspace root; argv array, never a shell string.
- Grep / symbols: `gitAdd`, `gitUnstage`, `homeai:git:add`, `packages/runtime/src/paths.mjs`
- Regression: `packages/runtime/src/paths.test.mjs` — `../`, extra-root abs, symlink-out, root pathspec.
- Source: hunt Wave D 2026-08-28

### AP-20260828-3 — Permissions IPC mass-assign (Home AI)
- Root cause: `savePermissions` persisted renderer arrays and nested `autoRun` objects after a shallow trim.
- Bad shape: copy `file.netAllowlist` / `file.autoRun` as given; terminal prefix `*` auto-allows every command.
- Good shape: `clampApprovalMode`; `sanitizeNetPrefix` http(s) only; drop `*` and shell metacharacters from terminal prefixes; MCP `server:tool` shape; instruction lists are string arrays only.
- Grep / symbols: `savePermissions`, `packages/runtime/src/policy.mjs`, `homeai:permissions:set`
- Regression: `packages/runtime/src/policy.test.mjs`
- Source: hunt Wave D 2026-08-28

### AP-20260828-4 — Net allowlist `startsWith` (Home AI)
- Root cause: `urlAllowed` used string prefix, so an allow entry for one host matched a longer hostname.
- Bad shape: `u.startsWith(allowPrefix)`
- Good shape: parse `URL`; same protocol + hostname; port only if the allow entry names one; path prefix slash-bounded.
- Grep / symbols: `urlAllowed`, `packages/runtime/src/policy.mjs`, `decideTool`
- Regression: `packages/runtime/src/policy.test.mjs` — hostname suffix, port, `/v1` vs `/v10`
- Source: hunt Wave E 2026-08-28

### AP-20260828-5 — URL MCP connect without net gate (Home AI)
- Root cause: `McpHub.load` stubbed URL servers; a naive `fetch(spec.url)` would be SSRF from config. `Object.assign` merged `mcpServers` JSON.
- Bad shape: connect any `url`; `Object.assign(mcpServers, json.mcpServers)`; MCP tools gated with `urlAllowed(toolName)`.
- Good shape: `takeMcpServerCfg` own keys; `urlAllowed` before `HttpMcp`; `mcpToolAllowed(server, tool)`; drop `NODE_OPTIONS` / hop-by-hop headers.
- Grep / symbols: `HttpMcp`, `packages/runtime/src/mcp-http.mjs`, `McpHub.load`
- Regression: `packages/runtime/src/mcp-http.test.mjs`
- Source: hunt Wave E 2026-08-28

### AP-20260828-6 — DesignIR patch as untrusted JSON (Home AI)
- Root cause: renderer/agent supply JSON Patch paths; `__proto__` or HTML text would become XSS if the canvas used innerHTML.
- Bad shape: `Object.assign(ir, body)`; `innerHTML = node.text`; pointer walk without blocking `__proto__`.
- Good shape: RFC 6902 ops only under `/nodes|/tokens|/brief|/locks`; reject HTML `<>`; React text nodes; clone then bump `revision`.
- Grep / symbols: `applyDesignPatch`, `packages/runtime/src/designir.mjs`, `homeai:design:patch`
- Regression: `packages/runtime/src/designir.test.mjs`
- Source: hunt Wave F 2026-08-28

### AP-20260828-7 — Approval detail is not the network URL (Home AI)
- Root cause: forge passed `web_search` query text and `browser_click` tool names into `urlAllowed`.
- Bad shape: `detail = call.arguments.query ?? call.name`
- Good shape: `toolApprovalDetail(call, browserCurrentUrl())` — search uses `https://html.duckduckgo.com/html/?q=`; click/type uses the BrowserView URL from main.
- Grep / symbols: `toolApprovalDetail`, `packages/runtime/src/policy.mjs`, `browserCurrentUrl`
- Regression: `packages/runtime/src/policy.test.mjs` `toolApprovalDetail`
- Source: hunt Wave G 2026-08-28

### AP-20260828-8 — Cloud agent id in URL / raw dump (Home AI)
- Root cause: `cursorGet` interpolated renderer `id` into `https://api.cursor.com/v1/agents/${id}` and dumped the JSON body into the chat log.
- Bad shape: `fetch(base + id)`; `JSON.stringify(d)` in the renderer.
- Good shape: `cursorAgentId` allowlist `[\w.-]{1,80}`; `encodeURIComponent`; `cursorJobSummary` only; poll list `{ jobs }`.
- Grep / symbols: `cursorGetUrl`, `cursorJobSummary`, `packages/runtime/src/cursor-jobs.mjs`, `homeai:cursor:get`
- Regression: `packages/runtime/src/cursor-jobs.test.mjs`
- Source: hunt Wave H 2026-08-28

### AP-20260828-9 — DTCG ingest as mass-assign + remote $value (Home AI)
- Root cause: token JSON from disk or the agent could write `__proto__`, CSS `url()`, or an http `$value` if ingest copied the file into `tokens`.
- Bad shape: `Object.assign(ir.tokens, parsed)`; `fetch($value)` for aliases.
- Good shape: `designTokenRel` under `designs/*.json`; flatten own keys; map allowlisted IR fields; hex/number only; skip `https://`; hex colors in `validateDesignIR`.
- Grep / symbols: `applyDtcgToIr`, `designTokenRel`, `packages/runtime/src/dtcg.mjs`
- Regression: `packages/runtime/src/dtcg.test.mjs`, `designir.test.mjs` color token
- Source: hunt Wave H 2026-08-28

### AP-20260828-10 — Think artifact path + cloud dump (Home AI)
- Root cause: a think/implement split that wrote product files from the 2B, or sent `@Terminals`/`@Chats` and key-shaped strings to the cloud implementer.
- Bad shape: plan mode with `terminal_run`; Implement = re-run the chat; `Object.assign` the think JSON.
- Good shape: Think allowlist + `plan_write` → `RAG/plans/*.think.md` only; validate headings/files/no HTML; Implement loads that path via `assertInside`; `redactCloudText`; skip chat/terminal blobs.
- Grep / symbols: `plan_write`, `thinkRel`, `loadThinkDoc`, `redactCloudText`, `THINK_TOOLS`
- Regression: `packages/runtime/src/think.test.mjs`
- Source: hunt Think mode 2026-08-28

### AP-20260828-11 — Activity fold labels as HTML (Home AI)
- Root cause: grouping tool captions and user lines into “Ran N commands” headers would XSS if rendered as HTML, or if `<>` survived.
- Bad shape: `dangerouslySetInnerHTML` / string-built markup; import `@homeai/runtime` barrel into the renderer (pulls `node:fs`).
- Good shape: `stripActivityText` then React text nodes; import `activity.mjs` only from the renderer; cloud ids still go through `cursorJobs`.
- Grep / symbols: `groupActivity`, `stripActivityText`, `sessionPreview`, ChatPane `ActivityLine`
- Regression: `packages/runtime/src/activity.test.mjs`
- Source: hunt Wave J 2026-08-28

### AP-20260828-12 — DesignIR style map / Code-tab CSS (Home AI)
- Root cause: inspector and Code tab supply CSS-like maps; `url()`, HTML, or `__proto__` would become XSS or pollution if compiled blindly.
- Bad shape: `element.style.cssText = node.style`; `innerHTML` of a style string; `Object.assign(node.style, body)`.
- Good shape: `takeStyleMap` / `parseCssDeclarations` — allowlisted keys, hex/rgb/enum values, React `style` object, no `url()`.
- Grep / symbols: `takeStyleMap`, `parseCssDeclarations`, `packages/runtime/src/design-style.mjs`, `Inspector` Code tab
- Regression: `packages/runtime/src/design-style.test.mjs`
- Source: Code/Design studio 2026-08-28

### AP-20260828-13 — Tool call arguments streamed to the renderer (Home AI)
- Root cause: re-yielding LLM `tool_call` would send `arguments` (paths, commands, tokens) into the Agents log.
- Bad shape: `yield chunk` of the raw tool_call; `JSON.stringify(call.arguments)` in lastTrace.
- Good shape: `publicToolCall` — allowlisted name, empty `arguments`; renderer `toolCallName` then a `running` row until ok/err.
- Grep / symbols: `publicToolCall`, `toolCallName`, `runForge`, `useWorkbench` `tool_call`
- Regression: `packages/runtime/src/activity.test.mjs` public tool_call
- Source: hunt Wave K 2026-08-28

### AP-20260828-14 — Git pull extra argv from the renderer (Home AI)
- Root cause: a Pull button that forwarded remote/ref strings would become `git pull origin --rebase` (or worse) via spawn argv.
- Bad shape: `spawn('git', ['pull', ...rendererArgs])`; shell string pull.
- Good shape: `gitPullArgv()` is exactly `['pull', '--ff-only']`; IPC handler ignores extra arguments; output sliced.
- Grep / symbols: `gitPullArgv`, `gitPullFfOnly`, `homeai:git:pull`
- Regression: `packages/runtime/src/git-safe.test.mjs`
- Source: hunt Wave K 2026-08-28

### AP-20260828-15 — Design overlay drafts / comment pins (Home AI)
- Root cause: live canvas overlays skip IPC `takeStyleMap`; comment text is stored then painted. Switching nodes used to drop other drafts. `__proto__` keys or `<>` in pin text would XSS or pollute if compiled/rendered raw.
- Bad shape: one `draft` field; `Object.assign(nodes, drafts)`; `innerHTML` / `cssText` of overlay styles; pin labels from raw comment strings.
- Good shape: `overlayDrafts` + `opsForDrafts` (own names, known node ids, cap 32); `compileReactStyle` via `takeStyleValue`; `canvasPins` strips `<>`; IR `takeComment` rejects HTML; Pin strips `<>` before `design_patch`.
- Grep / symbols: `overlayDrafts`, `opsForDrafts`, `canvasPins`, `compileReactStyle`, `PhoneCanvas` pins
- Regression: `packages/runtime/src/design-draft.test.mjs`, `design-style.test.mjs` compileReactStyle
- Source: Code/Design studio continue 2026-08-28

### AP-20260828-16 — Design token ingest path from the renderer (Home AI)
- Root cause: `homeai:design:ingestTokens` reads a file then writes DesignIR. A renderer-supplied path would be path traversal if main trusted it.
- Bad shape: `designIngestTokens(userTypedPath)`; `readFile(path from IPC)` without jail.
- Good shape: renderer calls `designIngestTokens()` with no path; main `designTokenRel` defaults to `designs/tokens.json` and rejects `..`.
- Grep / symbols: `designTokenRel`, `ingestDesignTokens`, `homeai:design:ingestTokens`, DesignStudio `ingestTokens`
- Regression: `packages/runtime/src/dtcg.test.mjs` path jail
- Source: Code/Design studio continue 2026-08-28

### AP-20260828-17 — Overlay drafts must sanitize style before merge (Home AI)
- Root cause: live overlay copied whole draft nodes, so `url()` could sit in memory until Save even if paint skipped it.
- Bad shape: `nodes[id] = draft`; `fieldOp(..., draft.style)` unsanitized; DesignEditor `{ ...nodes, [sel]: draft }` after `overlayDrafts`.
- Good shape: `softStyle` / `takeStyleValue` in `overlayDrafts`, `opsForDrafts`, `sanitizeDraft`, `cloneOverlay`; canvas uses overlay-merged doc only; drop unknown keys; nested `layerRows` own-key + cycle cap.
- Grep / symbols: `overlayDrafts`, `softStyle`, `sanitizeDraft`, `cloneOverlay`, `layerRows`, `opsForDrafts`, `DesignStudio` `onDraft`
- Regression: `packages/runtime/src/design-draft.test.mjs` unsafe overlay styles / layer rows
- Source: Code/Design studio follow-up 2026-08-28

### AP-20260828-18 — Think status bump as a whole-file write (Home AI)
- Root cause: Implement could rewrite the think artifact (or skip the status line) and let the renderer set arbitrary YAML.
- Bad shape: renderer `write(thinkPath, md)`; `status: ${userString}`; bump `think` → `done`.
- Good shape: `bumpThinkStatus` only `ready`→`implementing` (idempotent); re-validate; `writeFileSafe` of `RAG/plans/*.think.md` from main after `loadThinkDoc`.
- Grep / symbols: `bumpThinkStatus`, `thinkRelFromOpen`, `runAgent` thinkPath
- Regression: `packages/runtime/src/think.test.mjs` bump
- Source: hunt Wave L 2026-08-28

### AP-20260828-19 — Telegram authZ in the handler
- Root cause: a public bot token plus a pairing UI that is only cosmetic would let any Telegram user drive `runForge`.
- Bad shape: hide Pair in Settings; accept any `from.id`; log the pair code or bot token.
- Good shape: `isPeer` on every update and callback; SHA-256 pair code, 10 min, one-shot; private chats only; token in `data/secrets/telegram.key`.
- Grep / symbols: `routeTelegram`, `isPeer`, `consumePair`, `telegram-bridge`
- Regression: `packages/runtime/src/telegram-auth.test.mjs`, `telegram-router.test.mjs`
- Source: telegram bridge 2026-08-28

### AP-20260828-20 — Telegram job/thread/knowledge ids
- Root cause: callback `data` or `/use` text interpolated as a thread or file path.
- Bad shape: `getThread(req.id)`; `RAG/skills/${user}` without slug jail.
- Good shape: `chatThreadId` / `jobRunId` / `knowledgeSlug`; skills only under `RAG/skills/<slug>/SKILL.md`.
- Grep / symbols: `chatThreadId`, `parseCallback`, `skillRel`, `writeSkill`
- Regression: `packages/runtime/src/conversations.test.mjs`, `knowledge-write.test.mjs`, `telegram-router.test.mjs`
- Source: telegram bridge 2026-08-28

### AP-20260828-23 — Telegram glass chrome is not HTML
- Root cause: a “premium” bot look tempts `parse_mode: HTML` or MarkdownV2 on model text; callback labels interpolated from titles.
- Bad shape: `sendMessage({ parse_mode: 'HTML', text: model })`; `callback_data: 'run:' + userTitle`.
- Good shape: plain-text HOME console (`formatConsole`); `stripParseMode` on every send/edit; `safeCallbackId`; dock words allowlisted (`dockKind`).
- Grep / symbols: `parse_mode`, `formatConsole`, `stripParseMode`, `dockKind`, `jobMarkup`
- Regression: `packages/runtime/src/telegram-chrome.test.mjs`, `telegram-progress.test.mjs`
- Source: telegram glass console 2026-08-28

### AP-20260828-22 — Group membership is not authorization
- Root cause: a group/supergroup chat id or `chat.type` looks like “we were added, so anyone here may drive the kernel.”
- Bad shape: `if (chat.type !== 'private') allow`; `telegramUserId(chat.id)` (drops negatives, so groups never bind); `/pair` in a group; free text from any member becomes `chatLog`.
- Good shape: AuthZ is `isPeer(from.id)` in every room. `telegramChatId` accepts signed Telegram ids. `/pair` only in private. Group free text needs a command, `@bot`, or a reply to the bot. Group threads never steal Home.
- Grep / symbols: `telegramChatId`, `isTelegramGroupChat`, `groupAddressed`, `pair-dm`, `threadForTelegram`
- Regression: `packages/runtime/src/telegram-router.test.mjs`, `conversations.test.mjs`
- Source: telegram group+DM surface 2026-08-28

### AP-20260828-21 — Telegram tool/MCP inventory is a public DTO
- Root cause: listing “all PC tools + MCPs” on the phone would leak MCP URLs, headers, or a reduced agent if headless never booted.
- Bad shape: dump `mcp.list()` including `url`; Telegram `/do` with `mcpTools=[]` because only `homeai:boot` loaded MCP; think-mode MCP on the 2B.
- Good shape: `ensureKernelReady` on `whenReady` and every `startKernelJob`; `toolsForMode` (agent/debug/multitask = builtins+MCP); `mcpPublicRows` strips URLs; `/tools` `/mcp` after `isPeer`.
- Grep / symbols: `toolsForMode`, `mcpPublicRows`, `formatToolSurface`, `ensureKernelReady`, `/tools`
- Regression: `packages/runtime/src/tool-surface.test.mjs`, `telegram-router.test.mjs`
- Source: telegram full tool/MCP parity 2026-08-28

### AP-20260828-24 — Mini App /api is not a public SPA
- Root cause: a Telegram Web App ships `/api` in the JS bundle; a tunneled `127.0.0.1` listener looks like loopback from the tunnel process, so a loopback session bypass would drive `runForge` without HMAC.
- Bad shape: bind `0.0.0.0`; trust empty `initData` because `remoteAddress` is loopback; take `threadId`/`runId` from the body; `innerHTML` of Pulse cards; `setChatMenuButton` with a raw profile URL.
- Good shape: listen `127.0.0.1` only; `validateTelegramInitData` + `isPeer`; invalid initData is deny; loopback preview only when `miniAppUrl` is empty; `takeMiniBody` / `jobRunId`; `pushMiniChunk` via `publicToolCall` and only for remembered runs; `takeMiniAppUrl` + `miniMenuButton` jail.
- Grep / symbols: `validateTelegramInitData`, `takeMiniBody`, `takeMiniAppUrl`, `createMiniAppServer`, `pushMiniChunk`, `miniMenuButton`
- Regression: `packages/runtime/src/telegram-initdata.test.mjs`, `miniapp-hub.test.mjs`
- Source: telegram Mini App 2026-08-28

### AP-20260828-25 — Inbox drop is a file-upload jail
- Root cause: a Mini App / composer drop that writes `data/inbox/` from a filename + base64 would accept SVG/HTML/PHP or `../` if the handler only sanitized word characters.
- Bad shape: `writeFile(join(inbox, Date.now() + '-' + userName), Buffer.from(base64))` with no size, magic, or ext allowlist.
- Good shape: `saveInboxSafe` — ext allowlist, 2 MB cap, magic bytes (or text without markup), `assertInside` `data/inbox/<ts>-<name>`; SVG never.
- Grep / symbols: `saveInboxSafe`, `inboxMatches`, `takeInboxFile`, `homeai:inbox:save`, Mini App `inbox`
- Regression: `packages/runtime/src/inbox.test.mjs`
### AP-20260829-26 — Selection export and handle layout are untrusted (Home AI)
- Root cause: PNG/SVG export and live resize write node text and CSS into canvas/SVG/layout. Raw `url()`, `<>`, or unknown layout keys would leak into files or the overlay.
- Bad shape: `fillStyle = node.style.background`; SVG string interpolate `node.text`; `Object.assign(layout, e.target.dataset)`.
- Good shape: `exportFrame` / `safeMarkText` / `safeHex` / `exportSvgString` XML-escape; `applyHandleDelta` copies known layout keys then `takeLayout`; handles clamp 8–4000; offX/offY −4000…4000.
- Grep / symbols: `exportFrame`, `exportSvgString`, `applyHandleDelta`, `offX`, `DesignStudio` `exportMark`
- Regression: `packages/runtime/src/design-export.test.mjs`
- Source: Code/Design studio design pass 2026-08-29

### AP-20260829-27 — Telegram mind / Cursor / llama is a public DTO
- Root cause: phone and Mini App must pick offline 2B vs Cursor Cloud Agents. A raw provider string, Cursor API body, llama model path, or `file_path` from `getFile` would leak keys or write outside `data/inbox`.
- Bad shape: `defaultProvider` from the request; `sendChunk(error, err.message)` with `Model missing: /home/...`; dump `cursorLaunchAgent` JSON; `writeFile(file_path)`; `/mind` with any string.
- Good shape: `takeMind` allowlist (strings only); `pickForgeProvider` (think + implement never Cursor); `takeKernelHealth` / `healthPulse` booleans + jailed jobs; `publicMindError`; `telegramFileId` / `telegramFilePath` + `saveInboxSafe`; Cursor poll via `cursorJobSummary` only.
- Grep / symbols: `takeMind`, `pickForgeProvider`, `takeKernelHealth`, `publicMindError`, `telegramFilePath`, `runCursorCloudJob`
- Regression: `packages/runtime/src/mind.test.mjs`, `telegram-router.test.mjs`, `telegram-api.test.mjs`, `telegram-initdata.test.mjs`
- Source: telegram enterprise mind 2026-08-29

### AP-20260901-28 — Telegram session DTO is public to the IDE
- Root cause: a workbench pane that “manages the bot session” would dump `telegram.key`, pairing hashes, or raw Cursor job JSON if IPC returned the store as-is.
- Bad shape: `ipcMain.handle('homeai:telegram:session', () => readFile(state.json))`; show `pairing.hash`; interpolate peer titles into callback ids.
- Good shape: `takeTelegramSession` — booleans, peer ids, pairing `exp` only, jailed live/thread ids, no token/hash; `/manage` and the IDE pane share that DTO; `telegramUserId` on unpair; `jobRunId` on halt.
- Grep / symbols: `takeTelegramSession`, `homeai:telegram:session`, `manageCard`, `TelegramPane`
- Regression: `packages/runtime/src/telegram-session.test.mjs`, `telegram-chrome.test.mjs`, `telegram-router.test.mjs`
- Source: telegram manage + IDE session 2026-09-01

### AP-20260901-30 — Design identity is a slug, not a path (Home AI)
- Root cause: create/list/get/patch of DesignIR from the renderer or agent `id` would be path traversal if main joined a user-supplied path under `designs/`.
- Bad shape: `loadDesign(root, userPath)`; `join(root, args.path)`; `designCreate({ path: '../secrets.json' })`.
- Good shape: `designSlug` `^[\w.-]{1,40}$` + block `__proto__`/`..`/`/`; `designRel` → `designs/<slug>.design.json`; `assertInside`; renderer/agent pass slug only; create has no path argument.
- Grep / symbols: `designSlug`, `designRel`, `createDesign`, `listDesigns`, `loadDesign`, `homeai:design:create`
- Regression: `packages/runtime/src/design-path.test.mjs`
- Source: Code/Design generate loop 2026-09-01

### AP-20260901-33 — Session chrome titles and links are text, not HTML (Home AI)
- Root cause: rename, copy-link, Hunt/Verify names, and project tags would XSS if the Agents chrome rendered markup or interpolated a raw thread id into a URL.
- Bad shape: `renameThread(id, req.title)`; `clipboard.writeText('homeai://chat/' + id)`; `innerHTML` of session rows; Hunt labels from raw tool names.
- Good shape: `sessionTitle` / `stripActivityText`; `chatLink` allowlisted id only; `splitHuntVerify` uses `toolCallName`; `renameThread` already strips; React text nodes.
- Grep / symbols: `sessionTitle`, `chatLink`, `filterTranscript`, `splitHuntVerify`, `renameChat`, `ChatPane`
- Regression: `packages/runtime/src/activity.test.mjs`, `packages/runtime/src/conversations.test.mjs`
- Source: Code/Design 01–13 chrome 2026-09-01

### AP-20260901-34 — Live Design reload keeps focus; page names are not HTML (Home AI)
- Root cause: polling `design_get` used to reset page/selection every tick, and `/pages` patches could carry HTML names onto the filmstrip.
- Bad shape: `setPage(doc.pages[0])` on every ingest; `next.pages = patch.value`; filmstrip `innerHTML` of `page.name`.
- Good shape: `keepCanvasFocus` + `pruneOverlay`; `takePage`/`takePages` strip `<>`; skip same revision; do not dirty-gate agent growth.
- Grep / symbols: `keepCanvasFocus`, `pruneOverlay`, `takePage`, `ingestRemote`, `DesignStudio`
- Regression: `packages/runtime/src/design-draft.test.mjs`, `packages/runtime/src/designir.test.mjs`
- Source: generate-loop live reload 2026-09-01

### AP-20260901-29 — Workbench chrome and layout are public DTOs
- Root cause: a “high-end IDE” titlebar that shows llama/keys/jobs, or a layout file that restores tabs, would leak `telegram.key`, MCP URLs, or extra-root paths if main persisted renderer JSON or dumped `mcp.list()`.
- Bad shape: `layoutSet(req.body)`; `pulse = { ...llama.status, ...mcp.list() }`; `writeFile(userPath)`; titlebar `dangerouslySetInnerHTML`.
- Good shape: `takeLayout` / `takeChromePulse` / `takePortList` / `takeWorkspaceRel`; layout always `data/workbench.json`; explorer ops through `editablePath`; pulse is booleans + counts + allowlisted strings; React text nodes.
- Grep / symbols: `takeLayout`, `takeChromePulse`, `editablePath`, `homeai:kernel:pulse`, `homeai:workbench:layout`, `homeai:fs:mkdir`
- Regression: `packages/runtime/src/workbench-chrome.test.mjs`
- Source: IDE chrome enhance 2026-09-01

### AP-20260901-31 — Layout regime is an allowlist (Home AI)
- Root cause: Stage/Focus CSS is driven by persisted `layoutMode` / `density`. An unknown string from renderer JSON would become a class or attribute injection if interpolated unsanitized.
- Bad shape: `data-layout={req.layoutMode}`; `chatW: Number(raw.chatW)` with no cap.
- Good shape: `takeLayoutMode` / `takeDensity`; stage chatW cap 2400, else 720; React `data-layout` only after takeLayout.
- Grep / symbols: `takeLayout`, `layoutMode`, `density`, `homeai:workbench:layout`
- Regression: `packages/runtime/src/workbench-chrome.test.mjs` layoutMode
- Source: hunt Agents Stage 2026-09-01

### AP-20260901-32 — Review hunks and session filter are text (Home AI)
- Root cause: Agent Review dumps model text; a hunk list that opened `../` paths or rendered `<>` would XSS or escape the workspace if the renderer trusted the line.
- Bad shape: `dangerouslySetInnerHTML` of review text; `openFile(workspace + hunk)`; session filter as HTML.
- Good shape: `parseReviewHunks` strips `<>`, rejects `..` and abs paths; filter replaces `<>`; IPC `openFile` still jails.
- Grep / symbols: `parseReviewHunks`, `sess-filter`, ChatPane review-hunk
- Regression: `packages/runtime/src/activity.test.mjs` compact density / review hunks
- Source: hunt Agents Stage 2026-09-01

### AP-20260901-35 — Index capture names are text (Home AI)
- Root cause: Settings Index lists `browser/captures` filenames from `homeai.list`. Markup in a title-derived name would XSS if painted as HTML.
- Bad shape: `innerHTML` of capture filenames; joining user titles into a path for `openFile` without jail.
- Good shape: `list` still workspace-jailed; names `replace(/[<>]/g)` + slice 80; React text nodes; no Instant Grep.
- Grep / symbols: `CaptureList`, `browser/captures`, `rag.stats` lastIngest
- Regression: `packages/runtime/src/activity.test.mjs` `stripActivityText` on names
- Source: hunt Agents Stage Index card 2026-09-01

### AP-20260901-36 — Code/Design chrome route and share links stay jailed (Home AI)
- Root cause: Chat and Code pills both used `activity !== 'design'`, so both looked active; Design Share interpolated a raw slug; layer tree painted node.text.
- Bad shape: `className={activity !== 'design'}`; `homeai://design/${slug}`; `innerHTML` of layer labels.
- Good shape: `chromeRoute(activity, cowork)` exclusive; Share uses `designSlug`; layer labels `stripActivityText`; Hunt/Verify via `splitHuntVerify` + `phasePips`.
- Grep / symbols: `chromeRoute`, `phasePips`, `designSlug`, `LayerTree`, ChatPane sess-pills
- Regression: `packages/runtime/src/activity.test.mjs` chromeRoute / phasePips
- Source: Code/Design bible 01–27 continue 2026-09-01

### AP-20260901-38 — chromeRoute is layoutMode; pinned chat ids are jailed (Home AI)
- Root cause: a Cowork boolean on the renderer, or raw session ids in `data/workbench.json`, would mark every pill active or persist `../` / markup as a chat id.
- Bad shape: `chromeRoute(activity, cowork)` interpolating a raw string into a class; `pinnedChats: req.body`; `className={activity !== 'design'}`.
- Good shape: `takeChatId` / `takePinnedChats` still jail ids (this record). Pill exclusivity is AP-20260901-42 (`cowork === true` → `design|cowork|code`); do not pass layoutMode into `chromeRoute`.
- Grep / symbols: `chromeRoute`, `takePinnedChats`, `StagePills`, `pinnedChats`
- Regression: `packages/runtime/src/activity.test.mjs` chromeRoute, `packages/runtime/src/workbench-chrome.test.mjs` pinnedChats
- Source: hunt Agents Stage Wave R 2026-09-01

### AP-20260901-39 — Think done only after a forge with no error chunks (Home AI)
- Root cause: Implement always bumped `implementing` → `done` after the generator finished, including when a chunk was `type: error`.
- Bad shape: `for await (chunk of gen) send(chunk); bumpThinkStatus(md, 'done')`.
- Good shape: `shouldCloseThink(hadError === false)`; `chunkIsForgeError`; stay implementing on error; PlanDoc Built only when status is done.
- Grep / symbols: `shouldCloseThink`, `chunkIsForgeError`, `bumpThinkStatus`, `startKernelJob`
- Regression: `packages/runtime/src/think.test.mjs` shouldCloseThink
- Source: hunt Think handoff Wave R 2026-09-01

### AP-20260901-42 — chromeRoute cowork is boolean true; layoutMode strings are Code (Home AI)
- Root cause: Wave R passed `layoutMode` as the second argument. Any non-empty string is truthy, so `if (cowork) return 'cowork'` marked Stage/Focus as Chat and Cowork, or the helper was rewritten to `chat|stage|focus|design` and the bible pills disappeared.
- Bad shape: `chromeRoute(activity, layoutMode)`; `if (cowork) return 'cowork'` on a string; Stage as a fourth pill; Background `laneBuckets` Running/Done/Error as the product chrome.
- Good shape: `chromeRoute(activity, cowork)` with `cowork === true` only → `design|cowork|code`; Stage is kebab Open in → Agents Stage; Hunt/Verify from `splitHuntVerify`; Effort 6 dots UI-only.
- Grep / symbols: `chromeRoute`, `StagePills`, `splitHuntVerify`, `takeEffort`, `EFFORT_LABELS`
- Regression: `packages/runtime/src/activity.test.mjs` T-46, `packages/runtime/src/stage-chrome.test.mjs`
- Source: Code/Design remaining-gaps bible re-lock 2026-09-01

### AP-20260901-43 — Design generate is a two-tool loop; `/pages/-` must append (Home AI)
- Root cause: `runForge` told every agent to start with explore, so Local 2B wrote a story instead of `design_patch`. Qwen XML/✿ calls were dropped. RFC 6902 `add /pages/-` wrote `pages['-']` and `irGrew` stayed false.
- Bad shape: full tool list + "Start by gathering (explore)"; parse only `<tool_call>{json}</tool_call>`; `parent['-'] = value` on the pages array.
- Good shape: `toolsForDesign` is `design_get`/`design_patch` only; `forgeActHint` + system suffix; `parseQwenToolCalls` XML/✿/bare JSON; `add` + `last === '-'` → `Array.push`; remint still `forgeForDesign`.
- Grep / symbols: `toolsForDesign`, `forgeActHint`, `parseQwenToolCalls`, `designTask`, `applyOp`
- Regression: `packages/runtime/src/design-generate.test.mjs` T-55, `designir.test.mjs` `/pages/-`, `tool-surface.test.mjs`, `mind.test.mjs`
- Source: Code/Design remaining-gaps prove generate 2026-09-01

### AP-20260901-40 — Phone Stage/Trust chrome is allowlisted text, not HTML
- Root cause: a desk-matching Stage/Trust bot UI would interpolate forge titles, think names, or Hunt labels into `parse_mode` HTML or unjailed `callback_data`.
- Bad shape: `sendMessage({ parse_mode: 'HTML', text: stageCard })`; `callback_data: 'stage:' + title`; Glance `innerHTML` of think status; Trust claiming Landlock.
- Good shape: `stageCard` via `formatConsole` / `plainLine`; `/stage` + dock Stage/`takeNav('stage')`; Trust dock → `manage`; `nav:go:stage` / `nav:go:manage` only; Mini App Stage sheet `textContent`; Trust line `Local 2B · Ask · no Landlock`.
- Grep / symbols: `stageCard`, `takeNav`, `dockKind`, `nav:go:stage`, `progressCard`, Glance/`stage` in `apps/miniapp/app.js`
- Regression: `packages/runtime/src/telegram-chrome.test.mjs` stageCard, `telegram-router.test.mjs` `/stage`
- Source: hunt Telegram Stage wave 2026-09-01

### AP-20260901-41 — Go strip skill/tool peeks are jailed text, not HTML
- Root cause: a simple chat/mode/tools/skills switcher would interpolate skill names, MCP tool names, or session titles into HTML, or map unknown dock words into callbacks.
- Bad shape: `innerHTML` of skill description; composer insert of raw `skill.slash`; dock `Skills` without `NAV_OK`; Mini App `action: 'skills'` missing from `takeMiniBody`.
- Good shape: `takeGoTab` session|mode|stack|skills; `publicSkillPeek` `\w.-` slash + `stripActivityText`; `publicStackPeek` only when `toolCallName(raw) === raw.trim()`; Telegram dock New/Skills + `takeNav('skills')`; Mini App `skills` action + `textContent` sheet.
- Grep / symbols: `takeGoTab`, `publicSkillPeek`, `publicStackPeek`, `StageGo`, `dockKind`, `nav:go:skills`, `takeMiniBody` skills
- Regression: `packages/runtime/src/stage-chrome.test.mjs` Go strip peeks; `telegram-chrome.test.mjs` New/Skills; `telegram-initdata.test.mjs` skills action
- Source: hunt Agents Stage Wave T 2026-09-01

### AP-20260901-37 — Design generate never takes the Cursor job short-circuit (Home AI)
- Root cause: `pickForgeProvider` returns `cursor` when a Cursor key exists, and `startKernelJob` then calls `runCursorCloudJob`. Cloud Agents never invoke `design_get`/`design_patch`, so Design create seeded two empty screens and the canvas never grew.
- Bad shape: `if (forge === 'cursor') runCursorCloudJob` on a task that mentions `design_patch`; Design Home Model `cloud` → openrouter with Cursor still selected from Chat.
- Good shape: `taskNeedsDesignTools` + `forgeForDesign` remint cursor→openai/openrouter/local; force `agent` mode; stream `DesignIR needs tools — not Cursor Cloud Agents`; Design Home picker is Local 2B / OpenAI / OpenRouter only.
- Grep / symbols: `forgeForDesign`, `taskNeedsDesignTools`, `designMind`, `kickDesign`, `startKernelJob`
- Regression: `packages/runtime/src/mind.test.mjs` T-47, `packages/runtime/src/tool-surface.test.mjs`
- Source: E2E Code/Design local 2B + cloud tool loop 2026-09-01

### AP-20260901-44 — Git push, plan writes, and Search grep are dedicated jails (Home AI)
- Root cause: renderer/agent could have passed extra git remotes/refs; Plan mode advertised `RAG/plans/*.md` while `rag_write` omitted `plans`; Search pane was FTS-only so operators grepped by dumping into the model; Effort dots were UI-only.
- Bad shape: `git push` on the terminal allowlist; `rag_write` writing `.think.md`; Search hits as HTML; Effort slider with no llama mapping.
- Good shape: `gitPushArgv()` is `['push']` only via `homeai:git:push`; `ragWriteRel('plans')` → `RAG/plans/<base>.md` never `.think.md`; `workspaceGrep` + `publicGrepHits` + `takeGrepQuery`; Models picker without Effort chrome.
- Grep / symbols: `gitPushArgv`, `gitPushUpstream`, `ragWriteRel`, `workspaceGrep`, `compileGrepRe`, `publicGrepHits`, `takeHitRel`, `skipSkillFile`, `parseLibraryStatus`
- Regression: `packages/runtime/src/git-safe.test.mjs`, `knowledge-write.test.mjs`, `search-proof.test.mjs`, `tool-surface.test.mjs` plan `rag_write`
- Source: hunt-idor / hunt-xss / hunt-llm-ai gap-fix 2026-09-01

### AP-20260901-45 — Cowork persist and editor crumbs are jailed text
- Root cause: Stage pills used a renderer-only `cowork` boolean, and a breadcrumb bar would paint `../` or `<>` if it split a raw absolute path.
- Bad shape: `cowork` missing from `takeLayout`; crumbs from `activePath.split('/')` with `innerHTML`; pill click forces `layoutMode: 'dock'`.
- Good shape: `takeCowork` is `true`/`false` only; persist `cowork` on `data/workbench.json`; `takeCrumbs` via `takeWorkspaceRel` + `stripActivityText`; React text nodes; pills keep the current layout.
- Grep / symbols: `takeCowork`, `takeCrumbs`, `persistWorkbenchLayout`, `editor-crumbs`, `StagePills`
- Regression: `packages/runtime/src/workbench-chrome.test.mjs` cowork / crumbs
- Source: IDE UX refine 2026-09-01

### AP-20260901-46 — Local 2B design_patch is truncated JSON / loose nodes, not a pretty RFC envelope (Home AI)
- Root cause: llama `-c 2048` plus pretty 16k `design_get` left no room to finish `tool_calls.arguments`. JSON.parse failed → empty patch. When JSON did parse, 2B emitted node maps or `/pages/-` values with extra fields (`type`, `text`) and `takePage` threw `page field`.
- Bad shape: `JSON.parse(arguments) || {}`; `Array.isArray(a.patch) ? a.patch : []`; pretty `JSON.stringify(doc, null, 2).slice(0, 16000)` as the tool result; IPC accepting `_raw`.
- Good shape: compact `designGetContent`; `parseToolArguments` recovers complete objects from a cut-off stream; `coerceDesignOps` wraps loose nodes and strips extra page/node fields; `applyOp` still deny-by-default; `publicDesignEnvelope` drops `_raw`/`ops` on `homeai:design:patch`.
- Grep / symbols: `parseToolArguments`, `coerceDesignOps`, `designGetContent`, `publicDesignEnvelope`, `sanitizeRfcValue`
- Regression: `packages/runtime/src/design-generate.test.mjs` T-55/T-61, `designir.test.mjs` publicDesignEnvelope
- Source: remaining-gaps live prove 2026-09-01

### AP-20260901-47 — Parent 2B must not receive the full MCP schema dump
- Root cause: `toolsForMode` concatenated every MCP tool into Agent, so a 2B failed tool selection.
- Bad shape: `return [...builtin, ...mcp]` on every agent turn.
- Good shape: `detectToolPacks` + `filterToolsByPack`; MCP only when pack `mcp-domain`; MCP schemas shrink to name + one-line (`shrinkToolDef`, cap 24); keep `/pack` on the task string (do not treat it as a skill consume).
- Grep / symbols: `detectToolPacks`, `toolsForMode`, `mcp-domain`, `shrinkToolDef`
- Regression: `packages/runtime/src/tool-surface.test.mjs` default agent drops MCP
- Source: Home OS tool kit 2026-09-01

### AP-20260901-48 — compute_run is a timeout + path jail, not a VM
- Root cause: operators might treat `compute_run` as Landlock and skip approvals.
- Bad shape: `terminal_run python -c` on the allowlist; unbounded `while True`.
- Good shape: script under `data/compute/runs/` via `assertInside`; timeout; no-net preamble (`os.system` / `subprocess` / `urllib` / `fetch` denied); do not claim seccomp.
- Grep / symbols: `runCompute`, `computeScriptRel`
- Regression: `packages/runtime/src/compute.test.mjs`
- Source: Home OS tool kit 2026-09-01

### AP-20260901-49 — Extra-root list is sanitized; unrestricted still cannot skip the jail
- Root cause: a Home OS extra-root field would accept `/` or `$HOME` if saved as raw renderer strings.
- Bad shape: `Object.assign` `fsExtraRoots`; `assertInside` bypass when `approvalMode === 'unrestricted'`.
- Good shape: `sanitizeExtraRoot` + `takePermissionsPatch` on **load and save**; `takeInstructionPair` for autoRun/autoReview (own keys, no `<>`); extra-root writes Ask even unrestricted.
- Grep / symbols: `sanitizeExtraRoot`, `takePermissionsPatch`, `takeInstructionPair`, `jailPath`, `fsExtraRoots`
- Regression: `packages/runtime/src/policy.test.mjs` takePermissionsPatch
- Source: Home OS tool kit 2026-09-01

### AP-20260901-50 — Nested task and Think bash are denied
- Root cause: a Bash worker that calls `task` again, or Think mode spawning `terminal_run`.
- Bad shape: `runSubagentJobs` without `host.depth`; Think `THINK_TOOLS` including unrestricted `task`.
- Good shape: `depth` → `nested task denied`; `parseTaskCall(..., { think })` explore-only.
- Grep / symbols: `parseTaskCall`, `host.depth`
- Regression: `packages/runtime/src/subagent.test.mjs`
- Source: Home OS tool kit 2026-09-01

### AP-20260901-51 — VERIFY critic must filter parsed calls, not only tool defs
- Root cause: Qwen XML can name `terminal_run` even when `verifyToolDefs` sent only critic tools.
- Bad shape: `pending.length ? pending : parseQwenToolCalls(vacc)` then `runTool` every name.
- Good shape: `takeVerifyCalls` allowlist `str_replace` / `debug_log` / `ask_user`.
- Grep / symbols: `takeVerifyCalls`, `VERIFY_TOOLS`
- Regression: `packages/runtime/src/tool-surface.test.mjs` T-68
- Source: Home OS tool kit hunt 2026-09-01

### AP-20260901-52 — Coder sidecar is a second loopback child, not a 2B overload
- Root cause: a second GGUF would bind `0.0.0.0`, take a renderer port, follow `../` model names, nested-LLM from Think, skipVerify-forget the critic contract, or `throw` sidecar OOM into the 2B start path.
- Bad shape: reuse one `LlamaServerManager` child; `--host 0.0.0.0`; `infill` payload includes `port`; `coderLlamaArgs` takes IPC port; nested `runForge` without `skipVerify`/`skipRemember`; Think `nestedForge`; `ensureLlama` throws on sidecar fail.
- Good shape: second manager via `createCoderManager`; `coderLlamaArgs` host `127.0.0.1`, port always `DEFAULT_CODER_PORT` (8766), ctx ≤2048, half ngl; `jailedCoderModelPath` allowlisted `.gguf` basename; `pickInfillPort` from main status only; nestedForge explore-only + `nestedExploreForgeFlags`; Think and missing callback stay deterministic; `host.depth` still denies nested `task`; sidecar catch leaves `coderEnabled` false.
- Grep / symbols: `coderLlamaArgs`, `ensureCoder`, `startSidecar`, `pickInfillPort`, `nestedForge`, `jailedCoderModelPath`
- Regression: `packages/governor/src/coder-args.test.mjs`, `packages/runtime/src/subagent.test.mjs` T-69
- Source: hunt Wave D coder-sidecar 2026-09-01

### AP-20260901-53 — compute plots and skill stamp are prefix jails, not Landlock
- Root cause: matplotlib `savefig` / a skill tree walk would follow `..`, `data/secrets`, extra-roots, or `reference/`; a long-lived main would either re-parse every forge or miss a SKILL.md save.
- Bad shape: write figures next to the script or to cwd; `pip install matplotlib` from the worker; unbounded `walkMd`; cache forever or never cache.
- Good shape: `computePlotRel` + `assertPlotInside` (`data/compute/plots/` only, reject `..`); `MPLBACKEND=Agg` + `MPLCONFIGDIR` under compute cwd; unlink script keep png; generic `matplotlib unavailable`; `knowledgeStamp` jailed `SKILL.md` under `RAG/skills` and `mods/<id>/skills` (and rules trees so `writeRule` is not stale) with walk cap and `skipSkillFile`; `cachedKnowledge` until stamp changes.
- Grep / symbols: `assertPlotInside`, `computePlotRel`, `knowledgeStamp`, `cachedKnowledge`, `HOMEAI_PLOT_ABS`
- Regression: `packages/runtime/src/compute.test.mjs` T-70 T-71
- Source: hunt Wave E compute-plots 2026-09-01

### AP-20260901-54 — Sidecar never attaches to a foreign /health
- Root cause: `LlamaServerManager.start` treated any listener on the requested port as ours. Sidecar `startSidecar` passed a binary so LM Studio was skipped, but leftover `/health` or `/v1/models` on 8766 still set `running` with no child.
- Bad shape: `if (await portOpen(args.port)) { status.running = true }` on the sidecar path; nested forge `Number(coder.port) || DEFAULT_CODER_PORT`; ports pane only allowlists `llama`.
- Good shape: `shouldAttachExistingListener({ sidecar: true })` is always false; occupied sidecar port throws (ensureCoder catch → `coderEnabled` false); `ownedLlamaPort` for infill, nested forge, and the ports row; `PORT_NAMES` includes `coder`.
- Grep / symbols: `shouldAttachExistingListener`, `ownedLlamaPort`, `startSidecar`, `takePortRow`
- Regression: `packages/llm/src/sidecar-own.test.mjs` T-72; `packages/runtime/src/workbench-chrome.test.mjs` coder port name
- Source: hunt Wave D+E merge 2026-09-01

### AP-20260904-55 — Fleet stacks are recipe argv, not a renderer shell
- Root cause: a multi-repo supervisor would `exec` the renderer command, `git clone` `file://` or credential URLs, or return `HUB_BOT_TOKEN` on `homeai:fleet:snapshot`.
- Bad shape: `spawn(shell, ['-c', payload.cmd])`; dest path from IPC; DTO includes `token`; SMTP host `payload.host`.
- Good shape: `recipeSpawn` table (`python3 -m app.main` / `npm start` / `npm run dev`); `takeRepoRel` only `Repos/` or `data/fleet/clones/`; `gitCloneHttpsArgv`; secrets in `data/secrets/fleet/`; `publicSnapshot` last4 only; `takeSmtpHop` Proton Bridge or Tuta; broadcasts to stored subscribers, plain text, cap 50.
- Grep / symbols: `recipeSpawn`, `takeRepoRel`, `gitCloneHttpsArgv`, `redactFleetLog`, `takeSmtpHop`
- Regression: `packages/runtime/src/fleet.test.mjs` T-73
- Source: hunt Fleet pane 2026-09-04

### AP-20260904-56 — Extra-root `root` id is a basename, never a path
- Root cause: Wave C extra roots only worked as absolute paths, so a 2B would pass `/etc` or `..` as `root`. A colliding extra-root basename would also pick the wrong tree. Telegram `/help` claimed `/do` had every MCP while `toolsForMode` packs.
- Bad shape: `jailPath(root, path, extras, args.root)` with `String(root)` as a filesystem path; unique-first match on basename; help copy `full PC tools + every MCP`.
- Good shape: `takeFsRootId` allowlists `[\w.-]` folder names (`workspace` = default); `extraRootById` requires exactly one listed extra with that basename; extra-root miss errors stay generic; writes still `extraRootWriteAsks`; help SHIP line is packs.
- Grep / symbols: `takeFsRootId`, `extraRootById`, `helpCard`
- Regression: `packages/runtime/src/paths.test.mjs` T-74; `telegram-chrome.test.mjs` helpCard
- Source: hunt Local Home OS kit close 2026-09-04

### AP-20260904-57 — Pack schemas shrink; skill `web` is not research; VERIFY forbids shell
- Root cause: Think returned unshrunk builtins; extra packs kept every core schema; skill descriptions containing `web` (workbench) opened research; KERNEL_SYSTEM told VERIFY to `test_run` while `VERIFY_TOOLS` excluded it. Root `AGENTS.md` edits did not bust `cachedKnowledge`.
- Bad shape: `if (mode === 'think') return builtin`; `shrinkToolDef(t, pack !== mcp-domain)`; `hay.includes('web')`; critic user text without an allowlist sentence.
- Good shape: `keepFullSchema` + `THINK_FULL_TOOLS` / `CORE_FULL_TOOLS`; skill keywords word-boundary; `verifyUserPrompt`; stamp `AGENTS.md`.
- Grep / symbols: `keepFullSchema`, `verifyUserPrompt`, `knowledgeStamp`
- Regression: `packages/runtime/src/tool-surface.test.mjs` T-75; `compute.test.mjs` T-71
- Source: Home OS subfeature refine 2026-09-04

### AP-20260904-58 — compute open() cannot read secrets; Figure.savefig follows the plot jail
- Root cause: matplotlib `Figure.savefig` and `builtins.open` bypassed `plt.savefig` redirection and could read `data/secrets`.
- Bad shape: wrap only `pyplot.savefig`; trust the script not to `open` secrets.
- Good shape: wrap `Figure.savefig` to `HOMEAI_PLOT_ABS`; `HOMEAI_WS` + `builtins.open` deny `data/secrets`.
- Grep / symbols: `_figsave`, `_open`, `HOMEAI_WS`
- Regression: `packages/runtime/src/compute.test.mjs` T-76
- Source: Home OS subfeature refine 2026-09-04

### AP-20260904-59 — OCR is images; HTML is extracted, not stuffed
- Root cause: tesseract would run on SVG/HTML inbox drops; `http_fetch` and research digests returned raw HTML; entity-decoded `&lt;script&gt;` survived one strip pass; note previews kept `<>`.
- Bad shape: `inboxOcr` any inbox path; `fetch` text as-is; `digestSubagent` only `replace(/[<>]/g)`.
- Good shape: `inboxOcrAllowed` image ext; `looksLikeHtml` → `extractHtml` (second tag strip); research URL → `web_extract`; note preview strips `<>`.
- Grep / symbols: `inboxOcrAllowed`, `looksLikeHtml`, `digestBody`
- Regression: `packages/runtime/src/life-files.test.mjs` T-77; `subagent.test.mjs`
- Source: Home OS subfeature refine 2026-09-04

### AP-20260904-60 — pathlib/os.open/node fs cannot read data/secrets
- Root cause: `builtins.open` jail left `pathlib.Path.read_text`, `os.open`, `io.open`, and node `fs.readFileSync` able to read `data/secrets`.
- Bad shape: wrap only `builtins.open`; trust the script not to use Path or os.open.
- Good shape: shared `_secret_path` on `open` / `io.open` / `os.open` / `Path.open`; node wrap patches the `node:fs` default object (`readFile*` / `openSync` / `promises`). ESM named `readFileSync` is still a residual.
- Grep / symbols: `_secret_path`, `_popen`, `_os_open`, `_jailNode`
- Regression: `packages/runtime/src/compute.test.mjs` T-76
- Source: Home OS continue 2026-09-04

### AP-20260904-61 — VERIFY patch blob is workspace-relative; extra-root/secrets omitted
- Root cause: the critic only saw 180-char toolTrace lines, or would receive extra-root/secrets contents if raw `result.extra` were dumped to a cloud pass (E-09).
- Bad shape: interpolate `extra.path` + `extra.after` into the VERIFY user turn; send extra-root files to the critic.
- Good shape: `takeVerifyPatch` uses `relative(workspaceRoot)`; extra-root → `content omitted` with no path leak; `data/secrets` dropped; `redactCloudText` + strip `<>`; own properties only (`Object.hasOwn`).
- Grep / symbols: `takeVerifyPatch`, `verifyUserPrompt`
- Regression: `packages/runtime/src/tool-surface.test.mjs` T-78
- Source: Home OS continue 2026-09-04

### AP-20260904-62 — knowledgeStamp walks workspace skill trees, never $HOME
- Root cause: `loadAllKnowledge` already reads workspace `.cursor/skills`, `.agents/skills`, `.homeai/skills`, but the stamp only watched RAG/mods/`AGENTS.md`, so those saves looked stale. Walking `$HOME/.cursor/skills` would escape the workspace jail.
- Bad shape: stamp only `RAG/skills`; `walk(homedir + '/.cursor/skills')`.
- Good shape: `walk('.cursor/skills'|'.cursor/rules'|'.agents/skills'|'.homeai/skills')` via `assertInside`; never home.
- Grep / symbols: `knowledgeStamp`, `skillSearchRoots`
- Regression: `packages/runtime/src/compute.test.mjs` T-71
- Source: Home OS continue 2026-09-04

### AP-20260904-63 — compute writes stay in runs/plots; named node:fs is shimmed
- Root cause: `open('w')` / `os.mkdir` / `os.chdir` / node `writeFileSync` could write the workspace or an extra-root. ESM named `readFileSync` from `await import('node:fs')` skipped the default-object patch.
- Bad shape: deny only `data/secrets` reads; prepend `import fs` and mutate the default export; allow `chdir` then relative writes.
- Good shape: write/`mkdir` only under cwd (`data/compute/runs`) or `HOMEAI_PLOT_DIR`; `os.chdir` denied; node `--import` hook resolves `node:fs` to a jailed shim so named exports call the patch.
- Grep / symbols: `_write_ok`, `_jailNode`, `computeHookRel`, `nodeShimSource`
- Regression: `packages/runtime/src/compute.test.mjs` T-79
- Source: Home OS continue 2026-09-04

### AP-20260904-64 — compute rename/shutil/promises stay in the write jail
- Root cause: `os.rename`/`replace`, `shutil.copy`/`move`, and ESM `import('node:fs/promises')` bypassed the open/mkdir jail and could write `packages/` or read `data/secrets`.
- Bad shape: wrap only `open`/`mkdir`/`writeFileSync`; `--import` hook only for `node:fs`.
- Good shape: both rename paths `_write_ok`; shutil pair wrappers; `{id}-pshim.mjs` for `node:fs/promises`.
- Grep / symbols: `_jail_rename`, `_jail_shutil_pair`, `computePromisesShimRel`, `nodePromisesShimSource`
- Regression: `packages/runtime/src/compute.test.mjs` T-80
- Source: Home OS AC close 2026-09-04

### AP-20260904-65 — VERIFY git diff is workspace-only
- Root cause: the critic had patches but no diff, or a raw `git diff` would include extra-root and `data/secrets`.
- Bad shape: interpolate user pathspecs; dump `gitDiff` UI output to a cloud pass.
- Good shape: `takeVerifyDiff` fixed argv `diff --no-ext-diff -- .` plus exclude secrets; cap; strip `<>`; `redactCloudText`; `verifyUserPrompt(trace, patches, diff)` with diff after patches.
- Grep / symbols: `takeVerifyDiff`, `verifyUserPrompt`
- Regression: `packages/runtime/src/tool-surface.test.mjs` T-78
- Source: Home OS AC close 2026-09-04

### AP-20260904-66 — voice STT/TTS is PATH + jail, not a vendored blob
- Root cause: Whisper/Piper as markdown-only would skip the inbox jail; a user argv or extra-root path would leak; missing-binary text used to dump installer URLs.
- Bad shape: spawn user strings; OCR/STT on SVG; vendor a `.deb` binary.
- Good shape: `inboxOnly` + audio ext/magic; spawn allowlisted basename; generic `stt unavailable` / `tts unavailable`; wav only `data/tts/<id>.wav`; Telegram voice/audio → `voice.ogg`/`audio.mp3`.
- Grep / symbols: `inboxStt`, `speak`, `inboxMatches`, `takeTelegramInbox`
- Regression: `packages/runtime/src/voice.test.mjs` T-81 T-82; `inbox.test.mjs`; `telegram-router.test.mjs`
- Source: Home OS AC close 2026-09-04

### AP-20260904-67 — fleet phone surface shares host ops; removeSub saves the list
- Root cause: Fleet pane was desktop-only; `removeSub` wrote `subscribers` (undefined). Phone `/fleet token` would put hub tokens in chat history. `dockKind('/fleet')` stole the slash command.
- Bad shape: `saveRegistry({ subscribers })`; second clone/start implementation in the bridge; dock maps slash commands.
- Good shape: `createFleetHost` returns `addRepo`/`clone`/`start`/`stop`/`addSub`; Telegram and Mini App call those; `filterSubscribers` + `subscribers: subs`; `takeFleetCommand` rejects tokens and `file://`; `dockKind` ignores leading `/`.
- Grep / symbols: `takeFleetCommand`, `filterSubscribers`, `fleetCard`, `presentFleet`
- Regression: `packages/runtime/src/fleet.test.mjs` T-84; `telegram-router.test.mjs`
- Source: Fleet telegram wire 2026-09-04

### AP-20260904-68 — Workflow panel is a jailed reducer, not HTML or a fake fleet
- Root cause: Background/Stage copied Cursor chrome (workflow id, tokens, Hunt/Verify/Critic) while the renderer used empty token fields and a name regex that would put VERIFY `str_replace` on Hunt.
- Bad shape: `dangerouslySetInnerHTML` for agent names; `tokens = text.length/4`; `stopAgent(userId)`; critic = any `str_replace`; labels like Opus 5 / Hunt3.
- Good shape: `takeWorkflow` allowlists `wf_` id, lanes, models, `publicTokens`; forge tags `lane: critic` only on the VERIFY pass; `stop` uses the current `runId`; React text nodes.
- Grep / symbols: `takeWorkflow`, `takeWorkflowLane`, `formatPublicTokens`, `BackgroundTasks`
- Regression: `packages/runtime/src/activity.test.mjs` T-85 T-86 T-87; `telegram-chrome.test.mjs` T-88
- Source: Background workflow panel 2026-09-04

### AP-20260904-69 — Stop keeps runId until done; usage waits for the agent row
- Root cause: `stop()` cleared `runId` in the same set as `busy: false`, so `applyForeignChunk` treated abort chunks as a foreign run and double-folded. Forge yields `usage` before `tool_call`, so token cells stayed empty. Leaving Stage force-closed Background tasks.
- Bad shape: `set({ busy: false, runId: undefined })` on Stop; attach usage to `agents[last]` when none are running; `setBgOpen(layoutMode === 'stage')` both ways; scroll via `.trace-tool` text; glance phases only inside `card` HTML-ish text.
- Good shape: keep `runId` + `jobSource` until forge `done`; `takeWorkflow` seals stopped/done/error against later `tool_call`; `pendingUsage` sticks to the next running agent; `desktopOwnsAgentChunk`; Stage only default-opens; `data-tool` + `revealTool`; glance `phases` is `stripActivityText`.
- Grep / symbols: `desktopOwnsAgentChunk`, `pendingUsage`, `revealTool`, `workflowForgeStep`
- Regression: `packages/runtime/src/activity.test.mjs` T-89
- Source: Workflow panel gaps 2026-09-04

### AP-20260904-70 — STATUS meters count exact status cells, not awk $5
- Root cause: TESTS prove text used `design|cowork|code`, so `count-status.sh` and T-07 `cols[4]` treated a pipe-split fragment as the status column and under-counted `done`.
- Bad shape: `awk -F'|'` `$5==w`; JS `cols[4] === want` on a 5-column table whose prove field contains `|`.
- Good shape: count a trimmed cell that is exactly `done|required|missing|tested|tracked|wont`; prove text uses "or" not `|`; T-11 tags `profile.test.mjs`.
- Grep / symbols: `countTableStatus`, `count-status.sh`
- Regression: `packages/runtime/src/search-proof.test.mjs` T-07 T-83
- Source: gap analysis 2026-09-04

### AP-20260904-71 — Ask has no life/browser reads; web_search is an allowlisted URL
- Root cause: Ask could still call `speak`/`inbox_stt`/`inbox_ocr`/`browser_extract|screenshot|console`. `web_search` fetched DuckDuckGo without `assertAgentUrl`.
- Bad shape: ASK_BLOCK only writes + navigate/click/type; `fetch(html.duckduckgo.com)` with no jail.
- Good shape: those names in ASK_BLOCK; `assertAgentUrl(root, host, WEB_SEARCH_ENDPOINT + query)` before fetch; missing PATH bins drop life tools (`filterLifeTools`).
- Grep / symbols: `ASK_BLOCK`, `assertAgentUrl`, `WEB_SEARCH_ENDPOINT`, `filterLifeTools`
- Regression: `packages/runtime/src/tool-surface.test.mjs` T-47 T-82; `search-proof.test.mjs` T-02 `web_search`/`assertAgentUrl`
- Source: gap analysis 2026-09-04

### AP-20260904-72 — Phone free-chat and Glance share the kernel run, not a second theater
- Root cause: Telegram `startRun` minted `tg_*` but never `rememberMiniRun`, so Mini Glance stayed idle. Free-chat with `defaultMode=agent` still forged `ask`. Mini mode chips were session-only. Health/Cursor/Llama and fleet restart had no glass buttons.
- Bad shape: `startRun(..., 'ask')` when profile is agent; Glance `loadSheet` ignores `phases`; Mini chips `state.mode = m` without `saveProfile`.
- Good shape: `rememberMiniRun` on Telegram start; Glance paints stripped `phases` as text; live modes forge as profile; Mini `action: mode` persist; Health/Cursor/Llama + `fleet-restart` on the allowlist.
- Grep / symbols: `rememberMiniRun`, `takeMiniBody` `mode` `fleet-restart`, `inboxTranscript`
- Regression: `packages/runtime/src/telegram-initdata.test.mjs` T-28; `miniapp-hub.test.mjs` T-29 `tg_`
- Source: gap analysis 2026-09-04

### AP-20260904-73 — Skill YAML `>-` is folded text; preload matches main IPC
- Root cause: `parseFrontMatter` first-colon split stored `description: >-` as `>-`. `homeai:pty:exit` and `homeai:browser:console` existed in main; fleet methods existed on `api` but not `HomeAiApi`.
- Bad shape: line-only YAML; renderer cannot subscribe to pty exit; TypeScript hole on fleet.
- Good shape: `parseSkillFrontMatter` folds `>`/`>-`/`|`/`|-`, drops proto keys and `<>`; `onPtyExit` + `browserConsole` on preload; fleet methods on the interface.
- Grep / symbols: `parseSkillFrontMatter`, `onPtyExit`, `browserConsole`
- Regression: `packages/runtime/src/front-matter.test.mjs` T-91
- Source: gap analysis 2026-09-04 E-05

### AP-20260904-74 — Auto Review deny must halt before runTool
- Root cause: `decideTool` deny was ignored; main only waited on `ask`.
- Bad shape: `if (decision === 'ask') wait; runTool()`
- Good shape: `if (decision === 'deny') return { ok:false, content:'unavailable' }` then ask then runTool
- Grep / symbols: `decideTool`, `runTool`, `unavailable`, `auto-review`
- Regression: T-92 T-93; `apps/desktop/src/main/index.ts` deny return
- Source: Auto Review v2 PRO

### AP-20260904-75 — Unknown shell shape must not auto-allow
- Root cause: prefix `commandAllowed` / unmodeled `$()` / env
- Bad shape: `c.startsWith('git status')` allows `git status; rm`
- Good shape: Judge tokenize + closed argv tables; `; | $() env` → ask or deny
- Grep / symbols: `judgeShell`, `splitSafeAnd`
- Regression: `packages/runtime/src/auto-review.test.mjs` T-92
- Source: LM Studio Judge analog (allowlist of understood shapes)

### AP-20260904-76 — Reviewer JSON own-key; no tool results in prompt
- Root cause: prototype keys / tool-result injection into classifier
- Bad shape: `JSON.parse` then `obj.risk`; transcript includes `ok explore` / tool JSON
- Good shape: `parseReviewerAxes` own keys; `takeReviewerTranscript` drops tool lines
- Grep / symbols: `parseReviewerAxes`, `takeReviewerTranscript`
- Regression: T-93
- Source: LM Studio reviewer + AP-SEED-08

### AP-20260904-77 — allow_instructions never skip too_destructive
- Root cause: standing allow list treated as Run Everything
- Bad shape: if instruction hit → allow
- Good shape: combinator deny on `too_destructive` first; instructions only set authorization
- Grep / symbols: `combineAxes`, `allow_instructions`
- Regression: T-93 `rm -rf /` + allow list
- Source: LM Studio flowchart

### AP-20260904-78 — Classify must re-enter the pipeline so instructions bias axes
- Root cause: main called `combineAxes(llmAxes, report)` and skipped `biasAxes`, so `block_instructions` lost to a low/neutral JSON object.
- Bad shape: `combineAxes(parseReviewerAxes(text), pipe)`
- Good shape: `runAutoReviewPipeline({ ..., axes })` which biases authorization before combinator
- Grep / symbols: `biasAxes`, `runAutoReviewPipeline`, `block_instructions`
- Regression: T-93 pipeline + axes + block_instructions stays ask
- Source: Auto Review v2 PRO gap hunt

### AP-20260904-79 — Judge must unmodel `;` / `|` on single segments
- Root cause: `splitSafeAnd` only scanned metacharacters when `&&` was present, so `cat a | cat b` tokenized `|` as a relative path and auto-allowed.
- Bad shape: `if (!cmd.includes('&&')) return [cmd]`
- Good shape: reject `; | \`$()` / redirects on the raw string before tokenize
- Grep / symbols: `splitSafeAnd`, `judgeShell`
- Regression: T-92 `cat notes.txt ; cat foo.txt` and `cat a | cat b` ask
- Source: Auto Review v2 PRO gap hunt

### AP-20260904-80 — Site domain is a hostname label, not a fetch URL
- Root cause: a website field looks like a URL, so main might `fetch` or `openExternal` it (SSRF / open-redirect).
- Bad shape: persist raw `https://user:pass@host/path` then `fetch(row.domain)` or `shell.openExternal(domain)`
- Good shape: `takeSiteDomain` keeps hostname only; `patchRepo` allowlists title/domain/recipe; Fleet pane renders domain as text
- Grep / symbols: `takeSiteDomain`, `homeai:fleet:patchRepo`, `openExternal`
- Regression: T-94 `https://user:pass@…` / `javascript:` null; fleet-host has no `fetch(` / `openExternal`
- Source: Fleet clone/domain ship

### AP-20260904-81 — Local clone dest is `data/fleet/clones/<id>` under `cloneOf`
- Root cause: Clone used `${id}-2` (collision/truncate) or copied the parent domain/rel, so a fork could overwrite `Repos/` or inherit a live hostname.
- Bad shape: dest = parent `rel`; `domain: src.domain`; renderer `id: r.id + '-2'`
- Good shape: `nextCloneId` + `cloneOf`; `runGit` clone into `data/fleet/clones/${id}`; domain not copied; Mini App `fleet-fork` rejects `url`
- Grep / symbols: `nextCloneId`, `stackForest`, `cloneLocal`, `fleet-fork`
- Regression: T-94 `cloneLocal` dest jail; self-`cloneOf` not nested; `takeMiniBody` fleet-fork + url is null
- Source: Fleet clone/domain ship

### AP-20260904-82 — Auto-review must not auto-allow MCP
- Root cause: MCP tools skipped Judge and treated an allowlist hit as `allow` in every mode except unrestricted.
- Bad shape: `unrestricted ? allow : mcpOk ? allow : ask`
- Good shape: `mcpApprovalDecision(mode, mcpOk)` — auto-review always Ask
- Grep / symbols: `mcpApprovalDecision`, `mcp_`
- Regression: T-95 `mcpApprovalDecision('auto-review', true) === 'ask'`
- Source: Auto Review gap hunt

### AP-20260904-83 — Empty Trust instructions must persist as null
- Root cause: Save omitted `autoReview` when textareas were empty, so `loadPermissions` kept `~/.homeai` / `.cursor` lines.
- Bad shape: `if (taken.autoReview) next.autoReview = taken.autoReview` then write
- Good shape: write `autoReview: null`; `pinWorkspaceInstructions` after overlays
- Grep / symbols: `pinWorkspaceInstructions`, `taken.autoReview ?? null`
- Regression: T-95 empty patch is null; pin deletes overlay
- Source: Auto Review gap hunt

### AP-20260904-84 — Health sheet must carry the live Auto Review line
- Root cause: Glance passed `miniPulse.autoReviewLine` into `stageCard`; Health only passed `approvalMode`.
- Bad shape: health `stageCard({ approvalMode })`
- Good shape: same `lastMiniRunId` + `miniPulse` line as Glance
- Grep / symbols: `action === 'health'`, `autoReviewLine`
- Regression: T-95 health slice matches `autoReviewLine` and `miniPulse`
- Source: Auto Review gap hunt

### AP-20260904-85 — ESM main has no `__dirname`
- Root cause: electron-vite emits ESM; `createWindow` joined preload with Node CJS `__dirname`, so the window never opened.
- Bad shape: `preload: join(__dirname, '../preload/index.mjs')`
- Good shape: `mainDir = dirname(fileURLToPath(import.meta.url))` on the **entry** module (not a chunk); sandboxed preload is CJS `index.js` (AP-20260905-2)
- Grep / symbols: `createWindow`, `import.meta.url`, `__dirname`
- Regression: T-96 `electron-dev-boot.test.mjs`
- Source: `npm run dev` log `__dirname is not defined`

### AP-20260904-86 — Vite watch must not ingest the whole workspace
- Root cause: main/preload `build --watch` chokidar followed `AI Resources` / `RAG` / `data` and exhausted inotify (EMFILE), then Electron died.
- Bad shape: default watch from repo root; `usePolling` on the whole tree
- Good shape: shared `watchIgnore`; renderer port **5175** so we do not steal 5173
- Grep / symbols: `watchIgnore`, `electron.vite.config.ts`
- Regression: T-96 config contains `AI Resources` / `RAG` / `port: 5175`
- Source: `npm run dev` EMFILE on `apps/renderer` then repo-wide watch

### AP-20260904-87 — Renderer must not import Node runtime barrels
- Root cause: Settings/Chat imported `mcp-packs.mjs` / `auto-review.mjs`, which load `node:path`/`fs`/`os`, so `electron-vite build` died on `isAbsolute`.
- Bad shape: renderer `from '.../auto-review.mjs'` / `mcp-packs.mjs` / `@homeai/runtime`
- Good shape: `auto-review-line.mjs` + `mcp-domain.mjs`; renderer Vite aliases omit `@homeai/runtime`
- Grep / symbols: `SettingsPane`, `ChatPane`, `StageTrustRow`, `rendererAliases`
- Regression: T-96 renderer panes do not import those barrels
- Source: `electron-vite build` `policy.mjs isAbsolute`

### AP-20260904-88 — RAG live-watch must not exhaust inotify
- Root cause: `rag.watch` on RAG/notes/qa/mods created one watcher per file; with `max_user_instances` already at the desktop cap, every add rejected EMFILE (unhandled).
- Bad shape: `watch(roots)` with no `error` handler; watch `mods/`
- Good shape: ingest mods at boot; watch RAG/notes/qa only; `watcher.on('error')` closes
- Grep / symbols: `rag.watch`, `RagStore.watch`
- Regression: T-96 `electron-dev-boot.test.mjs` rag watch error + no mods
### AP-20260904-89 — Activity id must change sidebar and center, not only the store
- Root cause: `setActivity` left `centerView: 'browser'` so BrowserView/BrowserPane covered every other pane; sidebar always rendered FileTree except search/git; Notes `listOnly` was never mounted; `[data-chat='off'] .body` overrode studio columns so Design squeezed into a black strip. `openFile` during layout restore forced `activity: 'files'` after a jailed pane id.
- Bad shape: `centerView = activity === 'files' || search ? 'editor' : get().centerView`; center `if (centerView === 'browser' || activity === 'browser')`; sidebar `search ? Search : git ? Git : FileTree`.
- Good shape: `centerViewForActivity` always `'editor'` unless activity is `browser`; `sidebarKind` maps notes/qa/mods/maps; page activities hide the tree; studio CSS `!important` two-column; restore tabs with `keepActivity`.
- Grep / symbols: `setActivity`, `sidebarKind`, `data-studio`, `browserHide`
- Regression: T-97 `packages/runtime/src/pane-route.test.mjs`
- Source: operator “Debug/Skills/Notes/Maps/Design/Board/Library/Telegram/Fleet do nothing”

### AP-20260904-90 — Stage must not squeeze page panes to a strip
- Root cause: Stage CSS gave the center `0.28fr` and a 36px sidebar even for Board/Library/Fleet/Notes, so those features looked blank beside Agents.
- Bad shape: `[data-page='on'][data-layout='stage'] … minmax(0, 0.28fr)` plus Notes `setState({ activity: 'notes' })` skipping `browserHide`
- Good shape: page/list activities keep `minmax(0, 1fr)` + `var(--sidebar)`; Notes calls `setActivity`
- Grep / symbols: `isListActivity`, `data-page`, `setActivity('notes')`, `0.28fr`
- Regression: T-98 `pane-route.test.mjs`
- Source: refine-all-features Stage squeeze hunt

### AP-20260904-91 — Chat home chrome stays text nodes and Hex AI
- Root cause: session title plus `projectTag('Home AI')` → `HEX AI` painted as one header (`Home HEX AI`); empty log was a black void; trust copy repeated in titlebar, live rail, composer foot, and status.
- Bad shape: `dangerouslySetInnerHTML` on titles; `projectTag` uppercase HEX; four Local 2B / llama / keys stacks; `Forge idle` next to `1 running` from a pty.
- Good shape: HxEmpty / kickers are React text nodes; `projectTag` maps folder `Home AI` → `Hex AI`; HUD in titlebar + footer folder basename; forge rail only when live; background nudge opens the rail.
- Grep / symbols: `HxEmpty`, `projectTag`, `approvals not sandbox`, `keys in data/secrets`, `dangerouslySetInnerHTML`
- Regression: T-99 `packages/runtime/src/hex-chrome.test.mjs`
- Source: Chat-and-Cowork screenshot refine 2026-09-04

### AP-20260904-92 — Composer chrome is grouped, not a ghost row
- Root cause: follow-bar listed Mode, Effort-as-Normal, Models, Quick hunks, Deep, and Settings as equal ghosts. Settings duplicated the activity bar. Two review IPCs looked like two products.
- Bad shape: `<Settings>` in composer; two sibling `agentReview` buttons; Effort labeled only `Normal`.
- Good shape: mode + textarea + attach + send; `follow-ctrl` Effort; compact `follow-select` for openai/openrouter/cursor; one Review menu calling existing `homeai.agentReview('quick'|'deep')`. Editor empty is `HxEmpty` text nodes.
- Grep / symbols: `follow-ctrl`, `follow-select`, `runReview`, `HxEmpty`, `<Settings`
- Regression: T-99 `packages/runtime/src/hex-chrome.test.mjs` composer/editor/title cases
- Source: Chat-and-Cowork composer soup 2026-09-04

### AP-20260904-93 — Page chrome is HxPage, not a second pane-head
- Root cause: activity pages kept a `pane-head` title (or raw `h2`) after Chat home moved to `HxPage`, so Board/Library/Fleet/Telegram/Settings/Skills/Debug showed double headers and black-void empties. Skills also interpolated MCP `s.url`.
- Bad shape: `<div className="pane-head">Fleet</div>` beside `<HxPage title="Fleet">`; `s.url` in the Skills card; `dangerouslySetInnerHTML` on titles.
- Good shape: full pages wrap `HxPage`; list sidebars use `HxSideHead`; zero-data is `HxEmpty`; titles/leads are React text nodes; MCP transport only, never the stored URL; Fleet still does not `fetch`/`openExternal` domains.
- Grep / symbols: `HxPage`, `HxSideHead`, `HxEmpty`, `pane-head`, `s.url`, `dangerouslySetInnerHTML`
- Regression: T-100 `packages/runtime/src/hex-chrome.test.mjs` page chrome cases
- Source: workbench UI/UX raise 2026-09-04

### AP-20260904-94 — Palette query and quick-open paths are text, not HTML
- Root cause: a “premium” command palette or Ctrl+P overlay tempts `innerHTML` of the filter string or file path, so `<script>` in a query or a `<>` path would become a node.
- Bad shape: `dangerouslySetInnerHTML={{ __html: 'No matches for ' + q }}`; `hit.innerHTML = rel`; PlanDoc markdown via `innerHTML`.
- Good shape: HxEmpty title/body and hit labels are React text nodes; `stripActivityText` on quick-open paths; PlanDoc keeps `parse` + `rich()` spans/code; no new IPC.
- Grep / symbols: `CommandPalette`, `QuickOpen`, `PlanDoc`, `dangerouslySetInnerHTML`, `palette-head`
- Regression: T-101 `packages/runtime/src/hex-chrome.test.mjs` overlay chrome
- Source: leftover workbench overlays 2026-09-04

### AP-20260904-95 — Overlay chrome stays Hex tokens, not VS Code ghosts
- Root cause: leftover pops (About, llama, Mode, mention, session kebab, Effort, titlebar menus) still used VS Code blues (`#04395e`, `#9cdcfe`) and fake idle metrics (`Agent 0/0`). Disabled Design shape tools were opacity-0.35 with no hint. Session filter-zero was a raw `<p>`, not HxEmpty.
- Bad shape: `mention-pop .hit:hover { background: #04395e }`; status `Agent 0/0`; `.cd-mini-tools button:disabled { opacity: 0.35 }` with no copy; `innerHTML` in a pop.
- Good shape: Hex `--radius` / `--focus` / amber on; HxEmpty for session/file-tree/browser/background/crash empties; shape tools `cd-tool-off` + text hint; status `Agent idle` / `No problems`; potato skips pop motion; titles stay React text nodes.
- Grep / symbols: `cd-tool-off`, `No matching sessions`, `Agent idle`, `#04395e`, `dangerouslySetInnerHTML`, `llama-pop`
- Regression: T-102 `packages/runtime/src/hex-chrome.test.mjs`
- Source: leftover workbench UI/UX fill 2026-09-04

### AP-20260904-96 — Leftover chrome uses Hex tokens, not VS Code/Claude hex
- Root cause: after HxPage chrome, primary actions and Design on-states still used VS Code/Claude blues (`#0e639c`, `#0078d4`, `#82b1ff`, `#9cdcfe`). Unused `.pane-head` CSS and Terminal `Problems` / `Output` / `Debug Console` labels still looked like another product.
- Bad shape: `.send { background: #0e639c }`; `.cd-save { background: #82b1ff }`; `.pane-head` with no `className`; `Debug Console` over Hunt/Verify/Critic; `innerHTML` on a label.
- Good shape: `.send` / `.keep-btn` / `.cd-save` use `--amber` / `--focus` / `--radius`; potato skips extra motion; delete unused `.pane-head`; tabs Checks / Kernel log / Workflow; titles stay React text nodes.
- Grep / symbols: `.send`, `#82b1ff`, `#9cdcfe`, `pane-head`, `Debug Console`, `dangerouslySetInnerHTML`
- Regression: T-103 `packages/runtime/src/hex-chrome.test.mjs`
- Source: leftover workbench UI/UX fill 2026-09-04

### AP-20260904-97 — Product chrome hex vs Hex token
- Root cause: after `.send` went `--amber`, sibling chrome still used VS Code/Claude hex (white send-round, Catppuccin/VS Code blues on plan chips, hunk heads, file icons, context `sys`, Material/Claude blues on Effort/export).
- Bad shape: `.send-round { background: #fff }`; `.plan-ref-title { color: #89b4fa }`; `.hunk-head { color: #569cd6 }`; `.file .ico.ico-code { color: #519aba }`; `.ctx-seg.sys { background: #569cd6 }`; `.cd-export { background: #ffab91 }`; `innerHTML` on a chip label.
- Good shape: product buttons/chips/icons/rails use `--amber` / `--text` / `--muted`; 32px send-round hit; potato skips send-round motion; xterm/Monaco language colors stay; titles stay React text nodes; no new IPC.
- Grep / symbols: `.send-round`, `#89b4fa`, `#569cd6`, `#519aba`, `#ffab91`, `#3b82f6`, `dangerouslySetInnerHTML`
- Regression: T-104 `packages/runtime/src/hex-chrome.test.mjs` (product CSS only — do not fail Monaco/xterm ANSI)
- Source: leftover workbench token fill 2026-09-04

### AP-20260904-98 — Form dumps, crumbs, and outline stay jailed text
- Root cause: HxPage heroes sat on Settings/Telegram/Fleet/Skills/Git still using inline `style={{ color }}` dumps; Design home kept Claude `CHOOSE A TEMPLATE`; editor crumbs were inert; go-to-symbol tempted a new `fs:stat` IPC or HTML outline labels.
- Bad shape: `style={{ color: 'var(--muted)' }}` walls; `CHOOSE A TEMPLATE`; crumb spans with no jail; `homeai:fs:stat`; `dangerouslySetInnerHTML` on outline hits.
- Good shape: `.hx-form` / `.hx-card` / `.hx-hint`; Settings `hx-rail` Trust/Keys/Hardware/Telegram/Visual; Design kinds as Hex chips; `takeCrumbPrefix` + `treeFocus` via existing `list()`; `takeBufferOutline` text nodes; no new IPC.
- Grep / symbols: `hx-form`, `hx-card`, `takeCrumbPrefix`, `takeBufferOutline`, `CHOOSE A TEMPLATE`, `homeai:fs:stat`, `dangerouslySetInnerHTML`
- Regression: T-105 `packages/runtime/src/hex-chrome.test.mjs`
- Source: remaining IDE form+editor UX 2026-09-04

### AP-20260904-99 — GGUF lands as `.partial` then rename, never a torn dest
- Root cause: first-run download wrote the Hugging Face blob straight onto `Qwen3.5-2B-Q8_0.gguf`. A killed fetch left a too-small file that later `Load 2B` treated as the model.
- Bad shape: `createWriteStream(plan.dest)` then `stat.size < min` throw, dest still there; `sha256File('/etc/passwd')`.
- Good shape: `takePartialDest` + Range `takeRangeHeader` + size floor + `checksumMatches` via `takeGgufReady`; `sha256File` only hashes `*.gguf` / `*.gguf.partial`; unlink torn; rename last. Eliza gpu-vision shape, Hex helpers.
- Grep / symbols: `takePartialDest`, `takeGgufReady`, `sha256File`, `homeai:model:download`
- Regression: T-107 `packages/runtime/src/pack-chrome.test.mjs`
- Source: consumer 1.0 GGUF download 2026-09-04

### AP-20260904-100 — Prod Electron scripts keep Chromium sandbox on
- Root cause: `npm run ide` / `preview` / `telegram` prefixed `ELECTRON_DISABLE_SANDBOX=1`, so the operator path never proved `sandbox: true`.
- Bad shape: `ELECTRON_DISABLE_SANDBOX=1 electron .` on ide/preview/telegram/pack/release.
- Good shape: only `dev` (HMR) disables sandbox; `releaseScriptsOk` fails any other listed script; `createWindow` `sandbox: true` / `webviewTag: false`.
- Grep / symbols: `ELECTRON_DISABLE_SANDBOX`, `releaseScriptsOk`, `sandbox: true`
- Regression: T-109 `packages/runtime/src/electron-pack.test.mjs`
- Source: consumer 1.0 pack 2026-09-04

### AP-20260904-101 — Preload is `homeai` only; renderer XSS cannot reach extra IPC
- Root cause: a second `exposeInMainWorld` or `window.ipcRenderer` would let a renderer XSS invoke arbitrary `ipcMain`.
- Bad shape: `exposeInMainWorld('electron')`; `window.ipcRenderer`; `dangerouslySetInnerHTML` on Onboard/About diagnostics.
- Good shape: `takePreloadBridge` — only `homeai`; text nodes; diagnostics go through `publicDiagnostics` (no tokens/paths).
- Grep / symbols: `exposeInMainWorld`, `takePreloadBridge`, `publicDiagnostics`, `dangerouslySetInnerHTML`
- Regression: T-108 T-109 `packages/runtime/src/pack-chrome.test.mjs` `electron-pack.test.mjs`
- Source: consumer 1.0 E-02 2026-09-04

### AP-20260904-102 — Hunt diffs without an AP or test fail CI
- Root cause: editing `hunt-*` / `full-stack-hunt-prevent` with no prevent artifact repeats the incomplete-hunt loop.
- Bad shape: skill payload edit, no `anti-patterns.md` / `.test.mjs` in the same diff.
- Good shape: `takeHuntPreventDiff` + `scripts/assert-hunt-prevent.mjs` on CI `git diff HEAD~1`.
- Grep / symbols: `takeHuntPreventDiff`, `assert-hunt-prevent`, `AP-\d{8}`
- Regression: T-108 `packages/runtime/src/pack-chrome.test.mjs`
- Source: consumer 1.0 E-04 2026-09-04

### AP-20260904-103 — Fresh workspace must seed `RAG/library/ROADMAP.md`
- Root cause: packaged first-run folder had no library tree; Library pane and `repo-library` assumed ROADMAP exists.
- Bad shape: open folder with empty tree; skip seed; no ROADMAP.
- Good shape: `takeLibraryStub(day)` + `seedLibraryIfMissing` on boot and `openFolder`; never write outside `RAG/library/`.
- Grep / symbols: `takeLibraryStub`, `seedLibraryIfMissing`
- Regression: T-106 `packages/runtime/src/app-roots.test.mjs`
- Source: consumer 1.0 E-03 2026-09-04

### AP-20260905-1 — Workbench chrome is tokens; first-run is not a second product
- Root cause: titlebar / llama / About still used raw `#181818` / `#1e1e1e` while Settings already used `--bg-raise` / `--bg-panel`. A new HxPage first-run sheet would replace the Hex workbench the operator already uses.
- Bad shape: `.titlebar { background: #181818 }`; Onboard overlay covering the workbench; `dangerouslySetInnerHTML` on About.
- Good shape: chrome shells use `var(--bg-raise)` / `var(--bg-panel)`; About is `about-pop hx-card` + `hx-row`; WorkbenchShell never mounts an Onboard overlay; folder/GGUF/Telegram stay Settings; unpackaged `takeOnboardNeeded` is false.
- Grep / symbols: `.titlebar`, `.llama-pop`, `.about-pop`, `about-pop hx-card`, `from './Onboard'`, `takeOnboardNeeded`
- Regression: T-111 `packages/runtime/src/hex-chrome.test.mjs`
- Source: refine existing Hex workbench 2026-09-05

### AP-20260905-2 — Sandboxed renderer cannot parse ESM preload
- Root cause: `webPreferences.sandbox: true` loads preload through Chromium's sandbox bundle, which rejects `import` in `out/preload/index.mjs`. `window.homeai` stays undefined (`gitDiff` / `thinkList` throw).
- Bad shape: `"type": "module"` electron-vite preload emitting `.mjs` while `sandbox: true`.
- Good shape: preload `formats: ['cjs']` + `entryFileNames: 'index.js'`; `createWindow` joins `../preload/index.js`; keep `sandbox: true` and do not put `ELECTRON_DISABLE_SANDBOX` on `ide`.
- Grep / symbols: `preload/index.js`, `formats: ['cjs']`, `Unable to load preload script`
- Regression: T-112 `packages/runtime/src/electron-dev-boot.test.mjs`
- Source: Hex workbench launch 2026-09-05

### AP-20260905-3 — Agents grid must not collapse the chat thread
- Root cause: `.agents-body` used `220px 1fr 240px` (and Stage `200px 1fr 280px`). In a 420–640px chat dock those fixed columns ate the `1fr` thread, so replies vanished while the composer (a sibling of the grid) still spanned the dock.
- Bad shape: always-on 3-col agents grid; `@container (min-width: 900px)` forcing `.agents-bg { display: block }`; `.chat-log .hx-empty { min-height: 280px }`; cowork leaving an empty editor `1fr`.
- Good shape: default grid-area `thread`; sessions/bg only at container breakpoints; `takeEditorColumn` is off for Chat and Cowork even with leftover tabs; composer `flex-shrink: 0`; chat log `::before` spacer + bubble cards.
- Grep / symbols: `takeEditorColumn`, `grid-template-areas: "thread"`, `data-editor`, `data-route`
- Regression: T-113 `packages/runtime/src/pane-route.test.mjs`
- Source: operator chat dock 2026-09-05

### AP-20260905-4 — One owner per workbench slot
- Root cause: list activities mounted `listOnly` + full `HxPage` while chat stayed open; Agents sessions appeared at 480px dock width. Persisted `chatW: 720` squeezed Maps; transparent pill backgrounds read as glass.
- Bad shape: unused `data-list`; Maps center wraps `HxPage`; Stage floor 640px chat on list activities; `.sess-pills button { background: transparent }`.
- Good shape: `takeSlots` / `takeChatPx`; `[data-sessions='off']` forces thread-only Agents; Maps center is `maps-wrap` canvas; panes use `--bg-raise` / `--bg-panel` + `isolation`.
- Grep / symbols: `takeSlots`, `takeChatPx`, `data-sessions`, `maps-wrap`
- Regression: T-114 `packages/runtime/src/pane-route.test.mjs`
- Source: operator Maps screenshot 2026-09-05

### AP-20260905-5 — Harvest backends only; never auto-unjail
- Root cause: AI Resources include DesktopCommander (host FS/process), GitMCP (`gitmcp.io`), ScrapeGraph (Playwright egress), and Code IDE UI with decomp lineage. Copying them into starter or renderer would replace Hex chrome and skip the jail.
- Bad shape: `uvx blender-mcp`; `starterMcpServers` always-on; renderer `pack` string passed through; `dangerouslySetInnerHTML` from foreign UIs.
- Good shape: `RESOURCE_HARVEST` kinds; `takeMcpEnableOpts` own-key `pack === 'blender'`; local `uv --directory`; pack exclude `AI Resources/**`.
- Grep / symbols: `RESOURCE_HARVEST`, `takeMcpEnableOpts`, `skip-unjail`, `blender-mcp-main`
- Regression: T-115 `packages/runtime/src/resource-harvest.test.mjs`
- Source: occupancy+harvest ship 2026-09-05

### AP-20260905-6 — Perceive pack must not ingest secrets; promote is Ask
- Root cause: `data/` was skipped entirely so anti-patterns never entered FTS, while a post-remember hook that wrote recipes would skip Gate 0.
- Bad shape: remove `data` from `SKIP_DIR`; `rag_write` recipes from REMEMBER; HTML in perceive lines.
- Good shape: walk only `data/bug-memory`; `ragIngestAllowed`; `promoteDiscovery` `apply: false` under `RAG/discoveries/*.promote.md`.
- Grep / symbols: `ragIngestAllowed`, `promoteDiscovery`, `kindFromPath` anti-pattern
- Regression: T-116 `packages/runtime/src/compiler-os.test.mjs`
- Source: Hex 2028 Wave A

### AP-20260905-7 — autoRun hints cannot skip too-destructive; starter Trust is not skip-unjail
- Root cause: `autoRun` was persisted and unused; Enable MCP left every call Ask, tempting a blanket `*:*` allowlist including DesktopCommander.
- Bad shape: `allow_instructions` skip Judge deny; Trust starter merges forbidden ids.
- Good shape: `instructionAuthorization` honors autoRun after autoReview blocks; `starterTrustRules` only `MCP_STARTER_IDS`; Stop via `registerKernelRun`.
- Grep / symbols: `instructionAuthorization`, `starterTrustRules`, `stopKernelRun`, `COMPILER_OS_PORTS`
- Regression: T-120 T-117
- Source: Hex 2028 Wave A–B

### AP-20260905-8 — DAP/LSP paths and chrome analog stay jailed
- Root cause: evidence files and outline paths from the renderer could walk `..` / `/etc`; DevTools MCP names could smuggle DesktopCommander.
- Bad shape: `writeFile(data/debug/${user})`; `chromeDevtoolsDepth('desktopcommander_fs')` true.
- Good shape: `dapEvidenceRel` slug; `takeDapEvidence` null on `/etc/`; chrome analog allowlist.
- Grep / symbols: `takeDapEvidence`, `lspQuery`, `chromeDevtoolsDepth`
- Regression: T-118
- Source: Hex 2028 Wave C

### AP-20260905-9 — Scene/DNA/harvest cannot unjail or clone
- Root cause: computer-use and Phase 5 DNA look like “write anywhere / copy Resources”.
- Bad shape: Scene IR under workspace root; DNA `.think.md`; new harvest kind `skip-unjail` as a port.
- Good shape: `data/scene/<id>.json`; `RAG/plans/dna-*.md`; `harvestPortKind` analog|port|next only.
- Grep / symbols: `sceneIrJail`, `dnaPlanFromRecipes`, `harvestPortKind`
- Regression: T-119 T-120
- Source: Hex 2028 Wave D

### AP-20260905-10 — Bug-memory walk must stay under `data/`
- Root cause: `SKIP_DIR` special-cased `data` then walked `join(root, 'bug-memory')` (workspace sibling) instead of `data/bug-memory`.
- Bad shape: `walkFiles(join(root, bugMemoryDirName()), acc)` when `name === 'data'`.
- Good shape: `walkFiles(join(root, name, bugMemoryDirName()), acc)`; ingest still `ragIngestAllowed`.
- Grep / symbols: `walkFiles`, `bugMemoryDirName`, `ragIngestAllowed`
- Regression: T-116 `packages/rag/src/index.ts` join(root, name, bugMemoryDirName())
- Source: Hex 2028 Wave A hunt

### AP-20260905-11 — ACP worktree names cannot keep `..`
- Root cause: `gitWorktreeAdd` only swapped non-alnum to `_`, so `../Secrets` became `.._Secrets`.
- Bad shape: `name.replace(/[^a-zA-Z0-9._-]/g, '_')` as a folder segment.
- Good shape: `acpWorktreeName` then `.cursor/worktrees/<slug>`.
- Grep / symbols: `acpWorktreeName`, `gitWorktreeAdd`
- Regression: T-116 `packages/runtime/src/git.ts`
- Source: Hex 2028 Wave D hunt

### AP-20260905-12 — Frozen tools must deny mid-turn MCP reload
- Root cause: `freezeToolList` snapped names at forge start, then `reloadMcp` could replace `mcpTools` while the turn still ran.
- Bad shape: `reloadMcp()` during `kernelRunCount() > 0`; `runTool` without `filterFrozenTools`.
- Good shape: skip non-force reload while a kernel run is live; deny calls not in the frozen name list.
- Grep / symbols: `filterFrozenTools`, `kernelRunCount`, `reloadMcp(force`
- Regression: T-116 T-117 `apps/desktop/src/main/index.ts`
- Source: Hex 2028 Wave B hunt

### AP-20260905-13 — Mini App Stop owner is `miniapp`, not telegram
- Root cause: Mini App `startJob` sent `surface: 'telegram'`, so `registerKernelRun` / `gatewayContinuity` lied about the door.
- Bad shape: `surface: 'telegram'` in `miniapp-server.ts`.
- Good shape: `kernelSurface('miniapp')`; Stop still `stopKernelRun`.
- Grep / symbols: `kernelSurface`, `surface: 'miniapp'`
- Regression: T-116 `miniapp-server.ts`
- Source: Hex 2028 Wave A hunt

### AP-20260905-14 — Workspace graph must not walk `AI Resources` or `..`
- Root cause: a structural index that walks the whole workspace would ingest analog copies and escaped paths.
- Bad shape: `readdir` from workspace root; keep `path: '../secrets'`; import `../x` as a caller.
- Good shape: walk `packages/` + `apps/` only; `takeStructuralGraph` drops `..` and `AI Resources`; `queryGraph('../etc')` is empty.
- Grep / symbols: `GRAPH_ROOTS`, `buildStructuralGraph`, `queryGraph`, `refreshWorkspaceGraph`
- Regression: T-117
- Source: Hex 2028 analog graph hunt

### AP-20260905-15 — Harness VERIFY flags are own-key, not evolve
- Root cause: persisting `verifyOk` via `evolve` would require auto-review and `__proto__` could flip routing.
- Bad shape: `mintHarness(..., { evolve: true })` to store VERIFY; JSON `__proto__.verifyOk`.
- Good shape: `takeHarness` own keys `verifyOk`/`localOk`/`hasSidecar`; persist is not evolve.
- Grep / symbols: `persistOutcomeHarness`, `takeHarness`, `mintHarness`
- Regression: T-117
- Source: Hex 2028 outcome persist hunt

### AP-20260905-16 — DNA scaffold cannot land as `.think.md`
- Root cause: `plan_write` DNA looks like Think handoff; a README next to the plan could reuse `thinkRel`.
- Bad shape: `RAG/plans/dna-x.think.md` or files outside `RAG/plans/`.
- Good shape: `dnaScaffoldFromRecipes` `apply: false`; plan `dna-*.md` plus `RAG/plans/dna-<slug>/README.md`.
- Grep / symbols: `dnaScaffoldFromRecipes`, `plan_write`
- Regression: T-119
- Source: Hex 2028 DNA scaffold hunt

### AP-20260905-17 — Design fidelity is a text line, not HTML
- Root cause: mesh/fidelity strings concatenated into tool content could carry markup from intent.
- Bad shape: `fidelity <b>mesh</b>` or `url()` in the note.
- Good shape: `designFidelityReport` through `stripLine`; append on `design_patch` content.
- Grep / symbols: `designFidelityReport`, `design_patch`
- Regression: T-119
- Source: Hex 2028 fidelity hunt

### AP-20260905-18 — DNA codegen cannot turn recipe text into executable markup
- Root cause: recipe metadata and mechanism lines become generated HTML, so raw interpolation would cross a data-to-code boundary.
- Bad shape: full recipe body in `innerHTML`; external scripts; caller-selected output filenames.
- Good shape: own-key front matter, `stripLine` + HTML escaping, fixed `index.html`/`app.css`/`app.js`, CSP, static JS using `textContent`.
- Grep / symbols: `takeRecipeMeta`, `takeRecipeMechanism`, `dnaAppRel`, `emitWebStatic`
- Regression: T-121
- Source: Hex 2028 DNA compiler hunt

### AP-20260905-19 — CapabilityIR must validate before any emitter runs
- Root cause: treating generated JSON as trusted lets mismatched recipe ids, unknown profiles, or arbitrary paths steer code generation.
- Bad shape: emitter accepts raw LLM JSON; artifact paths come from IR strings; source recipes and capabilities can diverge.
- Good shape: `takeCapabilityIr` own-key validation + fixed schema/enums; emitters derive only allowlisted paths; host rechecks `dnaArtifactAllowed`.
- Grep / symbols: `takeCapabilityIr`, `compileCapabilityIr`, `emitWebStatic`, `emitCliRunner`, `dnaArtifactAllowed`
- Regression: T-122
- Source: Hex 2028 CapabilityIR hunt

### AP-20260905-20 — Generated local APIs are not trusted merely because they are local
- Root cause: a generated server can accidentally bind publicly or accept unbounded, shape-free bodies.
- Bad shape: `listen(port)` / `0.0.0.0`; permissive CORS; raw JSON merge; no body or header timeout.
- Good shape: manual start on `127.0.0.1`; JSON-only 8 KiB body; own-key `{action:'compose'}`; no CORS; request/header limits.
- Grep / symbols: `emitApiLoopback`, `takeComposeRequest`, `MAX_BODY`, `createDnaApiServer`
- Regression: T-123 live ephemeral-port test
- Source: Hex 2028 loopback API emitter hunt

### AP-20260905-21 — Generated desktop renderers cannot inherit Node or generic IPC
- Root cause: an Electron wrapper around generated HTML can turn content bugs into local code execution.
- Bad shape: `nodeIntegration: true`; ESM preload under a sandbox; expose `ipcRenderer`; remote navigation/window creation.
- Good shape: `.cjs` preload with a frozen CapabilityIR DTO only; context isolation + sandbox; deny permissions, navigation, windows, and webviews.
- Grep / symbols: `emitDesktopShell`, `dnaDesktopRel`, `desktop-bridge/0.1`, `setWindowOpenHandler`
- Regression: T-124 preload execution + generated-main invariant checks
- Source: Hex 2028 desktop emitter hunt

### AP-20260905-22 — TypeScript intelligence is main-process IPC, not a renderer LanguageService
- Root cause: a project-aware TS host can `readFile` any path the LanguageService asks for; renderer-owned payloads and Monaco workspace edits would skip the workspace jail and checkpoint review.
- Bad shape: `diagnostics(payload)` with no `takeTsRequest`; Monaco `provideRenameEdits` writes other files; renderer imports `packages/ts-intel` (Node `fs`).
- Good shape: `takeTsRequest` own-key DTO; host `jail`/`readAllowed`; rename `commitTsEdits` → `writeFileSafe` + `changes.record`; renderer alias to `renderer-import-denied.mjs`.
- Grep / symbols: `takeTsRequest`, `commitTsEdits`, `homeai:ts:rename`, `registerEditorOpener`
- Regression: T-126 T-127
- Source: High-end TS IDE wave 2 hunt

### AP-20260905-23 — Node Inspector is a loopback child_process, never a PTY
- Root cause: mixing Inspector with `node-pty` would share the operator shell, inherit `NODE_OPTIONS`/secrets, and bind `0.0.0.0`.
- Bad shape: `pty.spawn`; `--inspect=0.0.0.0`; evaluate `process`/`require`; launch `/etc/passwd`.
- Good shape: `child_process.spawn` `--inspect-brk=127.0.0.1:port`; `takeDebugLaunch`/`takeDebugEval`/`takeInspectWs`; primitive-only evaluate; isolated `stop()` that does not call `disposePtys`.
- Grep / symbols: `takeDebugLaunch`, `takeDebugEval`, `NodeDebugHost`, `homeai:debug:start`
- Regression: T-128 T-129
- Source: High-end TS IDE wave 4 hunt

### AP-20260905-24 — Git gutter IPC is pathspec-jailed; decorations are CSS classes
- Root cause: renderer-supplied diff paths or HTML gutters turn editor chrome into XSS or extra-root reads.
- Bad shape: `git diff` with a raw renderer path; `dangerouslySetInnerHTML` for hunks; overview colors copied from VS Code blue.
- Good shape: `gitPathspecs` + `parseGitLineChanges`; `homeai:git:lines` empty on jail fail; `.git-gutter-add` / `.debug-bp` CSS; Keep/Undo stays explicit for commits.
- Grep / symbols: `parseGitLineChanges`, `gitLineChanges`, `glyphMarginClassName`
- Regression: T-129 T-130
- Source: High-end TS IDE wave 5 hunt

### AP-20260905-25 — Workspace-wide TS work is a worker with an internal cancel seq
- Root cause: LanguageService walks on the Electron main thread freeze IPC; a renderer-supplied cancel token or worker root would skip the jail or abort someone else's request.
- Bad shape: `workspaceSymbols(payload)` on main; `homeai:ts:cancel` with a renderer `seq`/`root`; Worker `eval`; workerData from the renderer.
- Good shape: `workspaceSymbolsIsolated` + `worker_threads` next to `ts-intel`; cancel only bumps an internal generation; worker root is the constructor jail; `takeTsQuery` on both sides; overlay paths go through `update` jail.
- Grep / symbols: `workspaceSymbolsIsolated`, `tsWorkspaceWorkerPath`, `homeai:ts:cancel`, `primeFromConfig`
- Regression: T-131 T-127
- Source: High-end TS IDE leftover hunt

### AP-20260905-26 — Status and bottom tabs must be keyboard-honest about Checks
- Root cause: span tabs without Enter/Space and a compiler-only footer hide QA records and trap keyboard users on Checks/Runtime.
- Bad shape: click-only `span` tabs; footer `No problems` while `qa.length > 0`.
- Good shape: `term-tab` buttons with `activateByKey`; footer counts `w.qa.length`; Checks still Hex (not Problems).
- Grep / symbols: `activateByKey`, `aria-label="Bottom panels"`, `w.qa.length`
- Regression: T-103
- Source: High-end TS IDE leftover hunt

### AP-20260905-27 — Inspector evaluate never retries without throwOnSideEffect
- Root cause: a side-effect-safe CDP evaluate that throws can be retried without the guard, so a jailed identifier expression still runs getters/`process` via the Inspector.
- Bad shape: `catch { evaluateOnCallFrame without throwOnSideEffect }`.
- Good shape: one `Debugger.evaluateOnCallFrame` with `throwOnSideEffect: true`; reject on throw; `takeDebugEval` still denies `process`/`require`.
- Grep / symbols: `throwOnSideEffect`, `evaluateOnCallFrame`, `takeDebugEval`
- Regression: T-128
- Source: High-end TS IDE leftover hunt

### AP-20260905-28 — File TS reads join the worker; smoke skips non-SUID sandbox
- Root cause: diagnostics/completions on Electron main freeze IPC; smoke treating a non-SUID `chrome-sandbox` as a product failure tempts `ELECTRON_DISABLE_SANDBOX` on `ide`.
- Bad shape: sync `languageIntel().diagnostics` in IPC; smoke `exit 1` on missing smoke.json from setuid sandbox; `ELECTRON_DISABLE_SANDBOX` on the ide script.
- Good shape: `callIsolated` allowlisted methods; rename stays on main + `commitTsEdits`; smoke `takeChromeSandboxSkip` exit 0; ide script stays sandboxed.
- Grep / symbols: `callIsolated`, `takeTsCallMethod`, `takeChromeSandboxSkip`
- Regression: T-131 T-132 T-109
- Source: High-end TS IDE leftover hunt

### AP-20260907-1 — Flex/grid chrome must shrink, then scroll
- Root cause: `body { overflow: hidden }` plus `1fr` as `minmax(auto, 1fr)` and `flex: 1` without `min-height: 0` lets lists, bottom tabs, status, and the composer grow past the window. Page/list activities also stacked a `.pane-tab` title on top of HxPage / HxSideHead. Page activities used `display: none` on sidebar while keeping a 6-column `0px 0px` template, so auto-placement put HxPage in a 0px track and left a black void beside chat.
- Bad shape: `.workbench` rows `30px 1fr 22px`; `.term-tabs` nowrap with no `overflow-x`; `.tree` / `.side-list` / `.notes-list` `flex: 1` without `min-height: 0`; `.agents-foot` not `flex-shrink: 0`; always-on `.tabs` for Board/Notes/Browser; `[data-page='on'] .body` still `activity 0 0 1fr split chat` after `display: none` on sidebar.
- Good shape: `.workbench` / Focus use `minmax(0, 1fr)`; `.term-tabs { overflow-x: auto }`; sidebar lists `min-height: 0`; composer/status `flex-shrink: 0` + status ellipsis; hide `.tabs` on `[data-page]`, `[data-list]`, `[data-activity='browser']`. Page grid is `activity 1fr split chat` (cowork `activity 1fr`) so it matches visible children. Titles stay React text nodes.
- Grep / symbols: `minmax(0, 1fr)`, `overflow-x: auto`, `min-height: 0`, `[data-activity='browser'] .tabs`, `side-input`, `[data-page='on']:not([data-studio='on']) .body`
- Regression: T-133 `packages/runtime/src/hex-chrome.test.mjs`
- Source: workbench UX polish 2026-09-07

### AP-20261001-1 — Fresh clone must name the command that actually opens the window
- Root cause: README told every machine to run `npm run ide`. On Linux the Chromium sandbox helper is often not setuid, so that command never shows a window, and putting `ELECTRON_DISABLE_SANDBOX` on `ide` would break the sandbox rule.
- Bad shape: one install line `npm run ide` for all platforms; `ide` script sets `ELECTRON_DISABLE_SANDBOX`.
- Good shape: `takeInstallPlan` — Node 22, native modules, Electron; Linux without setuid uses `npm run dev`; otherwise `npm run ide`. GGUF stays a Settings download. `npm run doctor` prints that plan.
- Grep / symbols: `takeInstallPlan`, `npm run doctor`, `scripts/doctor.mjs`
- Regression: T-134 `packages/runtime/src/pack-chrome.test.mjs`
- Source: install path 2026-10-01



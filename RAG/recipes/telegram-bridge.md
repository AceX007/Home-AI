---
id: rec-telegram-bridge
title: Telegram is a pane on the same kernel
stack: electron
status: refined
---

# Telegram is a pane on the same kernel

## Shape (do this)
- Mechanism: long-poll in Electron main; one conversation store; one HOME console card edited in place; Mini App is a loopback glass UI on the same `startKernelJob`.
- Good code shape: `routeTelegram` then `isPeer(from.id)`; `formatConsole` / `stageCard` plain text (no `parse_mode`); `progressCard` from `publicToolCall`; dock allowlist (`dockKind` Stage/Trust); pairing SHA-256 + TTL, private only; Mini App `validateTelegramInitData` + `isPeer`; bind `127.0.0.1`; `takeMiniAppUrl` for menu/web_app.
- Do not: second agent; webhook; HTML/MarkdownV2 on model text; treat `chat.type` as auth; dump tool arguments or the bot token; trust empty initData on a tunneled loopback socket.

## Ports (same idea, other systems)
- Web/API: same thread DTO + job stream over POST `/api` + pulse; Glance/Think/inbox are more actions on the same door, not new hosts
- Desktop/IPC: `homeai:telegram:*` + `homeai:miniapp:*` + `sendChunk` → `pushMiniChunk`
- Mobile: Telegram Mini App + glass console
- Worker/CLI: `HOMEAI_HEADLESS=1` same poller + Mini App listener

## Curiosity (open)
- Why not a standalone bot? Two llama/RAG processes fight and chats fork.
- What breaks at 10x edits? Telegram edit cap — debounce 800ms. Mini App pulse is 800ms client poll of a remembered run.
- Why HMAC instead of a cookie? Telegram already signed initData; a cookie would be a second session to steal.

## Weaknesses / bugs / holes
- Pairing bypass is the real hole (AP-20260828-19). AuthZ in the handler.
- Thread/job ids from callbacks (AP-SEED-02).
- Prompt text is untrusted; tools still `decideTool` (hunt-llm-ai).
- Race on update_id — `rememberUpdate` ring (AP-SEED-05).
- Headless without `ensureKernelReady` ships `mcpTools=[]` (AP-20260828-21) — phone looks like a second, weaker agent.
- `/tools` must never print MCP URLs or headers (same AP).
- Concurrent `reloadMcp` from Settings + `/mcp` is not locked; last load wins.
- Group chat is a public room: progress cards and summaries are visible to members. AuthZ is still the paired user (AP-20260828-22).
- Privacy Mode off + unpaired chatter: we still ignore non-peer text; do not ingest the room into `chatLog`.
- Mini App tunnel makes every request look like loopback (AP-20260828-24). Loopback preview is off when `miniAppUrl` is set.
- `setChatMenuButton` with an http non-loopback URL is rejected by Telegram and by `takeMiniAppUrl`.
- GET `/` is unauthenticated on purpose (HTML/CSS/JS). Crown jewel is POST `/api`.
- Inbox drop without magic/ext jail is a stored XSS / path write (AP-20260828-25). Desktop IPC was the sibling.
- `implement` must use `thinkRelFromOpen` only — a raw `thinkPath` is IDOR into the tree (AP-20260828-20).
- Question answers come from hub options by index, not free text from an unpaired field when `pick` is set.
- Phone mind picker without an allowlist is mass-assign of `defaultProvider` (AP-20260829-27).
- Desktop “cursor” chat-completions is not Cloud Agents. Telegram `cursor` must call `cursorLaunchAgent` and poll `cursorJobSummary` only.
- `ensureLlama` errors include the model path — `publicMindError` before any glass card.
- `getFile.file_path` is a Telegram-relative path; still jail `..` before fetch; bytes go through `saveInboxSafe`.
- Voice/audio inbox uses the same 2MB + magic jail; video notes stay out (AP-20260904-66).
- Fleet from the phone uses the same `createFleetHost` ops as the Fleet pane. Clone is https-only. Bot tokens stay on the PC. `removeSub` must save `subscribers: subs` (AP-20260904-67).
- IDE session pane is the same trust boundary as Mini App Pulse: never return `telegram.key` or `pairing.hash` (AP-20260901-28).
- Phone Stage without an allowlisted `takeNav('stage')` would interpolate dock words into callbacks (AP-20260901-40).
- Glance that bumps think to `done` would lie after a FAULT forge (AP-20260901-39 sibling).

## Prevent / robust delivery
- Tests: `telegram-auth.test.mjs`, `telegram-router.test.mjs`, `telegram-progress.test.mjs`, `telegram-chrome.test.mjs`, `conversations.test.mjs`, `tool-surface.test.mjs`, `telegram-initdata.test.mjs`, `miniapp-hub.test.mjs`, `inbox.test.mjs`, `mind.test.mjs`, `telegram-api.test.mjs`, `telegram-session.test.mjs`, `fleet.test.mjs` T-84
- Deny-by-default: `isPeer(from.id)` in DM and group; pair only in private; RAG trees only for skills/rules; Mini App HMAC + pairing; no loopback bypass once a public URL is saved; Stage/Trust callbacks only via `nav:go:` + `takeNav`
- One surface function: `toolsForMode` for desktop IPC, Telegram `/do`, and Mini App Ship
- Hunt layers: api, jobs, ipc, client

## Refinement log
- 2026-08-28 — first ship. Worked: store + pairing + progress DTO. Next: photos to inbox; bump think to done from Telegram after verify.
- 2026-08-28 — full PC tools + MCP on `/do` `/agent` `/debug` `/multitask`. Worked: shared `toolsForMode` + boot-before-poller. Next: lock `reloadMcp`; optional photos to inbox.
- 2026-08-28 — DM + group/supergroup/topics. Worked: signed `telegramChatId`, `groupAddressed`, pair-in-DM-only, group thread ≠ Home. Next: voice; photos to inbox.
- 2026-08-28 — glass console. Worked: HOME chrome, Pulse/Stack/Board dock, Ship/Deep/Halt, typing pulse, no parse_mode. Next: photos to inbox.
- 2026-08-28 — Mini App glass. Worked: HMAC initData, `127.0.0.1:18766`, same `startKernelJob`, menu button + `/app`. Failed if we treated tunnel sockets as a local session. Next: photos to inbox; optional Cloudflare/ngrok helper in Settings (still user-owned URL).
- 2026-08-29 — Mini App power. Worked: Glance/Mind/Think/Threads, steer, question chips, implement-from-think, jailed inbox (fixed desktop IPC sibling). Next: voice notes; bump think to `done` after verify from the phone.
- 2026-08-29 — Enterprise mind. Worked: `/mind` + Mini App chips (local / openai / openrouter / cursor); Pulse shows llama + key flags (never secrets); Cursor Cloud Agents from the phone via `cursorLaunchAgent` + jailed poll; implement-from-think prefers keyed cloud; llama warm on local/think boot; bot photos → `saveInboxSafe`. Failed if we treated desktop “cursor” as OpenRouter chat. Next: voice notes; bump think to `done` after verify.
- 2026-09-01 — Manage console + IDE session pane. Worked: `/manage` + Manage dock; shared `takeTelegramSession` (no token/hash); workbench Telegram activity pairs, restarts poller, sets mind, halts phone jobs. Next: voice notes; bump think to `done` after verify.
- 2026-09-01 — IDE chrome pulse. Worked: titlebar/status share `takeChromePulse` (count-only MCP, no token). Next: voice notes; bump think to `done` after verify.
- 2026-09-01 — Phone Stage/Trust chrome. Worked: `stageCard` + `/stage` + dock Stage/Trust on `nav:go:`/`takeNav`; Mini App Glance labeled Stage with think Implement + Allow-Deny; FAULT on error chunks; Trust line is Ask · no Landlock. Failed if we had minted Hunt/Verify labels or claimed Landlock. Next: voice notes; think-done-from-phone still kernel-side.
- 2026-09-01 — Wave T Go strip on the phone. Worked: dock New + Skills; `takeNav('skills')`; help `/new` `/chats`; Mini App Skills sheet via `takeMiniBody` skills. Next: voice notes; think-done-from-phone still kernel-side.
- 2026-09-04 — `/help` SHIP line is packs, not “every MCP”. `/do` already used `toolsForMode`. Next: think-done-from-phone still kernel-side.
- 2026-09-04 — Voice/audio drops into `data/inbox`. `/fleet` clone/add/start/sub on the same host ops as the Fleet pane. Tokens stay on the PC. Next: think-done-from-phone still kernel-side.
- 2026-09-04 — Telegram `startRun` remembers Mini pulse (`tg_*`). Free-chat uses profile mode (agent/debug/plan go live). Mini `mode` persists. Glance paints stripped `phases`. Health/Cursor/Llama + fleet restart on glass. Inbound STT when whisper exists. Next: think-done-from-phone still kernel-side.
- 2026-09-04 — Glance `stageCard` takes jailed `autoReviewLine` from `miniPulse` chunks (same helper as `/stage`). Hunt/Verify/Critic phases unchanged. Next: think-done-from-phone still kernel-side.
- 2026-09-04 — Feature refine. Worked: Telegram activity keeps the page column in Stage. Home thread name stays Home; product chrome is Hex AI. Next: think-done-from-phone still kernel-side.

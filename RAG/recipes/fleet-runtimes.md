---
id: rec-fleet-runtimes
title: Jailed multi-repo stacks, not a renderer shell
stack: electron
status: refined
---

# Jailed multi-repo stacks, not a renderer shell

## Shape (do this)
- Mechanism: a Fleet pane registers repos under `Repos/` or `data/fleet/clones/`, starts them with **fixed recipe argv** (`python -m app.main` / `npm start` / `npm run dev`), and keeps bot/SMTP secrets in `data/secrets/fleet/`.
- Good code shape: `takeRepoRel` + `recipeSpawn` + `gitCloneHttpsArgv`; local forks via `nextCloneId` + `cloneOf` into `data/fleet/clones/<id>`; website `domain` via `takeSiteDomain` (hostname only); `publicSnapshot` never returns a token; SMTP host from `takeSmtpHop` (Proton Bridge `127.0.0.1:1025` or Tuta `smtp.tutanota.com:587`); broadcasts are plain text to an explicit subscriber list (cap 50/20).
- Do not: `exec` a renderer command string; `git clone` `file://` or `user:pass@`; dump `HUB_BOT_TOKEN` on IPC; send to scraped users; run a userbot farm from account sessions; `fetch`/`openExternal` a stored domain; import `fleet.mjs` from the renderer (it uses `node:fs`).

## Ports (same idea, other systems)
- Web/API: job runner with allowlisted image/cmd; secrets in a vault; subscriber table with opt-in; hostname field distinct from crawl URL
- Desktop/IPC: `homeai:fleet:*` including `cloneLocal` / `patchRepo` (this recipe)
- Mobile: same ops via `/fleet fork` + Mini App `fleet-fork` (`takeFleetCommand` / `takeMiniBody`); tokens still PC-only
- Worker/CLI: same `recipeSpawn` from a jailed cwd

## Curiosity (open)
- Why not PTY for stacks? A PTY is a human shell. Fleet is a supervisor with a closed argv table.
- What breaks at 10 clones? One child map in main; stop-all on quit. No docker claimed. `stackForest` orphans missing parents as roots.
- Why seed Link INFO? It already rotates hub links in-process; Fleet supplies tokens, clones, and subscriber announce.
- Why not copy domain on fork? A clone is a new stack; the hostname is an operator label, not inherited live traffic.

## Weaknesses / bugs / holes
- Recipe argv is not Landlock: the child can still `open()` the workspace (AP-20260904-55).
- `npm run dev` may bind a port the Ports pane does not list.
- Account sessions are stored, not driven — wiring MTProto would be a new hunt class.
- Email send talks SMTP; Proton Bridge must be running locally.
- `removeSub` used to save `subscribers` (undefined). Link: AP-20260904-67.
- Phone `/fleet token` is denied on purpose — tokens stay on the PC Fleet pane.
- Domain is a label; `169.254.169.254` can be stored but nothing fetches it (AP-20260904-80).
- Renderer duplicates `nestRepos` / `nextCloneSlug` so it never imports `fleet.mjs` (AP-20260904-81). Drift vs `stackForest` / `nextCloneId` is a test on both.

## Prevent / robust delivery
- Tests: `packages/runtime/src/fleet.test.mjs` T-73 T-84 T-94; `git-safe.test.mjs` clone argv; `telegram-router.test.mjs` `/fleet fork`; `telegram-initdata.test.mjs` `fleet-fork`
- Deny-by-default: id/rel/recipe/url/domain allowlists; `patchRepo` cannot set `rel`; no `shell: true`; `fleet-fork` null if `url` present
- Hunt layers: ipc, client, data, jobs

## Refinement log
- 2026-09-04 — first ship. Worked: Link INFO seed, clone https, bot token last4 DTO, announce template. Failed: none in unit tests (no live Telegram/SMTP). Next: health probe loop without treating leftover listeners as ours (sidecar sibling).
- 2026-09-04 — Telegram `/fleet` + Mini App Fleet sheet call the same host ops (clone/add/start/stop/sub). Fixed `removeSub`. Tokens still PC-only. Next: health probe loop without treating leftover listeners as ours.
- 2026-09-04 — Mini `fleet-add` infers website vs telegram-bot from rel and picks `npm-dev` / `python-app-main`. Next: health probe loop; do not fetch stored domains.
- 2026-09-04 — Feature refine. Worked: Stage layout no longer `0.28fr`s the Fleet pane. Tokens still PC-only. Next: health probe loop; do not fetch stored domains.

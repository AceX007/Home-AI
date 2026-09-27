# Honesty / do-not

- Do not copy Cursor proprietary bits from any `.deb`.
- Do not scrape ChatGPT or any website for API access.
- Do not store provider keys in git — they live in `data/secrets`.
- Do not dump grep into the parent context — PERCEIVE with explore first.
- Do not edit the frozen original workbench plan under `.cursor/plans/`.
- Local 2B is default. Cloud is muscle, never required.
- Match screenshot **feel** with public product surfaces (Electron, Monaco, xterm, npm/MIT). Do not reverse-engineer Cursor.

# Where we stand

Three-column workbench is **shipping**: explorer | plan/editor + terminal | Agents. Kernel loop, tools, RAG, modes, queue, checkpoints, plan renderer, and Agents-window chrome are in the build. The welcome plan `home_ai_workbench.plan.md` is the old v0 checklist — treat **this file** as the live queue.

**Chrome (screenshot):** Wave A landed — Review list, mini-diff hunks, shell captions, context ring, image paste, drag-resize, working menus, multi-pty, agent tab close, explorer git letters.

**Loop (works like Cursor):** Wave B in — Custom Mode, ring breakdown, checkpoint preview, Agent Review, Tab infill Esc, MCP list, cloud jobs, live `@` blobs.

Wave A, Wave B, and design language are in.

# Wave C (thin hang-ons)

- [x] Permissions editor in Settings (writes `data/permissions.json`)
- [x] Honor `.cursorignore` / ignore set on agent `fs_read` / `fs_list` / writes
- [x] Build from the open plan file
- [x] Agent Review · Deep (diff + RAG)
- [x] Sticky `/goal` badge
- [x] Worktrees in Source Control

# Wave D (trust boundary + hang-ons)

- [x] Per-file Stage / Unstage (git add/restore path-jailed)
- [x] Permissions save: http(s) net, no `*` terminal, no mass-assign
- [x] `browser_console` tool (ring buffer → `browser/captures/console.log`)
- [x] `code_outline` honors ignore; `shell:open` jailed

# Wave E (net allowlist + URL MCP)

- [x] `urlAllowed` matches origin (and optional path), not `startsWith`
- [x] URL / streamable-HTTP MCP (`McpServerCfg.url`) via `fetch`
- [x] Connect only if URL is on the net allowlist; `mcpToolAllowed` on tool calls
- [ ] UI `homeai:browser:navigate` stays operator-open (agent still uses `urlAllowed`)

# Wave F (Design Fabric Phase 0)

Blueprint: `AI Resources/Design-Modular-Blueprint.md`. Not a Claude Design clone.

- [x] DesignIR 0.1 on disk (`designs/default.design.json`)
- [x] RFC 6902 envelope, locks, stale revision, no HTML in text
- [x] Local canvas: density slider + direct text (0 model tokens while dragging)
- [x] Agent `design_get` / `design_patch` (scoped patches only)

# Wave G (approval detail + MCP reload)

- [x] `toolApprovalDetail` — search/click/type/worktree use real URL or git prefix
- [x] MCP list shows http URL (no headers); Reload after allowlist save

# Wave H (cloud jobs + DTCG ingest)

- [x] Cloud job list is summaries only; id allowlist; poll while open
- [x] DTCG 2025.10 file under `designs/` maps into DesignIR tokens (no remote `$value`)

# Wave I (Think → Implement)

- [x] Think mode: local 2B, perceive pack, `plan_write` `.think.md` only
- [x] Implement follows the artifact (cloud if keyed, else local); redact secrets

# Wave J (activity + Background)

Feel of a three-column Agents workbench (sessions | activity | background). Not a Cowork/Code clone.

- [x] Left session list from `w.chats` (`sessionPreview` strips markup)
- [x] Collapsible `Ran N commands` / `Edited file +N −M` via `groupActivity`
- [x] Right Background: forge phases, local 2B, tool rows, cloud summaries, running count
- [x] Renderer imports `activity.mjs` only (no runtime barrel / `node:fs`)

# Wave K (live tools + ff-only pull)

- [x] `publicToolCall` name-only before `runTool`; Background row `running` until ok/err
- [x] GitPane `Pull ff-only` — argv fixed, no renderer remote/ref

# Wave L (think chrome + code drafts)

- [x] Implement bumps `status: implementing` in main (`bumpThinkStatus`)
- [x] PlanDoc `.think.md` shows Think status + Implement/Resume
- [x] Code-tab CSS string persists per node id (`rememberCssDraft`)

# 10 To-dos

- [x] Wave A1 · Review: pending-file list (not only open first) + Keep/Undo per file
- [x] Wave A2 · Mini-diff: longer hunk, `# path +N −M` header, hover Keep/Undo stays
- [x] Wave A3 · Shell caption = actual `test_run`/`terminal_run` command, not generic "Ran tests"
- [x] Wave A4 · Context ring next to follow-up (system/tools/rules/RAG/chat buckets)
- [x] Wave A5 · Composer: paste image → `data/inbox/`; hide voice until it records
- [x] Wave A6 · Drag-resize sidebar, Agents column, and terminal height
- [x] Wave A7 · File / Edit / View menus that Open, Save, Close tab (not dead labels)
- [x] Wave A8 · Multi-pty: New Terminal, session list, click to focus
- [x] Wave A9 · Agent tabs: close ×, overflow, rename from first user line
- [x] Wave A10 · Explorer: indent guides + lucide file-type icons (no Cursor assets)

# Wave B (after A)

- [x] Custom Mode badge (skill sticks until dismissed); `Ctrl+/` cycles provider
- [x] Click context ring for token breakdown
- [x] Checkpoint timeline in the Agents transcript (restore preview)
- [x] Agent Review: local 2B on `git diff` (Quick hunks)
- [x] Prove Tab ghost text from local infill; Esc rejects
- [x] Mods pane lists loaded MCP servers
- [x] Cloud Agents job list/status in Agents
- [x] `@Terminals` `@Chats` `@git` blobs actually attached to the next turn

# Design language (after Wave B) — Eraser + Kalshi grammar

Do not clone those products. Steal layout rules for **our** panes.

**From the note+canvas split (Eraser-style):**
- [x] Plan files get Note / Both / Canvas. Both = PlanDoc left, Maps right (RAG nodes/edges, not a generic whiteboard).
- [x] Linked resources under the plan crumbs (files the plan names in backticks).
- [x] Map nodes open the file; a floating code card is Monaco of that path, not a pasted Lambda demo.
- [x] Agent questions can pin to a map node (ask_user already exists).
- Skip live multiplayer cursors. This is a single-operator workbench.

**From the dense dashboard (Kalshi-style):**
- [x] Taskboard and QA as high-contrast cards with a yes/no or pass/fail bar, not only a kanban column.
- [x] Explorer/Git sidebar lists: Trending (dirty), New (untracked), Top movers (most hunks).
- [x] Agent run as a hero: route local vs cloud, context % bar, Live pill while busy.
- [x] Trust strip we already mean in honesty: Local 2B · approvals not sandbox · keys in data/secrets.
- Skip prediction-market chrome, neon category rainbow, and trading CTAs.

# Wave M (Agents Stage layout)

- [x] `layoutMode` dock/stage/focus persisted via `takeLayout`
- [x] Cowork label → Stage; Focus ticker; Ctrl+. cycles regimes

# Wave N (activity intelligence)

- [x] Sticky live rail; density compact/comfortable/spacious; thought fold
- [x] Think wf-card + labeled Forge rail; mode copy; session filter/pin

# Wave O (orchestration + llama health)

- [x] Lane buckets running/done/error; drop fake tokens
- [x] Llama health popover on pulse (gpu/vram/ngl/ctx/err)

# Wave P (trust / review / index)

- [x] Settings Trust/Local mind/Index/Keys cards
- [x] Hunk list review; explorer git letter → diff; Agent shells tab; palette sections

# Wave Q (PlanDoc + inspector)

- [x] Think pipeline strip + files; main bumps implementing→done after Implement
- [x] Inspector breadcrumb / url() warn / agent-patching lock

# Later / never

- Design Mode, voice, image generation
- Landlock sandbox (this kernel cannot); keep approvals
- Cursor Tab cloud model, Instant Grep, marketplace, team SSO
- Copying `cursor_3.17.21_amd64`

# Referenced by

- Home AI Kernel v2

# Wave R (honesty + Think theater)

- [x] `chromeRoute(activity, layoutMode)` → chat|stage|focus|design; Code pill is Focus
- [x] Kill Cowork boolean; `StagePills.tsx` owns the four pills
- [x] `takePinnedChats` on layout JSON; pins persist
- [x] Skip think → done on forge error chunks; PlanDoc Built only when done
- [x] MiniDiff Expand 24→120 + Side-by-side; drop fake Effort UI
- [x] llama/Trust on live-rail; wait-banner for shell approval; Think file chips

# Wave S (lock native Stage + Trust theater)

- [x] `stage-chrome.test.mjs` never cowork/code; Chat/Stage/Code/Design pills
- [x] Focus ticker Hold when waitingShell/approval
- [x] `StageTrustRow` sticky Allow/Deny + allow/deny counts → Settings
- [x] `thinkPick` ready|implementing; clickable Map files; lanes running/done/error
- [x] Palette Layout Dock/Stage/Focus; drop fake Effort UI
- [x] Telegram `/stage` + Mini App Glance theater (sibling agent)

# Telegram Stage wave (phone chrome)

- [x] `stageCard` HOME console — forge `phaseTrack`, think ready/implementing/done (never Built), hold, `Local 2B · Ask · no Landlock`, llama/keys flags, `lastForgeError`, lane running/done/error (not Hunt/Verify)
- [x] `/stage` + dock Stage → `kind: stage`; Trust → manage; `takeNav('stage')` on `nav:go:stage`
- [x] helpCard `STAGE   /stage          forge · think · hold`; Stage + Trust on dock/glass without dropping Manage/Pulse
- [x] Mini App Glance labeled Stage; think docs + Implement (`thinkRelFromOpen`); Allow-Deny; healthPulse llama/keys
- [x] `progressCard` FAULT when error chunks exist; no token counts from `text.length`
- [x] Voice notes
- [ ] Bump think to `done` from the phone after verify (kernel still uses `shouldCloseThink` only)

# Wave T (simple Go: chats, modes, tools, skills)

- [x] `StageGo` New / Mode / Tools / Skills under StagePills; `takeGoTab` + `publicSkillPeek` + `publicStackPeek`
- [x] One session list (drop duplicate agent-tabs); drop dead Customize; Artifacts + More stay
- [x] Titlebar mode opens the mode menu; rail Extensions → Skills; palette New chat + Skills under Agents
- [x] Telegram dock New + Skills; `takeNav('skills')`; help `/new` `/chats`; Mini App Skills sheet
- [x] Tests + AP-20260901-41; keep StagePills / chromeRoute / StageTrustRow / `/stage`

# Wave U (jailed git push, Plan writes, workspace grep)

- [x] `homeai:git:push` → `gitPushArgv()` `['push']` only; Git pane Push upstream; not on the terminal allowlist
- [x] Plan `rag_write` folder `plans` → `RAG/plans/*.md` never `.think.md`; Think stays `plan_write`
- [x] Search pane Memory (FTS) + Workspace (`workspaceGrep` + ignore + `publicGrepHits`)
- [x] Drop fake Effort UI; Models picker stays
- [x] T-02 through T-08 + T-56–T-58; AP-20260901-44; hunt-idor / hunt-xss / hunt-llm-ai



# Roadmap — Hex AI Workbench

Last analyzed: 2026-09-04. Upgrade checkboxes when a ship lands. Do not write novels; link feature cards.

## Phase 1/5 — Kernel workbench
- [x] Explorer, editor, terminal, Agents column
- [x] Local 2B default; cloud optional
- [x] Taskboard + notes + maps grounds

## Phase 2/5 — Forge (hunt + prevent + recipes)
- [x] `full-stack-hunt-prevent` + bug-memory seed
- [x] `recipe-refine` + `RAG/recipes/`
- [ ] Every feature-build cites an AP or a recipe (discipline)

## Phase 3/5 — Repo library (this)
- [x] `RAG/library/` STATUS / ROADMAP / FEATURES / TESTS / EDGES
- [x] Library pane in the workbench (meters + tabs)
- [x] Missing ROADMAP triggers `repo-library` before product work

## Phase 4/5 — Proof
- [x] T-01 workspace jail (`paths.test.mjs`)
- [x] Code / Design studio (prompt → new DesignIR slug → IrCanvas; Quokka sample kept)
- [x] Real test files for T-02..T-08 (fs IPC, skill skip, kind=library, recipe contract, alwaysApply, count-status, Library pane)
- [x] Jailed git push IPC; Plan `rag_write` `RAG/plans/*.md`; Search workspace grep; drop fake Effort UI
- [x] Tick EDGES to `tested` when Gate 0 prevent artifacts exist (E-01, E-07–E-18, E-28)
- [x] Code / Design studio (Claude Design chrome + storefront DesignIR)
- [x] Telegram + PC share one kernel, Home thread, skills/rules (pair from Settings)
- [x] Telegram `/do` uses the same builtin + MCP tool surface as the workbench
- [x] Telegram works in a private chat and in groups (paired user only)
- [x] Telegram glass console (HOME chrome, dock, Ship / Deep / Halt)
- [x] Telegram Mini App (HMAC glass UI on the same kernel)
- [x] Mini App Glance / Think implement / steer / questions / jailed inbox
- [x] Telegram mind picker: offline 2B, keyed cloud, Cursor Cloud Agents; Pulse llama/keys; bot photos → inbox
- [x] Telegram `/manage` console + IDE Telegram session pane (same jailed session DTO)
- [x] Telegram `/stage` Stage pulse + Mini App Glance theater (forge · think · hold · Trust line)
- [x] Agents Go strip: New chat, one session list, Mode / Tools / Skills (desk + phone dock)
- [x] IDE chrome: kernel pulse, layout persist, editor split, explorer CRUD, bottom panels
- [x] IDE UX refine: cowork persist, crumbs, overflow tabs, palette groups, quieter Stage rail
- [x] Design generate live: local 2B `design_get`/`design_patch` grows IR (`irGrew`)
- [x] Home OS kit: tool packs, digest subagents, jailed `compute_run`, VERIFY critic, MCP starter, life pack, opt-in extra roots
- [x] Shared Hunt/Verify/Critic workflow DTO + Background tasks panel (honest models/tokens)
- [x] Activity bar opens real panes (sidebarKind + studio CSS); Hex AI chrome name
- [x] Shared HxPage / HxSideHead / HxEmpty on activity pages (not a second pane-head)
- [x] Palette / quick-open / PlanDoc / Design empty / StageGo match Hex chrome (text nodes)
- [x] Overlay pops + session/file-tree/browser empties + honest-disabled shape tools
- [x] Send/studio/terminal leftover chrome uses Hex tokens (not VS Code/Claude blue)
- [x] Product chrome leftover hexes (send-round, plan chips, hunk, file-icon, ctx sys, design export) use Hex tokens
- [x] Form pages hx-form/hx-card; Settings section rail; Design home off CHOOSE A TEMPLATE; jailed crumbs + in-buffer outline
- [x] Coder GGUF sidecar on `127.0.0.1:8766` (standard + workspace GGUF); nested explore forge skipVerify
- [x] Compute plots under `data/compute/plots` + `knowledgeStamp` cache for skills
- [x] Fleet pane: jailed multi-repo stacks, bot roster, subscriber broadcasts
- [x] Fleet clones nest per repo / telegram bot; website hostname labels; `/fleet fork`
- [x] Auto Review v2 PRO: Judge → classify → human (`approvalMode: auto-review`)
- [x] Consumer pack: app/profile/workspace split, sandbox-on `ide`, first-run GGUF `.partial`, legal files, SHA-pinned CI
- [x] Jailed TypeScript/JavaScript LanguageService, Monaco providers, navigable Checks
- [x] Loopback Node Inspector, Runtime pane, git gutters, critic debug/TS evidence
- [x] Workspace-symbol worker isolation, cancel generation, keyboard Checks/Runtime
- [x] File TS IPC on the worker; Inspector evaluate side-effect guard; smoke SUID skip
- [x] Workbench chrome scrolls instead of clipping (tabs/status/lists/composer); duplicate pane-tab hidden

## Phase 5/5 — Generate from DNA
- [x] DNA plan from recipes (`dnaPlanFromRecipes` → `RAG/plans/dna-*.md`, never clones)
- [x] DNA README scaffold (`dnaScaffoldFromRecipes` → `RAG/plans/dna-<slug>/README.md`, Ask, not clones)
- [x] Runnable static DNA compile (sanitized recipe metadata → CSP HTML/CSS/JS under the same jail)
- [x] CapabilityIR seam + deterministic web/CLI emitters (`ir.json`, static app, `cli/run.mjs`)
- [x] Manual loopback API emitter (`127.0.0.1`, OpenAPI, bounded JSON `/compose`)
- [x] Manual sandboxed desktop emitter (local HTML + frozen CJS preload DTO; no renderer Node/IPC)
- [ ] Recreate original apps from recipes + library (not verbatim clones)

## Next
- Install (2026-10-01): `npm install`, `npm run vendor:llama`, `npm run doctor`, then the printed command. GGUF is Settings → Hardware. `ide` stays sandboxed.
- Workbench UX polish (2026-09-07): overflow-x on Checks/Runtime tabs, status ellipsis, sidebar `min-height: 0`, composer `flex-shrink: 0`, hide duplicate pane-tab on list/page/Browser. Operator `npm run ide` click-walk of activity icons + F9 / Checks / Runtime still required. Do not mark click-walk done headless.
- High-end TS IDE (2026-09-06): file TS IPC on the worker, Inspector evaluate keeps `throwOnSideEffect`, smoke skips non-SUID chrome-sandbox. Full LSP/DAP claims stay off. Operator `npm run ide` click-walk of F9 / Checks / Runtime still required. Mobile DNA remains deferred.
- CapabilityIR desktop (2026-09-05): generated Electron shell is preload-safe and manually launchable. Next: a mobile-safe manifest/offline bundle; desktop packaging and operator click-walk remain open.
- CapabilityIR API (2026-09-05): real generated API has loopback bind, explicit request schema, caps, and live tests; desktop now consumes the same IR safely.
- CapabilityIR (2026-09-05): validated `capabilityir/0.1` drives real web and CLI emitters; desktop/mobile packaging remains open.
- DNA compiler (2026-09-05): static original app output runs without dependencies; CapabilityIR now owns emitter input. Full Phase 5 recreation remains open.
- Compiler-OS (2026-09-05): analog graph from `packages/`+`apps/` feeds perceive / `rag_search` / impact; harness persists VERIFY own keys; DNA README scaffold + design fidelity line. Operator `npm run ide` click-walk still required. Codebase-memory still needs `dist/index.js`. Phase 5 full generate still open. Do not mark click-walk done headless.
- Occupancy (2026-09-05): operator `npm run ide` — open Maps with chat on. One Maps list, canvas (no second HxPage), chat thread without Chat-and-Cowork rail over the grid. Settings Enable Blender MCP uses local uv checkout; still Ask. Footer folder may still show `Home AI`. Do not mark click-walk done headless.
- Chat thread (2026-09-05): operator send a turn in Code with a file open — replies must appear above the composer, not only in the text box. Chat-and-Cowork with no file should fill the window (no empty editor). Footer folder may still show `Home AI`. Do not mark click-walk done headless.
- Hex workbench window (2026-09-05): sandboxed preload is CJS `out/preload/index.js` (T-112). Operator `npm run ide` — activity bar, Chat, Settings. This Linux box may still need spawn-only `ELECTRON_DISABLE_SANDBOX=1` when chrome-sandbox is not SUID; do not put that env on the `ide` script. Footer folder may still show `Home AI`. Do not mark click-walk done headless.
- Refine existing Hex workbench (2026-09-05): operator `npm run ide` — titlebar/activity/About/llama use Hex tokens; Help → About is `hx-card`. Do not replace the workbench with a first-run HxPage sheet. GGUF/sandbox/pack stay Settings + pack scripts. Footer folder may still show `Home AI`. Do not mark click-walk done headless.
- Consumer 1.0 (2026-09-04): operator `npm run ide` on a **clean** profile. Settings Hardware Download GGUF; Trust / Telegram; About Copy diagnostics / crash / updates. No Onboard overlay. Footer folder may still show `Home AI`. Pin `GGUF_RELEASE.sha256` when Q8 is frozen. Do not mark click-walk done headless.
- Form + editor UX (2026-09-04): operator `npm run ide` — Settings Trust/Keys/Hardware/Telegram/Visual rail; Telegram/Fleet/Git/Skills cards; Design home kinds not CHOOSE A TEMPLATE; click a parent crumb; Ctrl+Shift+O in an open file; activity aria-label; footer folder still `Home AI`. Do not mark click-walk done headless.
- Token leftovers (2026-09-04): operator `npm run ide` — composer send-round (amber 32px, not white); plan chip / hunk / Files code icon / context sys; Design Export amber; Effort pips amber; footer folder still `Home AI`. Files filter still shows empty folders (lazy `list()`). Do not mark click-walk done headless.
- Overlay leftovers (2026-09-04): operator `npm run ide` — Help → About Hex AI kicker; llama pop Load/Unload; Mode / session kebab / Effort / mention pops (amber, not VS Code blue); Chat filter-zero HxEmpty; Files filter-zero; Design shape tools dashed hint; Browser Go error/offline banner. Footer folder still `Home AI`. Do not mark click-walk done headless.
- Overlay chrome (2026-09-04): operator `npm run ide` — Ctrl+Shift+P empty filter vs no-match HxEmpty; Ctrl+P zero-hits; open an empty `RAG/plans` doc; Design editor with no selection + empty canvas; StageGo New/Mode/Tools/Skills (Alt+click pin). Footer folder still `Home AI`. Do not mark click-walk done headless.
- Page chrome (2026-09-04): operator `npm run ide` — activity bar Telegram/Settings/Fleet/Library/Board/Skills/Debug plus Search/Git/Notes/Maps sidebars. Confirm HxPage hero (no second pane-head), HxEmpty on zero-data, Design kicker Hex AI, footer folder `Home AI`. Do not mark click-walk done headless.
- Chat-and-Cowork home (2026-09-04): operator `npm run ide` — titlebar brand Hex AI (native title Hex AI Workbench), composer is Mode + Effort + mind select + Review + attach + send, editor HxEmpty when no file, footer still folder `Home AI`. Do not mark click-walk done headless.
- Activity-bar click-walk (Electron `npm run ide`, CDP :9222, 2026-09-04): Debug, Skills, Notes, Maps, Code/Design, Board, Library, Telegram, Fleet all opened with real content. Design home is Hex AI Design at full width. Window title Hex AI Workbench. Status still shows folder basename `Home AI`. Operator may still want a live forge to see Critic rows.
- Stage + page panes: Board/Library/Fleet keep `minmax(0,1fr)` (not `0.28fr`). Notes open via `setActivity`. Help → About Hex AI is a pop, not a Settings dump. Terminal Debug shows Hunt/Verify/Critic + Open Debug pane.
- GitHub `/design-sync` still out of scope; skip Cassowary. Shape tools stay chrome (honest-disabled).
- Keep kebab Open in → Agents Stage; do not put Stage back on the pill row. Background tasks default-open in Stage.
- Think-done-from-phone after verify still kernel-side (`shouldCloseThink` only).
- Do not vendor whisper/piper/tesseract. Do not send Telegram outbound voice. Do not put `rag_write` in PLAN_BLOCK.
- Operator: kebab → Background tasks, run an agent, confirm Hunt rows during ACT and a Critic row only on the VERIFY pass; Stop aborts that `runId` only. Stage default-opens Background; leaving Stage does not force-close it. Agent-row click reveals the matching `data-tool` log line.
- Do not add a generic `homeai:fs:stat` that echoes extra-root errors. Breadcrumbs / go-to-symbol next if the pulse stays jailed.
- Home OS: Enable MCP starter in Settings, add `server:tool` allowlist, try `/pack research` then `task` explore. Extra-root `root` id is the folder basename; writes stay Ask. Pack schemas shrink (Think + extra packs). OCR is images only. VERIFY critic gets workspace-relative before/after plus a jailed git diff. `inbox_stt`/`speak` use PATH binaries.
- Coder sidecar: only `standard` + workspace GGUF on `127.0.0.1:8766`; infill prefers it; nested explore forge is skipVerify/skipRemember/maxTurns 2. Sidecar never attaches to a leftover `/health`.
- Compute plots: `plt.savefig` and `Figure.savefig` go to `data/compute/plots`. Reads of `data/secrets` denied. Writes only under `data/compute/runs` or plots, including rename/shutil/fs.promises. Not Landlock (ctypes still bypass). Stamp is RAG+mods+workspace `.cursor/.agents/.homeai` skill trees + `AGENTS.md`, never `$HOME`.
- Fleet: add Link INFO tokens as hub/worker on the **PC Fleet pane**. Telegram stacks and Websites tabs nest clones; Bot fleet shows that bot’s repo tree + Clone. Save domain is hostname-only. `/fleet fork <id>` or Mini App `fleet-fork` copies into `data/fleet/clones/<id>`. `/fleet clone https://… <id>` or Clone on the pane. `/fleet add <id> Repos/name` registers an existing folder. `/fleet start|stop <id>`. `/fleet sub` opts this chat in. Bot tokens never on the phone. Do not fetch stored domains.
- Operator click-walk Auto Review: Settings → Trust → auto-review → Save; run `git status` (no Allow chip); unmodeled `$()` still Ask. Do not mark this done from a headless agent.
- Dev boot: `npm run dev` (renderer **5175**). ESM main uses `import.meta.url` for preload. Do not watch `AI Resources`/`RAG`. Do not mark Electron click-walk done headless.


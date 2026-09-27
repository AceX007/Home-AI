# Screen audit — Code / Design mode (27 captures)

Source: user-provided screenshots, 2026-08-28. Research: [claude.com/product/design](https://claude.com/product/design), Anthropic Labs launch (17 Apr 2026), June 2026 on-brand overhaul (`/design-sync`, canvas edit, design-system import). This repo implements the **observable chrome and flows**, not Anthropic internals.

Two products appear in the set:

1. **Claude Code** — `Chat and Cowork` | `Code` shell, session log, background tasks (images 01–11, 13).
2. **Claude Design** — home, canvas, Simple/Pro/Code/Tweaks inspector, Quokka Shop prototype (images 12, 14–27).

Home AI already has the Code-side activity log (`groupActivity`). This ship clones **Claude Design** as activity `design` (Code / Design) and keeps DesignIR as the source of truth.

---

## 01 — Code shell, Chat and Cowork active

- **Layout:** 3 columns. Left nav (search, Chat and Cowork | Code pills, + New, Artifacts, Customize, More, project `Q-SHP` session list). Center session (`Bug sweep` / `Q-SHP`) with expandable `Ran N commands`, `Edited file +N −M`, workflow card. Right **Background tasks**.
- **Way of working:** Session is a narrative log, not a raw terminal. Workflows are multi-agent with pip progress. Composer: `Type / for commands`, Accept edits, model (`Fable 5`), effort.
- **Technique:** Accordion groups; status pills; reconnect card when the local machine is offline.
- **Edges:** Offline reconnect; 22-agent workflow density; token counters.

## 02 — Code pill selected + Effort Ultracode

- Same chrome; **Code** is the active pill. Effort popover: Faster ↔ Smarter, Ultracode track (dotted lavender glow), thumb at Smarter.
- **Edges:** Effort label must match thumb; popover dismiss on outside click.

## 03 — Models menu

- Models: Fable 5 (1), Opus 5 (2), Sonnet 5 (3), Haiku 4.5 (4), More models. Checkmark on current. Shortcuts 1–4.
- **Edges:** Hidden models behind More; selection syncs footer chip.

## 04 — Accept edits / Mode menu

- Modes: Auto, Manual, Accept edits (selected), Plan. Shortcuts 1–4. Trigger is the footer pill.
- **Way of working:** Auto = model decides permissions; Manual = always ask; Accept edits = auto-apply file edits; Plan = plan first.
- **Edges:** Mode persists per session; Plan must not mutate until confirmed.

## 05 — Effort Max (6 discrete dots)

- Header `Effort Max`, help `?`. Faster–Smarter track, 6 stops, blue fill, white pill thumb on stop 5 (Max). Footer shows Fable 5 + Max chip.
- **Edges:** Snap to dots; long labels; unsupported effort hidden per model.

## 06 — Effort Ultracode (glow track)

- Same popover; label `Ultracode` in lavender; track is a dotted grid that brightens toward Smarter. Thumb at far right.
- **Technique:** CSS mask / dotted background, not a native range only.

## 07 — Session kebab + Background tasks

- Header kebab: Artifacts, Background tasks (checked), Open in ▸, Rename R, Transcript view ▸, Copy link C, Archive A, Delete D (red).
- Center still shows reconnect card + composer.
- **Edges:** Delete confirm; Archive vs Delete; Open in submenu viewport flip.

## 08 — Background tasks card close-up

- Panel title Background tasks, expand + close. Running card: workflow id, stop square, duration, 22 agents, 223.3k tokens, description, Hunt3 5/8 orange pips.
- **Edges:** Truncate long ids; stop cancels; pip colors = phase status.

## 09 — Transcript view submenu

- Nested menu: Normal, Thinking (check), Verbose, Summary. Radio behavior.
- **Edges:** Open to the right unless clipped; hover delay ~200ms.

## 10 — (home / design entry)

- Claude Design Beta home appears in this slot in the capture set: serif wordmark, prompt, templates, projects table. See image 14 notes.

## 11 — Summary transcript

- Header metrics: 5 turns, 210 tool calls, 15h 21m, 588.2k tokens. Error: Couldn't generate summary — retry. View transcript / Exit summary. Transcript view = Summary checked.
- **Edges:** Summary failure is retryable; metrics must not include markup.

## 12 — Running sidebar (workflow + Verify3)

- Dual tables Hunt3 / Verify3 (0/14). Agent, Model, Tokens, Time. Finished 45 + Clear. Bash card under phases.
- **Technique:** Nested accordions; live timers.

## 13 — Code session with 2 running tasks pill

- Same as 01–02 with orange `2 running tasks` chip above composer.

## 14 — Claude Design home (Beta)

- **Layout:** Black page. Left: `Claude Design` serif + Beta. Right: avatar V.
- Center widget: prompt placeholder `Make a pitch deck for a new product`; + ; Design system None; `</>` code; Model Sonnet 5; salmon ↑ submit.
- CHOOSE A TEMPLATE: 12 tiles (Blank selected with blue ring, Mobile app, Slides, Document, Wireframe, Animation, UI mockups, Résumé, 3D, Research, HTML email, Color + type).
- Tabs: Projects | Design systems | Templates. Search. Star / list / grid.
- Table: Name, Last viewed, All owners, Access. Rows: Mobile dApp storefront design (just now), Mobile dApp frontend design (Aug 5).
- **Way of working:** Prompt → template → generate. Projects are first-class.
- **Edges:** Long titles ellipsis; empty search; no design system.

## 15 — Chat + canvas (Comment tooltip)

- Left: project chat, todos, “Start a new chat to save tokens”, composer + model.
- Top: Quakka Shop Storefront / 2 pages, 100%, Select / Comment / Edit, Present, Share, avatar.
- Comment tooltip: `Point at elements and tell Claude what to change.`
- Canvas: iPhone frame, Q logo, Quakka Shop, underground marketplace, LIVE 24/7, Continue with Telegram, Переключить на русский.
- **Way of working:** Chat for broad change; Comment for node-scoped; Edit for inspector.

## 16 — Present dropdown

- Present ▾: In this window, Fullscreen, New window. Share is cream high-contrast. Edit is the active tool (lighter chip).
- **Edges:** Present hides inspector; Esc exits.

## 17 — Pro inspector + tree (full)

- Tabs Simple | **Pro** | Code | Tweaks. Layer tree: Row/Column/Conditional group (off, nz-if/uc-if/sc-if), selected Column. Tools: select, T, #, shapes, comment.
- Appearance / Sizing Hug|Fixed|Fill / Position Inline|Absolute / Contents layout flex / Padding X&Y.
- Canvas phone + selection handles.
- **Technique:** Flexbox inspector is the layout engine.

## 18 — Simple tab (split)

- Left ~35% Simple inspector (Appearance, Border Add, Export selection). Right phone with blue selection box + handles.
- Discard | Save (blue).

## 19 — Simple toolbar + Text T tooltip

- Palette mark, truncated title, layout/search/help. Edit bar Discard/Save. Tools with Text tooltip `Text T`. Undo/Redo dim when empty.
- **Edges:** Truncated titles; disabled history.

## 20 — Click-through tooltip

- Interact tool tooltip: `Click through (interact with the page) H`.
- **Way of working:** H = prototype clicks (geo, cart) vs V = select for inspector.

## 21 — Pro tree + full property stack

- Same as 17 with more of padding/margin. Conditional groups show `off`.

## 22 — Inspector through Margin + Debug JSON

- Debug: `{ tid, tag, parent, attrs, style }` as a CSS string. Style is declarations, not HTML.
- **Prevent:** Never `innerHTML` that string; parse allowlisted props only.

## 23 — Advanced CSS pills + Export preview

- Blue dots = dirty props. Export: checkerboard, Q + Quakka Shop, Format PNG, Scale 2x, peach Export PNG.

## 24 — Export PNG + Debug tid 46

- Continue with MetaMask in some captures; this workspace uses Telegram to match the landing screens. Debug `class: mcs`, `flex:1;min-height:0`.

## 25 — Code tab

- Left: tree + pill toolset + CSS editor (`flex: 1; display: flex; … animation: qIn .45s ease both`). Hint: `One declaration per line; @name edits an attribute.`
- Right: phone + selection. **Code tab is CSS on the selected node, live-bound to the canvas.**

## 26 — Tweaks tab

- Empty state copy: no tweakable controls yet — describe a tweak, Ideas button. Canvas still live with selection.

## 27 — Store grid + product PDP notes

- Store: retro QUOKKA SHOP wordmark, RU, bag, search, chips All/Sneakers/Jackets/Accessories, 2-col cards, LOW STOCK, € price, green stock, tabbar Store/Orders/Profile.
- PDP: Back, bag badge, hero, LOW STOCK, name/price, DESCRIPTION, SIZE picker, Add to Cart / Buy Now.
- Flows: Country → City → Hood search EN/RU; cart sheet; checkout Crypto (BTC/ETH/USDT + copy) | Card; confirm checkmark + order number.
- **Scope for this repo:** streetwear/sneakers only. No gram packs, no illicit goods admin.

---

## Research (Claude Design, public)

- Prompt → draft → refine via chat, comments, direct edit, generated sliders.
- Design systems from GitHub / files / `/design-sync`.
- Export PDF/PPTX/HTML; handoff to Claude Code.
- Shared usage with chat/Cowork/Code.
- Not public: IR format, whether every edit hits Opus, export pipeline. Home AI uses DesignIR patches (0 tokens for inspector).

## Techniques used here

- Scene graph (DesignIR) + React compiler for the phone.
- Allowlisted CSS object (no `url()`, no `<>`, no `innerHTML`).
- Local draft / Save / Discard (matches Edit bar).
- Click-through (H) vs Select (V) vs Comment vs Edit.
- PNG export via canvas 2d (no html2canvas, no remote).

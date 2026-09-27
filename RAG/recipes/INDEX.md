# Recipes

Reusable delivery cards. Any model: `rag_search` here before writing code, then **refine** the card after ship.

Protocol: skill `recipe-refine`. Schema: that skill’s `reference/recipe-schema.md`. Hunt+prevent still always runs.

| Slug | Idea |
|------|------|
| [kernel-loop](kernel-loop.md) | PERCEIVE → ROUTE → ACT → VERIFY → REMEMBER |
| [ipc-workspace-fs](ipc-workspace-fs.md) | Renderer-untrusted FS via main, workspace prefix |
| [permissions-policy](permissions-policy.md) | Sanitize allowlists on persist; no mass-assign |
| [mcp-http](mcp-http.md) | MCP stdio or streamable HTTP, net-gated |
| [designir-patch](designir-patch.md) | DesignIR patches, not whole-canvas regen |
| [cursor-jobs](cursor-jobs.md) | Cloud job summaries, allowlisted agent ids |
| [think-handoff](think-handoff.md) | Local Think artifact; Implement follows the file |
| [activity-groups](activity-groups.md) | Fold traces; Background `takeWorkflow` Hunt/Verify/Critic |
| [skill-cards](skill-cards.md) | SKILL.md + always-apply rules, portable across models |
| [hunt-prevent-delivery](hunt-prevent-delivery.md) | Hunt and prevent as one delivery loop |
| [repo-library](repo-library.md) | Per-repo roadmap, tests, edges, progress |
| [telegram-bridge](telegram-bridge.md) | Telegram pane on the same kernel, shared threads |
| [workbench-chrome](workbench-chrome.md) | IDE chrome is a jailed kernel DTO |
| [agents-stage](agents-stage.md) | Dock/Stage/Focus layout; density folds; llama health |
| [tool-packs](tool-packs.md) | Pack-filter tools so the 2B never sees the full MCP dump |
| [subagents](subagents.md) | Digest-returning workers, not grep dumps |
| [compute-run](compute-run.md) | Jailed compute, not python -c on the shell allowlist |
| [life-pack](life-pack.md) | Notes calendar extract OCR stay inside named trees |
| [fleet-runtimes](fleet-runtimes.md) | Jailed multi-repo stacks, not a renderer shell |
| [auto-review](auto-review.md) | Pre-tool Judge then classify then human |
| [electron-dev](electron-dev.md) | ESM main + CJS sandboxed preload; watch ignore bulky trees |
| [electron-pack](electron-pack.md) | Packaged roots, GGUF `.partial`, sandbox-on release |
| [resource-harvest](resource-harvest.md) | AI Resources donate backends, never chrome |
| [compiler-os](compiler-os.md) | Unify PERCEIVE, promote remember, one Stop |
| [structural-memory](structural-memory.md) | Freeze tools, impact before edit, mint harness |
| [agent-ide](agent-ide.md) | LSP DAP git as agent tools |
| [ts-intel](ts-intel.md) | Jailed TypeScript LanguageService in main |
| [node-inspect](node-inspect.md) | Loopback Node Inspector, not a PTY |
| [compound-os](compound-os.md) | Mesh, jailed scene, DNA plans, outcome route |

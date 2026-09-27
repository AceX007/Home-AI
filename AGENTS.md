# AGENTS.md — Hex AI Kernel

Standing law for any agent in this workspace.

## How to work
- PERCEIVE with `explore` first. Do not dump grep into the parent context.
- Surgical `str_replace`. New files only via `fs_write`.
- `ask_user` when the product decision is not yours.
- Plan mode writes `RAG/plans/` only. Think mode: local 2B researches and `plan_write` a `.think.md`; Implement (cloud if keyed, else local) follows that file. Debug mode logs hypotheses to `data/debug/`.
- Local 2B is default. Cloud is muscle, never required.

## Hunt + prevent + recipes
- Hunt and prevent are one loop. Never hunt without a prevention artifact; never ship without hunting the diff.
- Follow `full-stack-hunt-prevent`, `recipe-refine`, and `repo-library`. Read `data/bug-memory/anti-patterns.md`, `RAG/recipes/`, and `RAG/library/` before the first write.
- If `RAG/library/ROADMAP.md` is missing, analyze and scaffold the library first. After ship, upgrade ROADMAP / TESTS / EDGES.
- Be curious: how a pattern ports, where it is weak, what hole it has. After ship, refine the recipe card.
- Snippet: `mods/full-stack-guard/skills/full-stack-hunt-prevent/AGENT_SNIPPET.md`.

## Safety
- Stay inside the workspace.
- Shell and network go through allowlist / human approval.
- Do not copy Cursor proprietary bits from any `.deb`.

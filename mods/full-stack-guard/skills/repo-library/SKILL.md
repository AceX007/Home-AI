---
name: repo-library
description: Per-repo living library — roadmap, features, required tests, edge cases, progress meters. Analyzes a repo if ROADMAP.md is missing, upgrades the library after every ship, syncs taskboard cards. Use when opening a repo, tracking progress, listing tests to write, documenting features, edge cases, or when the user mentions roadmap, library, coverage, or repo progress.
---

# Repo library

Track the whole repo. Hunt+prevent and recipe-refine still always run.

1. If `RAG/library/ROADMAP.md` is missing: fingerprint, then scaffold (`scripts/scaffold-library.sh`).
2. Else load `STATUS.md`, `ROADMAP.md`, `TESTS.md`, `EDGES.md` before other product work.
3. After every ship: upgrade ROADMAP checkboxes, feature cards, TESTS/EDGES rows, rewrite STATUS (`scripts/count-status.sh`), `tasks_update` for new work.
4. Close with hunt+prevent + recipe refine. Incomplete if code changed a feature and its library cards were not touched.

## Scaffold

Run `scripts/fingerprint-repo.sh` from `full-stack-hunt-prevent`, then `scripts/scaffold-library.sh [repo-root]`. Fill FEATURES from the fingerprint (apps/, IPC, API, UI). Seed TESTS as `required` (no fake `done`). Seed EDGES as `tracked`.

## Upgrade (every ship)

- ROADMAP: tick what landed; add a Next bullet.
- FEATURES: new surface → new `features/<slug>.md` (<60 lines) + INDEX row. Link recipes + `AP-…`.
- TESTS: add `required` rows for new behavior; set `done` only when a **test file exists**.
- EDGES: hunt findings → `tracked`; Gate 0 prevent artifact → `tested`. No exploit write-ups.
- STATUS: run `scripts/count-status.sh` (do not hand-wave counts).
- Board: `tasks_update` for leftover Next items. Do not duplicate the kanban in markdown.

## STATUS.md contract (pane parses only this)

```
# Status
- Phase: <n>/<total> — <name>
- Features: documented N
- Tests: done A / required B
- Edges: tested C / tracked D
- Updated: YYYY-MM-DD
```

## Additional resources

- [schema.md](reference/schema.md)
- Skills `full-stack-hunt-prevent`, `recipe-refine`

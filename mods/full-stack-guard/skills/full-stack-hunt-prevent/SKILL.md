---
name: full-stack-hunt-prevent
description: Whitebox full-stack hunting and issue prevention as one inseparable loop, then recipe refine. Mines past repo bugs, fingerprints the stack, pattern-forwards anti-patterns, always ships a prevention artifact and a refined RAG/recipes card. Use when hunting bugs, security review, auditing, pre-merge review, implementing features, preventing regressions, or when the user mentions hunt, prevent, full stack, past bugs, anti-patterns, regression, or recipes.
---

# Full-stack hunt + prevent

Hunt and prevent are one loop. Never hunt without prevent. Never ship without hunt.

1. Both phases are mandatory. Audit: hunt then prevent. Build: prevent then hunt the diff.
2. Read `data/bug-memory/anti-patterns.md` if present (else copy [anti-pattern-seed.md](reference/anti-pattern-seed.md)).
3. Run fingerprint then mine: `scripts/fingerprint-repo.sh` then `scripts/mine-past-bugs.sh`.
4. Cap loaded class `hunt-*` skills at 3–5. See [class-routing.md](reference/class-routing.md).
5. Close with a prevention artifact (regression test + anti-pattern record), refine a `RAG/recipes/` card (`recipe-refine`), and `rag_write`.

## Contract

| Mode | Order | Incomplete if |
|------|--------|----------------|
| Audit | Hunt → prevent → refine recipe | Finding with no test / anti-pattern / recipe update |
| Build | Load recipes → prevent → hunt the diff → refine | Edit that skipped anti-pattern check or recipe log |

`verify-and-remember` still closes the kernel loop. This skill **feeds** it (`rag_write` + bug-memory). It does not replace it.

Do not write exploit PoCs, payloads, or attack procedures. Prove with a **test or exact code path**. If a class `hunt-*` skill exists on disk, load it by **name** for checklists only — do not copy its payloads into this repo.

## Phase 0 — Memory

Read `data/bug-memory/anti-patterns.md`. If missing or empty of records:

1. Copy records from [anti-pattern-seed.md](reference/anti-pattern-seed.md) into bug-memory.
2. Run `scripts/mine-past-bugs.sh [repo-root]`.
3. Normalize each hit:

```markdown
### AP-YYYYMMDD-N — <class>
- Root cause:
- Bad shape: (1–3 lines, symbols/files)
- Good shape:
- Grep / symbols:
- Regression: (test idea or path)
- Source: seed | git <hash> | CHANGELOG | issue
```

## Phase 1 — Fingerprint

Run `scripts/fingerprint-repo.sh [repo-root]`. Map layers with [stack-layers.md](reference/stack-layers.md):

- Client: XSS/DOM, CSRF, open redirect, unsafe HTML, auth only in UI
- Desktop IPC (Electron): preload exposure, unsanitized `ipcMain`, path traversal
- API/auth: IDOR, session, JWT, mass assignment, missing auth on mutations
- Data: injection, migrations, secrets in repo
- Async/jobs: races, missing idempotency
- CI/supply chain: workflow injection, leaked tokens, unpinned actions

Record entrypoints (routes, IPC channels, jobs, workflows) — not a file dump.

## Phase 2 — Hunt (whitebox)

For each anti-pattern, search **siblings** (same helper, copied route, other panes). Trace trust boundaries: who is authenticated, what the server/main process trusts.

Load at most 3–5 matching `hunt-*` skills if present (`~/.claude/skills/hunt-*` or project skills) using [class-routing.md](reference/class-routing.md). Prefer stack match + one class from git history.

**Gate 0** (one fail = kill this finding, continue other classes):

1. Impact on this repo’s users or data (not theory).
2. In-repo owner (not a third-party service you only call).
3. Not documented intended behavior.
4. Repro is a failing test or a cited code path (file + function), not an exploit write-up.

## Phase 3 — Prevent (always)

For every confirmed issue **and** every new edit:

- Write or extend a regression test that would have caught it.
- Append one anti-pattern record to `data/bug-memory/anti-patterns.md`.
- On implement: run the matching layer checklist in [stack-layers.md](reference/stack-layers.md) on the diff **before** claiming done.
- Prefer the **good shape** from memory over inventing a new pattern.
- Create or refine a `RAG/recipes/` card (`recipe-refine`): ports, weaknesses, what to do next.

## Report (hunt and prevent together)

```markdown
## Hunt + prevent
- Fingerprint: <stack one-liner>
- Memory: <N anti-patterns loaded, M mined this run>

### Findings
- `path:line` — class — impact — Gate 0 passed because …

### Prevention shipped
- Test: <path>
- Anti-pattern: AP-…
- Review gate: <one line>

### Residual
- What was not covered
```

A report with findings and no Prevention shipped section is incomplete.

## Additional resources

- [stack-layers.md](reference/stack-layers.md) — layer checklists
- [class-routing.md](reference/class-routing.md) — signal → `hunt-*` names
- [anti-pattern-seed.md](reference/anti-pattern-seed.md) — day-one corpus
- Skill `recipe-refine` + `RAG/recipes/` — curious transfer and delivery recipes
- Skill `repo-library` + `RAG/library/` — roadmap, tests, edges
- `scripts/fingerprint-repo.sh` — execute
- `scripts/mine-past-bugs.sh` — execute

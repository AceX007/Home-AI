---
title: Hunt + prevent
---
# Routine: hunt + prevent

Never hunt without prevent. Never ship without hunt.

1. Read `data/bug-memory/anti-patterns.md`. If it has no `### AP-` records, copy `mods/full-stack-guard/skills/full-stack-hunt-prevent/reference/anti-pattern-seed.md`.
2. Run `mods/full-stack-guard/skills/full-stack-hunt-prevent/scripts/fingerprint-repo.sh .`
3. Run `mods/full-stack-guard/skills/full-stack-hunt-prevent/scripts/mine-past-bugs.sh .`
4. **Audit:** hunt (siblings + trust boundaries, cap 3–5 `hunt-*`) → Gate 0 → prevent.
5. **Build:** prevent checklist on the planned diff → implement → hunt the diff.
6. Ship: regression test + anti-pattern record + recipe refine + `rag_write` discovery.
7. Report using the template in skill `full-stack-hunt-prevent`. Repro is a test or exact code path, not an exploit write-up.

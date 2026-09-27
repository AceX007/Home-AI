# Wave E — Compute plots + skill stamp (no full boot)

Status: shipped (2026-09-01). Parallel with Wave D (`coder-sidecar.md`). Do not edit Wave D files.

## Plots
`compute_run` python may write figures under `data/compute/plots/` only (assertInside). Set `MPLBACKEND=Agg` and `MPLCONFIGDIR` under the compute cwd. Return the jailed relative path in stdout when a png is written. Still no network, still timeout, still unlink the script (keep the png).

Reject plot paths with `..`. Do not write to `data/secrets` or extra-roots.

If matplotlib is missing, the run may fail with a generic “matplotlib unavailable” — do not install packages from the worker.

## Skill stamp
`loadAllKnowledge` already runs every forge (no Electron reboot). Add `knowledgeStamp(root)` = max mtime of jailed `SKILL.md` / `RAG/skills` / `mods/*/skills` paths (cap walk). Cache load in-process until stamp changes so a long-lived main does not re-parse every IPC, but a skill save still appears on the next forge without a full boot.

## Hunt
Classes: path jail (plots + skill walk), no subprocess escape.
AP id: `AP-20260901-53`. Tests: **T-70** (plots) **T-71** (stamp). Edges: **E-63** **E-64**.

## Do not
- Touch `packages/llm`, `packages/governor`, `packages/agent`, `apps/desktop/src/main/index.ts`, `subagent.mjs`.
- Run `count-status.sh` (parent merges).
- `pip install` or network from compute.
- Fake Landlock. Whisper/Piper/email out of scope.

## Library
Feature `compute-plots`. Refine `RAG/recipes/compute-run.md` and `skill-cards.md`. Append only your TESTS/EDGES/FEATURES rows.

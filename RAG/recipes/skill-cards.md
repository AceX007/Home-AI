---
id: rec-skill-cards
title: Portable skill cards for any model
stack: any
status: refined
---

# Portable skill cards for any model

## Shape (do this)
- Mechanism: one folder, `SKILL.md` with WHAT+WHEN description; details one level down in `reference/`; scripts the agent **executes**.
- Good code shape: frontmatter `name` + `description` (folded `>` / `>-` / `|` / `|-` via `parseSkillFrontMatter`; proto keys and `<>` dropped). First ~900 chars of body = the loop (2B `packContext` slice).
- Stamp: `knowledgeStamp(root)` = `count:mtime` of jailed `SKILL.md` under `RAG/skills`, `mods/<id>/skills`, workspace `.cursor/skills`, `.agents/skills`, `.homeai/skills`, plus jailed rules trees and root `AGENTS.md` (`assertInside`, walk cap, skip `reference/`). Never `$HOME/.cursor/skills`. Cache `loadAllKnowledge` until the stamp changes.
- Do not: put extra `.md` beside `SKILL.md` unless the loader skips them; don’t set `disable-model-invocation` on always-on skills; don’t re-parse every IPC when the stamp is unchanged.

## Ports (same idea, other systems)
- Cursor: `~/.cursor/skills/<name>/` + `.cursor/rules/*.mdc` `alwaysApply`
- Claude: `~/.claude/skills/<name>/` + `CLAUDE.md` snippet
- Home AI: `mods/<id>/skills/` + `mods/<id>/rules/` `alwaysApply: true`
- Web/API: OpenAPI + runbooks (same idea: thin contract, deep reference). Cache invalidation = max mtime of contract files, not a full reboot.

## Curiosity (open)
- Why a skill instead of a 4k-line system prompt? Retrieval + progressive disclosure.
- What breaks if reference files load as skills? 2B context blowup — skip `reference/` in the loader **and** in the stamp walk.
- Why cache? Long-lived Electron main; a skill save still appears on the next forge without a full boot.

## Weaknesses / bugs / holes
- Multiline `description: >-` used to become `>-`. Now folded. Link: AP-20260904-73, T-91, E-05.
- Duplicate copies across `mods` + `~/.cursor/skills` — dedupe by skill name.
- Stamp trees are RAG + mods + workspace `.cursor` / `.agents` / `.homeai` skill trees plus root `AGENTS.md`. `$HOME/.cursor/skills` still does not bust the cache (AP-20260901-53, AP-20260904-62).
- Walk cap can miss a late SKILL.md in a huge tree; count+mtime still beats unbounded readdir.

## Prevent / robust delivery
- Tests: `loadAllKnowledge` lists the skill once; rule `alwaysApply` true; T-71 stamp mtime + `reference/` skip + workspace `.cursor/skills`.
- Deny-by-default: install.sh is the only copy path; stamp walk uses `assertInside`.
- Hunt layers: ipc, ci (don’t leak secrets into skills)

## Refinement log
- 2026-08-28 — full-stack-guard + name-dedupe in `packages/mods`. Next: every new skill installed via `mods/full-stack-guard/install.sh`.
- 2026-08-28 — `writeSkill` / `writeRule` jailed to RAG trees; Telegram `/skill new`. Next: hot-reload without a full boot.
- 2026-09-01 — Wave T. Worked: `publicSkillPeek` only `\w.-` slashes on the Go strip and `/slash` insert; Telegram Skills dock + Mini App Skills sheet. Next: hot-reload without a full boot.
- 2026-09-01 — Wave U. Worked: `skipSkillFile` is the shared jail (reference/scripts/assets, AGENT_SNIPPET); T-03 locks it. Next: still hot-reload without a full boot.
- 2026-09-01 — Wave E. Worked: `knowledgeStamp` + `cachedKnowledge` around `loadAllKnowledge`; tmp-dir mtime test. Failed: none. Next: include project `.cursor/skills` in the stamp if those trees become writable.
- 2026-09-04 — Root `AGENTS.md` is in the stamp. Next: `.cursor/skills` still not writable from this kernel, so still unstamped.
- 2026-09-04 — Workspace `.cursor/skills`, `.cursor/rules`, `.agents/skills`, `.homeai/skills` are in the stamp. Next: still never walk `$HOME` skill trees; Whisper/Piper stay later.
- 2026-09-04 — `parseSkillFrontMatter` folds `>-`. Next: still never walk `$HOME` skill trees.

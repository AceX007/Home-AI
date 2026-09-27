---
title: Forge pack — hunt prevent recipes
---

task: ship full-stack-guard (hunt-prevent + recipe-refine) so any model shares DNA
files: mods/full-stack-guard, RAG/recipes, packages/mods loadSkillsFromDir skip, packages/rag kind recipe, AGENTS.md
commands: bash mods/full-stack-guard/install.sh ; fingerprint-repo.sh ; mine-past-bugs.sh
what worked: always-apply rule + SKILL.md first 900 chars for 2B; name-dedupe so portable copies do not clone the skill 5×; recipes are FTS `kind=recipe`
next: load a recipe before every feature-build; append refinement log after ship

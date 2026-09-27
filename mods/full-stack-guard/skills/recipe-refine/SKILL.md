---
name: recipe-refine
description: Curious recipe learning and refinement. Studies a feature or pattern inside-out, asks how it ports to other stacks, maps weaknesses bugs and security holes, writes a reusable delivery recipe, then refines it after every ship. Use when learning a codebase, implementing a feature, improving robustness, porting between web API mobile desktop, or when the user mentions recipe, refine, curiosity, how else, or 1000x.
---

# Recipe refine

Curiosity is mandatory. Do not copy a pattern and stop. Hunt+prevent still always runs.

1. `rag_search` `RAG/recipes/` (and `data/bug-memory/anti-patterns.md`) before the first write.
2. Ask the curiosity set: other stacks, weaknesses, bugs, holes, robust delivery.
3. Write or **refine** a recipe card (never leave a first draft frozen).
4. Deliver from the recipe’s **robust shape**, then hunt the diff (`full-stack-hunt-prevent`).
5. Append a refinement log line: what worked, what failed, what to try next.

A ship with no recipe create/update is incomplete. A recipe with no weaknesses/holes section is incomplete.

## Curiosity set (always, huge)

When you see a feature, file, or trick, answer all of these in the recipe (short bullets, not essays):

- **What is it actually doing?** (one sentence, mechanism not marketing)
- **Where does trust sit?** (client, IPC, API, worker, DB)
- **How would this land in another system?** web API, CLI, mobile, worker, different language — name the analog, do not paste foreign source
- **What is useful to steal as a shape?** (the idea, not the file)
- **What is weak, buggy, or a hole?** (feeds hunt; Gate 0 still applies)
- **What would make delivery robust / “perfect”?** tests, deny-by-default, idempotency, explicit types
- **What would I try next time?** (this is the refine — recipes must grow)

## Card location and schema

One card per idea: `RAG/recipes/<slug>.md`. Follow [recipe-schema.md](reference/recipe-schema.md). Catalog: `RAG/recipes/INDEX.md`.

Minimum sections: Shape, Ports, Curiosity, Weaknesses, Prevent, Refinement log.

## When to open vs refine

- **New idea / first time seeing it** → new card from schema.
- **Using an existing card** → deliver from Shape + Prevent, then append Refinement log (date, task, what changed in the recipe).
- **Hunt finding** → add Weaknesses + Prevent; link `AP-…` from bug-memory.
- **Porting** (web ↔ mobile ↔ desktop ↔ API) → fill Ports with the analog; do not invent a second unrelated pattern.

## Delivery (boost)

1. Load 1–3 matching recipes (FTS / INDEX), not the whole folder.
2. Prefer the recipe’s good shape over improvising.
3. Hunt+prevent the result (`full-stack-hunt-prevent`).
4. Refine the card. `rag_write` a short discovery only if the recipe is not the right home.

Do not copy third-party source. Do not write exploit PoCs into recipes — cite code paths and secure shapes.

## Additional resources

- [recipe-schema.md](reference/recipe-schema.md)
- [curiosity-prompts.md](reference/curiosity-prompts.md)
- Skill `full-stack-hunt-prevent`

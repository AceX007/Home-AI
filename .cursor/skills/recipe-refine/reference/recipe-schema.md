# Recipe card schema

File: `RAG/recipes/<slug>.md`. Slug: lowercase, hyphens, mechanism not product (`ipc-workspace-fs` not `home-ai-files`).

```markdown
---
id: rec-<slug>
title: <short name>
stack: electron | web | api | mobile | any
status: seed | tried | refined
---

# <title>

## Shape (do this)
- Mechanism:
- Good code shape: (symbols, 1–5 lines of *original* sketch)
- Do not: (anti-pattern)

## Ports (same idea, other systems)
- Web/API:
- Desktop/IPC:
- Mobile:
- Worker/CLI:

## Curiosity (open)
- Why this and not X?
- What breaks at 10x load / bad input / untrusted caller?

## Weaknesses / bugs / holes
- (feeds hunt; link AP-… ; no exploit write-ups)

## Prevent / robust delivery
- Tests:
- Deny-by-default:
- Hunt layers: (client | ipc | api | data | jobs | ci)

## Refinement log
- YYYY-MM-DD — used for <task>. Worked: … Failed: … Next: …
```

Keep a card under ~80 lines. Future models retrieve by FTS; density beats novels.

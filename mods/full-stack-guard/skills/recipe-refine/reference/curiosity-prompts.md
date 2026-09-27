# Curiosity prompts

Run these on every interesting feature. Steal **shapes**, not files.

## Transfer
- If this were HTTP instead of IPC (or the reverse), where would authZ live?
- If this were a mobile client, what must stay on the server?
- If this were a worker, what is the idempotency key?
- Which 20% of this module is the actual invention? Can the rest be a boring library?

## Weakness
- What does the caller control? (path, id, HTML, JSON, env)
- What happens on empty, huge, concurrent, replayed input?
- Is the UI the only gate?
- What did `git` / bug-memory already punish in this shape?

## Robust
- What test would have caught the last sibling bug?
- What is the deny-by-default handler?
- What must be typed / allowlisted / prefixed to the workspace?

## Refine (never skip)
- What did I believe that the code disproved?
- What will I do differently the next time I generate this?
- Promote a Prevent bullet into Shape if it survived a real ship.

#!/usr/bin/env bash
# Create a blank recipe card. Usage: scaffold-recipe.sh <slug> [title]
set -euo pipefail
# this file: mods/full-stack-guard/skills/recipe-refine/scripts/
ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"
SLUG="${1:?slug (lowercase-hyphens)}"
TITLE="${2:-$SLUG}"
DEST="$ROOT/RAG/recipes/${SLUG}.md"
if [[ -e "$DEST" ]]; then
  echo "exists: $DEST" >&2
  exit 1
fi
mkdir -p "$ROOT/RAG/recipes"
DAY="$(date -I 2>/dev/null || date +%Y-%m-%d)"
cat > "$DEST" <<EOF
---
id: rec-${SLUG}
title: ${TITLE}
stack: any
status: seed
---

# ${TITLE}

## Shape (do this)
- Mechanism:
- Good code shape:
- Do not:

## Ports (same idea, other systems)
- Web/API:
- Desktop/IPC:
- Mobile:
- Worker/CLI:

## Curiosity (open)
-

## Weaknesses / bugs / holes
-

## Prevent / robust delivery
- Tests:
- Deny-by-default:
- Hunt layers:

## Refinement log
- ${DAY} — created. Next: fill Shape from a real file, then hunt siblings.
EOF
echo "wrote $DEST — add a row to RAG/recipes/INDEX.md"

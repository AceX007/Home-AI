#!/usr/bin/env bash
# Mine past fix/security commits and docs for full-stack-hunt-prevent. Compact stdout.
set -euo pipefail
ROOT="${1:-.}"
cd "$ROOT"
ROOT="$(pwd)"
echo "=== mine-past-bugs $ROOT ==="

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "--- git log (fix|security|CVE|regress), last 40 ---"
  git log --all --regexp-ignore-case --grep='fix\|security\|CVE\|regress\|vulnerab\|XSS\|injection' \
    --pretty=format:'%h %ad %s' --date=short -n 40 2>/dev/null || true
  echo
  echo "--- paths most touched by those commits (cap 20) ---"
  git log --all --regexp-ignore-case --grep='fix\|security\|CVE\|regress' --name-only --pretty=format: -n 80 2>/dev/null \
    | sed '/^$/d' | grep -vE '^(node_modules|out|dist)/' | sort | uniq -c | sort -nr | head -n 20 || true
else
  echo "not a git repo"
fi

echo "--- docs ---"
for f in SECURITY.md CHANGELOG.md CHANGELOG CHANGELOG.txt docs/SECURITY.md; do
  if [[ -f "$f" ]]; then
    echo "found: $f"
    head -n 40 "$f" | sed 's/^/  /'
  fi
done

if command -v gh >/dev/null 2>&1; then
  echo "--- gh issues (bug|security), 15 ---"
  gh issue list --state all --limit 15 --search 'bug OR security OR vulnerability' 2>/dev/null || true
fi

echo "=== end mine-past-bugs ==="
echo "Normalize hits into data/bug-memory/anti-patterns.md (see SKILL.md Phase 0)."

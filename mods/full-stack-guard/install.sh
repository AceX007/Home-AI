#!/usr/bin/env bash
# Install portable forge skills (hunt-prevent + recipe-refine) for Cursor, Claude, Home AI.
set -euo pipefail
MOD="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$MOD/../.." && pwd)"
RULE_SRC="$MOD/rules/always-hunt-and-prevent.md"
SKILLS=(full-stack-hunt-prevent recipe-refine repo-library)

copy_skill() {
  local src="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  mkdir -p "$dest"
  cp -a "$src/." "$dest/"
  chmod +x "$dest/scripts/"*.sh 2>/dev/null || true
  echo "installed $dest"
}

for NAME in "${SKILLS[@]}"; do
  SRC="$MOD/skills/$NAME"
  if [[ ! -f "$SRC/SKILL.md" ]]; then
    echo "missing $SRC/SKILL.md" >&2
    exit 1
  fi
  copy_skill "$SRC" "$REPO/.cursor/skills/$NAME"
  if [[ -n "${HOME:-}" ]]; then
    copy_skill "$SRC" "$HOME/.cursor/skills/$NAME"
    copy_skill "$SRC" "$HOME/.agents/skills/$NAME"
    copy_skill "$SRC" "$HOME/.claude/skills/$NAME"
  fi
done

mkdir -p "$REPO/.cursor/rules"
{
  printf '%s\n' '---'
  printf '%s\n' 'description: Hunt, prevent, refine recipes, and keep the repo library. Always apply when editing or reviewing this repo.'
  printf '%s\n' 'alwaysApply: true'
  printf '%s\n' '---'
  printf '\n'
  awk 'BEGIN{p=0} /^---$/{c++; if(c==2){p=1; next}} p' "$RULE_SRC"
} > "$REPO/.cursor/rules/always-hunt-and-prevent.mdc"
echo "installed $REPO/.cursor/rules/always-hunt-and-prevent.mdc"
echo "done. Skills: ${SKILLS[*]}"

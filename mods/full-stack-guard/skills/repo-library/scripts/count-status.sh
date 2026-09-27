#!/usr/bin/env bash
# Rewrite RAG/library/STATUS.md from FEATURES/TESTS/EDGES tables. Keeps Phase line if present.
set -euo pipefail
ROOT="$(cd "${1:-.}" && pwd)"
LIB="$ROOT/RAG/library"
STATUS="$LIB/STATUS.md"
DAY="$(date -I 2>/dev/null || date +%Y-%m-%d)"

count_feat=0
if [[ -d "$LIB/features" ]]; then
  count_feat=$(find "$LIB/features" -maxdepth 1 -type f -name '*.md' | wc -l | tr -d ' ')
fi

count_tests() {
  local want="$1"
  local n=0
  if [[ -f "$LIB/TESTS.md" ]]; then
    n=$(awk -v w="$want" '
      NR<=2 { next }
      {
        n = split($0, a, "|")
        for (i = 1; i <= n; i++) {
          gsub(/^ +| +$/, "", a[i])
          if (a[i] == w) { c++; break }
        }
      }
      END { print c+0 }
    ' "$LIB/TESTS.md")
  fi
  echo "$n"
}

count_edges() {
  local want="$1"
  local n=0
  if [[ -f "$LIB/EDGES.md" ]]; then
    n=$(awk -v w="$want" '
      NR<=2 { next }
      {
        n = split($0, a, "|")
        for (i = 1; i <= n; i++) {
          gsub(/^ +| +$/, "", a[i])
          if (a[i] == w) { c++; break }
        }
      }
      END { print c+0 }
    ' "$LIB/EDGES.md")
  fi
  echo "$n"
}

done_t=$(count_tests done)
req_t=$(count_tests required)
miss_t=$(count_tests missing)
req_all=$((done_t + req_t + miss_t))
tested_e=$(count_edges tested)
tracked_e=$(count_edges tracked)
wont_e=$(count_edges wont)
track_all=$((tested_e + tracked_e + wont_e))

phase="1/1 — Unknown"
if [[ -f "$STATUS" ]]; then
  line=$(grep -E '^- Phase:' "$STATUS" | head -n1 || true)
  if [[ -n "$line" ]]; then
    phase="${line#- Phase: }"
    phase="${phase# }"
  fi
fi

cat > "$STATUS" <<EOF
# Status
- Phase: ${phase}
- Features: documented ${count_feat}
- Tests: done ${done_t} / required ${req_all}
- Edges: tested ${tested_e} / tracked ${track_all}
- Updated: ${DAY}
EOF
echo "wrote $STATUS"

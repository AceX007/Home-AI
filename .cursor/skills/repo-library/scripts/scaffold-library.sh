#!/usr/bin/env bash
# Scaffold RAG/library if ROADMAP.md is missing.
set -euo pipefail
ROOT="$(cd "${1:-.}" && pwd)"
LIB="$ROOT/RAG/library"
if [[ -f "$LIB/ROADMAP.md" ]]; then
  echo "exists: $LIB/ROADMAP.md"
  exit 0
fi
mkdir -p "$LIB/features"
DAY="$(date -I 2>/dev/null || date +%Y-%m-%d)"
cat > "$LIB/README.md" <<'EOF'
# Repo library

See ROADMAP.md, STATUS.md, FEATURES.md, TESTS.md, EDGES.md. Skill: repo-library.
EOF
cat > "$LIB/ROADMAP.md" <<EOF
# Roadmap

Last analyzed: ${DAY}.

## Phase 1/3 — Understand
- [x] Scaffold library
- [ ] Fill FEATURES from fingerprint

## Phase 2/3 — Cover
- [ ] TESTS required rows for auth, fs, data
- [ ] EDGES tracked for trust boundaries

## Phase 3/3 — Prove
- [ ] First regression test file (tick T-ids to done)

## Next
- Run fingerprint-repo.sh and fill FEATURES.
EOF
cat > "$LIB/FEATURES.md" <<'EOF'
# Features

| Slug | What | How made |
|------|------|----------|
EOF
cat > "$LIB/TESTS.md" <<'EOF'
# Tests

| id | proves | feature | status | path |
|----|--------|---------|--------|------|
EOF
cat > "$LIB/EDGES.md" <<'EOF'
# Edges

| id | case | feature | status |
|----|------|---------|--------|
EOF
cat > "$LIB/STATUS.md" <<EOF
# Status
- Phase: 1/3 — Understand
- Features: documented 0
- Tests: done 0 / required 0
- Edges: tested 0 / tracked 0
- Updated: ${DAY}
EOF
echo "scaffolded $LIB"

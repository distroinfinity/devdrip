#!/bin/sh
# builds a shareable source zip from tracked files only, so node_modules, build output
# and every gitignored file (.env, .env.local, local specs) stay out by construction.
#   scripts/make-source-zip.sh "TeamName" "ProjectName" [/path/to/pitch-deck.pdf]
set -e

TEAM="$(printf '%s' "${1:?team name required}" | tr -cd 'A-Za-z0-9')"
PROJECT="$(printf '%s' "${2:?project name required}" | tr -cd 'A-Za-z0-9')"
DECK="${3:-}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$REPO/${TEAM}_${PROJECT}_Submission.zip"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cd "$REPO"
if [ -n "$(git status --porcelain)" ]; then
  echo "! uncommitted changes are NOT included (the zip is built from HEAD)" >&2
fi

ROOT="$STAGE/${TEAM}_${PROJECT}"
mkdir -p "$ROOT"
git archive --format=tar HEAD | tar -x -C "$ROOT"

if [ -n "$DECK" ]; then
  [ -f "$DECK" ] || { echo "✗ deck not found: $DECK" >&2; exit 1; }
  cp "$DECK" "$ROOT/PitchDeck.pdf"
else
  echo "! no deck given — the zip will hold source only" >&2
fi

# belt and braces: nothing that looks like an env file or a live secret may ship
if find "$ROOT" \( -name '.env' -o -name '.env.*' \) ! -name '.env.example' | grep -q .; then
  echo "✗ env file found in the staged copy — aborting" >&2
  find "$ROOT" \( -name '.env' -o -name '.env.*' \) ! -name '.env.example' >&2
  exit 1
fi
# (this script is skipped: it contains the patterns themselves)
SECRET_RE='(ghp_|gho_|github_pat_|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'
HITS="$(grep -rIlE --exclude=make-source-zip.sh "$SECRET_RE" "$ROOT" 2>/dev/null || true)"
if [ -n "$HITS" ]; then
  echo "✗ something that looks like a secret is in the staged copy — aborting" >&2
  echo "$HITS" >&2
  exit 1
fi

rm -f "$OUT"
(cd "$STAGE" && zip -qr "$OUT" "${TEAM}_${PROJECT}")
SIZE=$(du -h "$OUT" | cut -f1)
echo "✓ $OUT ($SIZE, limit 100 MB)"
echo "  commit: $(git rev-parse --short HEAD) on $(git branch --show-current)"

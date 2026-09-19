#!/bin/sh
# dev only: point the installed layout (~/.distrotv/current + shims) at this
# checkout's packages/cli build, so claude code hooks, the status line and the
# daemon all run the working tree. re-run after moving the repo; rebuilds are
# picked up automatically (pnpm --filter @distrotv/cli build, then `dtv daemon stop`).
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
CLI="$REPO/packages/cli"
HOME_DIR="${DISTROTV_HOME:-$HOME/.distrotv}"
BIN_DIR="${DISTROTV_BIN:-$HOME/.local/bin}"
VER="$(node -p "require('$CLI/package.json').version")-dev"

[ -f "$CLI/dist/index.js" ] || { echo "✗ build first: pnpm --filter @distrotv/cli build" >&2; exit 1; }

mkdir -p "$HOME_DIR/versions/$VER" "$BIN_DIR"
ln -sfn "$CLI/dist" "$HOME_DIR/versions/$VER/dist"
ln -sfn "$CLI/node_modules" "$HOME_DIR/versions/$VER/node_modules"
ln -sfn "$CLI/package.json" "$HOME_DIR/versions/$VER/package.json"
ln -sfn "versions/$VER" "$HOME_DIR/current"
chmod +x "$CLI/dist/index.js"

for n in distro dtv; do
  printf '#!/bin/sh\n# dev shim — runs %s\nexec node "%s/current/dist/index.js" "$@"\n' "$CLI" "$HOME_DIR" > "$BIN_DIR/$n"
  chmod +x "$BIN_DIR/$n"
done

echo "✓ linked $HOME_DIR/current → $CLI"
echo "  next: DISTRO_ENV=local dtv init   (then set cli.autoUpdate=false in ~/.distro/config.json)"

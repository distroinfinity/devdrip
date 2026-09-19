#!/bin/sh
# distro tv installer — LOCAL DEV variant
# Mirrors frontend/public/install.sh but fetches the tarball from the local
# Next.js dev server (localhost:3000) instead of GitHub Releases. Used for
# end-to-end install testing against an unreleased branch.
set -e

TMP=""
trap '[ -n "$TMP" ] && [ -d "$TMP" ] && rm -rf "$TMP"' EXIT

INSTALL_DIR="${DISTROTV_HOME:-$HOME/.distrotv}"
BIN_DIR="${DISTROTV_BIN:-$HOME/.local/bin}"
TARBALL_URL="${DISTROTV_TARBALL_URL:-http://localhost:3000/distrotv-cli.tar.gz}"
API_URL="${DISTRO_API_URL:-http://localhost:3001}"

# 1. require node 20+
if ! command -v node >/dev/null 2>&1; then
  echo "✗ node not found. install node 20+ from https://nodejs.org and re-run." >&2
  exit 1
fi
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "✗ node ${NODE_MAJOR}.x detected. node 20+ required." >&2
  exit 1
fi

# 2. download and extract
mkdir -p "$INSTALL_DIR" "$BIN_DIR"
echo "→ downloading distro tv cli from $TARBALL_URL ..."
TMP=$(mktemp -d)
curl -fsSL "$TARBALL_URL" -o "$TMP/distrotv-cli.tar.gz"
tar -xzf "$TMP/distrotv-cli.tar.gz" -C "$INSTALL_DIR"

# 2a. install the native dep (better-sqlite3). Same path as the prod
# install.sh — the tarball ships a stripped runtime package.json listing
# only native modules; pure-JS deps are bundled into dist/ by tsup.
if ! command -v npm >/dev/null 2>&1; then
  echo "✗ npm not found. install node 20+ (ships with npm) and re-run." >&2
  exit 1
fi
echo "→ installing native dependencies..."
(cd "$INSTALL_DIR" && npm install --omit=dev --no-audit --no-fund --silent)

# 3. wrapper — passes DISTRO_API_URL through so the CLI talks to the local API.
cat > "$BIN_DIR/distro" <<EOF
#!/bin/sh
export DISTRO_API_URL="$API_URL"
exec node "$INSTALL_DIR/dist/index.js" "\$@"
EOF
chmod +x "$BIN_DIR/distro"

# 4. PATH hint
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "ⓘ add $BIN_DIR to your PATH (e.g. in ~/.zshrc): export PATH=\"$BIN_DIR:\$PATH\"" ;;
esac

echo "✓ installed (local dev). api: $API_URL"
echo "  next: distro init"

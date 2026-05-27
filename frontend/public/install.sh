#!/bin/sh
# distro tv installer — https://distrotv.xyz
# downloads the latest cli release from GitHub and installs to ~/.local/bin/distro
set -e

TMP=""
trap '[ -n "$TMP" ] && [ -d "$TMP" ] && rm -rf "$TMP"' EXIT

INSTALL_DIR="${DISTROTV_HOME:-$HOME/.distrotv}"
BIN_DIR="${DISTROTV_BIN:-$HOME/.local/bin}"
REPO="distroinfinity/devdrip"
TARBALL_URL="https://github.com/${REPO}/releases/latest/download/distrotv-cli.tar.gz"

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
echo "→ downloading distro tv cli..."
TMP=$(mktemp -d)
curl -fsSL "$TARBALL_URL" -o "$TMP/distrotv-cli.tar.gz"
tar -xzf "$TMP/distrotv-cli.tar.gz" -C "$INSTALL_DIR"

# 2a. install the native dep (better-sqlite3). The tarball ships a stripped
# runtime package.json listing only modules that can't be bundled — pure-JS
# deps are inlined into dist/ by tsup. npm fetches the matching per-platform
# prebuild so users don't need a C++ toolchain.
if ! command -v npm >/dev/null 2>&1; then
  echo "✗ npm not found. install node 20+ (ships with npm) and re-run." >&2
  exit 1
fi
echo "→ installing native dependencies..."
(cd "$INSTALL_DIR" && npm install --omit=dev --no-audit --no-fund --silent)

# 3. wrappers — `distro` is the primary command; `dtv` is a collision-proof
# alias. the Python `distro` package ships its own `distro` CLI (usage:
# `distro [-h] [--json] [--root-dir ROOT_DIR]`) that can shadow ours on PATH
# (e.g. when /opt/homebrew/bin wins), so `dtv` always resolves to us.
for name in distro dtv; do
  cat > "$BIN_DIR/$name" <<EOF
#!/bin/sh
exec node "$INSTALL_DIR/dist/index.js" "\$@"
EOF
  chmod +x "$BIN_DIR/$name"
done

# 4. PATH + shadowing check. warn when a bare `distro` won't resolve to ours.
case ":$PATH:" in
  *":$BIN_DIR:"*)
    resolved=$(command -v distro 2>/dev/null || true)
    if [ -n "$resolved" ] && [ "$resolved" != "$BIN_DIR/distro" ]; then
      echo "⚠ another 'distro' is ahead of ours on PATH: $resolved"
      echo "  (likely the Python 'distro' package). use 'dtv' instead, or put"
      echo "  $BIN_DIR first: export PATH=\"$BIN_DIR:\$PATH\""
    fi
    ;;
  *) echo "ⓘ add $BIN_DIR to your PATH (e.g. in ~/.zshrc): export PATH=\"$BIN_DIR:\$PATH\"" ;;
esac

# 5. kick off onboarding. under `curl | sh` the script's stdin is the curl
# stream, so reattach the controlling terminal (/dev/tty) for the interactive
# github sign-in + pickers. fall back to a printed handoff when there's no tty
# (CI, `docker` without -t). distro init is idempotent, so a retry is safe.
if [ -e /dev/tty ] && (: < /dev/tty) 2>/dev/null; then
  echo "✓ installed — starting setup…"
  echo ""
  "$BIN_DIR/distro" init < /dev/tty || echo "ⓘ setup didn't finish — run: distro init  (or 'dtv init' if 'distro' is taken)"
else
  echo "✓ installed. run: distro init  (or 'dtv init' if 'distro' is taken)"
fi

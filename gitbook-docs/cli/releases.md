# CLI Releases

CLI versions are distributed via GitHub Releases, not npm.

## Tag convention

Releases are triggered by git tags matching `cli-v*`:

```sh
git tag cli-v0.1.0 -m "cli v0.1.0"
git push origin cli-v0.1.0
```

## The workflow

`.github/workflows/release-cli.yml` triggers on `cli-v*` tag push and:

1. Checks out the tagged commit.
2. Installs deps via pnpm (frozen lockfile).
3. Builds `@distrotv/cli` via `pnpm turbo run build --filter=@distrotv/cli`.
4. Stages `packages/cli/dist`, `package.json`, `LICENSE`, and `README.md` (if present) into `.release-staging/`.
5. Tars to `distrotv-cli.tar.gz`.
6. Creates a GitHub Release with the tarball attached and the short HEAD SHA in the release notes.

## install.sh

`frontend/public/install.sh` is the user-facing installer. It hits:

```
https://github.com/distroinfinity/devdrip/releases/latest/download/distrotv-cli.tar.gz
```

— a stable redirect to the latest release's `distrotv-cli.tar.gz` asset.

Steps the installer performs:

1. Verify Node 20+.
2. Download the tarball to a temp dir (cleaned up via EXIT trap).
3. Extract to `~/.distrotv` (or `$DISTROTV_HOME`).
4. Drop a wrapper script at `~/.local/bin/distro` (or `$DISTROTV_BIN`) that does `exec node ~/.distrotv/dist/index.js "$@"`.
5. Print a PATH hint if `~/.local/bin` isn't on PATH.

## First-time setup (post-M8 merge)

1. Confirm `packages/cli/LICENSE` and `packages/cli/package.json` version (e.g. `0.1.0`).
2. Tag and push: `git tag cli-v0.1.0 -m "cli v0.1.0" && git push origin cli-v0.1.0`.
3. Watch the Actions tab; the Release CLI workflow should produce the release.
4. Verify `https://github.com/distroinfinity/devdrip/releases/latest/download/distrotv-cli.tar.gz` returns the tarball.

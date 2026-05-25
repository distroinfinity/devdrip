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

## install.sh is served from Vercel — keep it off the Firewall challenge

The script itself is served as a static asset from the Vercel-hosted frontend (`distrotv.xyz`). The
tarball download (step 2 above) goes to `github.com` and is unaffected, but the **script fetch** sits
behind Vercel's edge Firewall. When Vercel serves a **challenge** mitigation — either Attack Mode is
toggled on, or automatic L7 DDoS mitigation triggers on a traffic spike / IP reputation / TLS
fingerprint — the response is `403` with `x-vercel-mitigated: challenge`. A challenge can only be
solved by a real browser running JS, so `curl … | sh` fails for every user during the episode.

**Required mitigation:** a Vercel WAF **Custom Rule with the `Bypass` action** matching path
`/install.sh` on the `distrotv` project. Bypass exempts the path from Attack Mode and system DDoS
challenges. This **cannot** live in `vercel.json` (only `challenge`/`deny` mitigate actions are
supported there) — it must be created in the dashboard (**Firewall → Configure → Add Rule**, or the
natural-language box: _"Bypass the firewall for requests where the path is `/install.sh`"_) or via
the Vercel API. If a versioned/extra installer path is added later, add it to the same rule.

Symptom history: users hit this `403` on 2026-05-24; the install one-liner is published in ~10 places
(landing, dashboard account page, gitbook docs) and is already in users' shells, so moving the URL is
not a cheap option — the Bypass rule is the durable fix.

## First-time setup (post-M8 merge)

1. Confirm `packages/cli/LICENSE` and `packages/cli/package.json` version (e.g. `0.1.0`).
2. Tag and push: `git tag cli-v0.1.0 -m "cli v0.1.0" && git push origin cli-v0.1.0`.
3. Watch the Actions tab; the Release CLI workflow should produce the release.
4. Verify `https://github.com/distroinfinity/devdrip/releases/latest/download/distrotv-cli.tar.gz` returns the tarball.

## cli-v0.2.0 (2026-05-22)

GitHub OAuth becomes the only sign-in path; email magic-link removed.

**Breaking:** users running `cli-v0.1.x` must re-run `distro init` to sign in with GitHub. The CLI no longer registers anonymous devices — `POST /devices/register` returns `410 Gone` server-side.

**Added:**

- `distro login` is implicit in `distro init` — the wizard opens the browser, GitHub OAuth completes, and the CLI receives a device token via `/devices/pair-poll`.
- `distro logout` — revokes the device on the backend and wipes `~/.distro/config.json`.
- `distro init --no-browser` — for headless / SSH installs; prints the setup URL + pair code instead of calling `open`.

**Removed:**

- Anonymous device registration. The CLI no longer functions without a GitHub-bound device.
- `/auth/magic-link/*` endpoints. The Resend dependency is gone.

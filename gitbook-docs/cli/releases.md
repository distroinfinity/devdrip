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

## How install.sh is hosted (and why it's off Vercel)

The installer one-liner is:

```sh
curl -fsSL https://get.distrotv.xyz/install.sh | sh
```

`install.sh` is served from **GitHub Pages** at the custom domain `get.distrotv.xyz`, deployed by
`.github/workflows/deploy-install.yml` from the single source of truth at `frontend/public/install.sh`.
The tarball it downloads still comes from GitHub Releases. **Nothing in the install path touches
Vercel** — GitHub Pages is plain static hosting (Fastly CDN) with no JS-challenge layer, so `curl`
always gets the raw bytes.

### Why not Vercel (the 2026-05-24 incident)

`install.sh` was originally served from the Vercel frontend (`distrotv.xyz/install.sh`). On
2026-05-24 users got `403` with `x-vercel-mitigated: challenge` — Vercel's edge Firewall served a JS
"Security Checkpoint" that only a real browser can solve, so `curl … | sh` died.

A WAF custom-rule **Bypass** on `/install.sh` is **not** a reliable fix for this. Vercel's
[rule execution order](https://vercel.com/docs/vercel-firewall) is:

1. platform-wide automatic DDoS mitigation
2. WAF IP blocking
3. WAF custom rules
4. managed rulesets

A `challenge` can be issued either at the WAF layer (Attack Mode / a WAF rule) **or** by step-1
automatic DDoS mitigation, and both emit the same `x-vercel-mitigated: challenge` header. A
custom-rule Bypass lives at step 3, so it is **never evaluated** for a request already challenged at
step 1. System-level mitigations can only be exempted with
[System Bypass Rules](https://vercel.com/docs/vercel-firewall/vercel-waf/system-bypass-rules), which
match **IP address / CIDR + domain — not path** (and are Pro/Enterprise-only). Because the installer
is hit by arbitrary user IPs, there is **no path-scoped way to exempt it from automatic DDoS
challenges on Vercel.** Hosting the script on a platform with no challenge layer removes the entire
class of failure — hence GitHub Pages.

Refs: [Vercel Firewall](https://vercel.com/docs/vercel-firewall) ·
[Firewall concepts](https://vercel.com/docs/vercel-firewall/firewall-concepts) ·
[System Bypass Rules](https://vercel.com/docs/vercel-firewall/vercel-waf/system-bypass-rules).

### One-time DNS / Pages setup

1. **GoDaddy DNS** (distrotv.xyz is on GoDaddy): add a CNAME — host `get` → `distroinfinity.github.io`.
2. **Repo → Settings → Pages**: source = **GitHub Actions**, custom domain = `get.distrotv.xyz`,
   enable **Enforce HTTPS** once the cert provisions.
3. Trigger `deploy-install.yml` (push to `main` touching `install.sh`, or run it manually via
   **workflow_dispatch**). The first run will fail until Pages is enabled with the Actions source.
4. Verify: `curl -fsSL https://get.distrotv.xyz/install.sh` returns the script (200).

The Vercel copy at `distrotv.xyz/install.sh` is kept as a fallback so older one-liners already in the
wild keep working when the Vercel challenge isn't firing.

## First-time setup (post-M8 merge)

1. Confirm `packages/cli/LICENSE` and `packages/cli/package.json` version (e.g. `0.1.0`).
2. Tag and push: `git tag cli-v0.1.0 -m "cli v0.1.0" && git push origin cli-v0.1.0`.
3. Watch the Actions tab; the Release CLI workflow should produce the release.
4. Verify `https://github.com/distroinfinity/devdrip/releases/latest/download/distrotv-cli.tar.gz` returns the tarball.

## cli-v0.2.6 (2026-05-25)

**Changed:** slots now render via Claude Code's **statusLine** instead of the daemon drawing to the TTY. The daemon publishes the current slot as one line to `~/.distro/now-playing.json`; `distro statusline` prints it; `distro init` points Claude's `statusLine` at that command. This pins the slot to the bottom (Claude-owned, replaced in place) with zero terminal contention — fixing both the original corruption and the 0.2.4/0.2.5 inline-scrollback spam. Existing users must re-run `distro init` to wire the `statusLine` config, then restart Claude Code. See `architecture/slot-rendering.md`.

## cli-v0.2.5 (2026-05-25)

**Fixed:** `distro upgrade` checked the npm registry (`registry.npmjs.org/@distrotv/cli`) which 404s — the CLI ships via GitHub Releases, not npm. The update check now reads the latest release tag from `api.github.com/repos/distroinfinity/devdrip/releases/latest` and the upgrade hint points at the `curl … get.distrotv.xyz/install.sh | sh` one-liner. Users on ≤ 0.2.4 must re-run the install one-liner once to pick up the working check.

## cli-v0.2.4 (2026-05-25)

**Fixed:** slots no longer corrupt Claude Code's TUI — the bottom-pane overlay (scroll-region + cursor save/restore + repaint timers) was replaced with inline append-only rendering. See `architecture/slot-rendering.md`.

**Added:** the daemon reports device `os` / `ide_type` / `device_name` / `cli_version` on startup (`POST /devices`, updated by device id), so admin device analytics populate.

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

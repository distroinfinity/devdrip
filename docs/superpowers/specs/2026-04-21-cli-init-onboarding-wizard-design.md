# devdrip init — onboarding wizard (S2-07) — design

## Context

`devdrip init` is the single command a new user runs after installing the CLI. It turns a fresh machine into a working DevDrip install: OAuth session, registered device, Claude Code hook entries, user's ad category preferences, and a preview of a real ad served by the existing ads waterfall. Target audience is the Phase 1 MVP — roughly 100 developers.

The Notion ticket (S2-07) under-specifies several nuances (backup strategy, idempotency semantics, hook-entry identification, dependency on a preferences endpoint that doesn't exist yet) and over-scopes others (daemon start, monthly earnings formula). This spec resolves those and pulls exactly the pieces of adjacent tickets needed to make init runnable end-to-end against the existing Carbon-primary / manual-fallback waterfall.

## Goals

- A new user runs `devdrip init` once and has a complete, working DevDrip install afterwards.
- The wizard is short (≤ 20s typical, 3 user-facing actions) and safe to re-run — each step detects prior state and heals instead of double-writing.
- Init uses the real ads pipeline for the preview step. No stubs, no fake ads.
- The install can be uninstalled cleanly via the backup file created on first run.

## Non-goals

- Daemon start / hook handler implementations (owned by S2-10 / S2-11).
- Full `devdrip doctor` (S5-02) — init inlines a four-probe subset only.
- Multi-width renderer, action-key footer, `[DEMO]` badge (S3-01 / S5-04).
- `--yes` / non-interactive mode, shell completion, IDE-extension install.
- Privacy / data-sharing consent screen — deferred to a future polish ticket (tracked as TODO).
- Two-way preferences sync, `GET /preferences`, dashboard preferences UI, 30-min daemon sync loop (all remain in S4-06).

## Success criteria

- `devdrip init` on a fresh machine completes, leaves behind a config file, a device row, a preferences row, and merged hook entries in `~/.claude/settings.json`.
- Running `devdrip init` a second time takes ~2s, shows six ✓ lines + the category re-prompt, and produces no duplicate entries anywhere.
- Running `devdrip demo` (or the preview step in init) renders a real ad returned by `GET /ads/next` via the existing waterfall.
- Running `devdrip init` with `~/.claude/` absent exits non-zero with a clear "install Claude Code first" message and changes no state.

## Wizard flow

The command has seven visible steps. Each detects its own state first — if already done, it prints `✓ …` and moves on; otherwise it runs the work.

1. **auth** — read `~/.devdrip/config.json`; if missing or refresh-invalid, run the existing `runLogin()` flow from `commands/auth.ts` (browser OAuth). Else `✓ signed in as @<handle>`.
2. **claude code detected** — `stat ~/.claude`. If missing → hard error: `Claude Code not found at ~/.claude. Install it first: https://claude.ai/download` and `exit 1`. Changes nothing.
3. **device registered** — call existing `registerDevice(token, apiUrl)` from `lib/device.ts` (backend already upserts on `(userId, machineIdHash)`). Store the returned `device.id` in config under a new `device: { id }` field. `✓ device: <hostname> (<os>/<ide>)`.
4. **category selector** — the one interactive prompt. `@clack/prompts` `multiselect()` over all seven `AdCategory` values, all pre-checked. User unchecks categories they don't want; hitting enter immediately accepts all. On re-run, pre-checks load from the saved `blockedCategories`.
5. **preferences saved** — `PUT /me/preferences` with `{ blockedCategories, tzOffsetMinutes }`. `maxPerHour` / `maxPerDay` / `quietHoursStart/End` are left to DB defaults and future config/dashboard tickets.
6. **hooks installed** — merge into `~/.claude/settings.json` per Section "Hook merge" below. First-install backup created at `~/.claude/settings.json.devdrip-backup` if it doesn't already exist.
7. **ad preview** — call `commands/demo.ts` in-process: one `GET /ads/next?surface=terminal-tv&deviceId=<id>` → `renderBox()` → wait for enter. On 204 (no ad available), print a graceful "no ads queued right now — try `devdrip demo` after your next Claude session" and continue.

After Step 7, an inline four-probe health check runs (see "Health check"), then the summary + earnings projection prints.

**User-visible actions total:** browser OAuth (only on first install) + category multi-select + enter to dismiss the preview ad. **Runtime:** ~10–30s first run, ~2s subsequent runs.

## Hook merge

Claude Code reads `~/.claude/settings.json` and expects hooks in this shape:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "*", "hooks": [{ "type": "command", "command": "<bin> hook pre-tool" }] }
    ],
    "Stop": [{ "hooks": [{ "type": "command", "command": "<bin> hook stop" }] }],
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "<bin> hook prompt-submit" }] }
    ]
  }
}
```

**Binary path.** Resolve the running binary's absolute path at init time via `realpathSync(process.argv[1])` (falling back to `process.execPath + scriptPath` for symlinked bins). Persist it in `~/.devdrip/config.json` under `cli: { binPath }`. Use the persisted absolute path verbatim in each hook `command` so Claude Code doesn't need PATH to find us. On re-run from a different Node/nvm environment, the path gets re-resolved and the hook entries get updated in place.

**Isolation from other tools.** Never modify another matcher group. For each of the three events we always append **our own matcher group** to the event array. Multiple groups per event are legal — Claude Code runs each matching group in order. This guarantees no interference with existing hooks from MCP servers or other tools.

**Idempotency.** A group is "ours" if any `hooks[].command` matches the regex `\s(hook (pre-tool|stop|prompt-submit))(\s|$)` AND resolves to our binary path. On a second run:

- found, current binary path → skip, print `✓ hooks already installed`.
- found, stale binary path → update in place (version bump / nvm switch).
- not found → append.

**Backup.** `~/.claude/settings.json.devdrip-backup` is written **only if it doesn't already exist**. The first-ever backup is the one that matters for uninstall; subsequent runs never overwrite. If no `settings.json` existed before init, the backup is the empty file `{}`.

**Atomic write.** Use `<target>.tmp.<random>` + `rename()`. Same pattern as `writeConfig()` in `lib/config.ts`. Crash mid-write leaves the original untouched.

**Edge cases.**

- `~/.claude/` missing → hard error in Step 2 before we get here; this step never runs.
- `settings.json` missing → write fresh one with just our hooks.
- `settings.json` malformed JSON → refuse, print parse error + path, exit non-zero, instruct the user to fix or delete.
- `settings.json.hooks` exists but is a non-object → same as malformed.

**Module.** Everything goes in `packages/cli/src/lib/claude-settings.ts`. Exposes:

- `readSettings(path): Settings` — returns the parsed object; returns `{}` if the file is missing (not an error); throws on malformed JSON.
- `writeSettingsAtomic(path, settings): Promise<void>` — tmp-file + rename.
- `mergeDevdripHooks(settings, binPath): { next: Settings, changed: boolean }` — pure function, returns the updated settings plus whether anything changed (so init can skip the write + print `✓ already configured` when `changed=false`).
- `writeBackupOnce(srcPath, backupPath): Promise<void>` — copies `srcPath` → `backupPath` only if `backupPath` doesn't already exist. Writes `"{}\n"` to backup when source is missing.

Merge is pure so it's testable without filesystem access.

## Backend: `PUT /me/preferences`

Small additive route registered in `packages/api/src/app.ts` alongside `GET /me`. Route file: `packages/api/src/routes/me-preferences.ts`.

**Auth / rate limit.** `requireAuth` middleware, `userLimiter`.

**Body.** All keys optional; unknown keys rejected.

```json
{
  "blockedCategories": ["developer-recruiting"],
  "tzOffsetMinutes": -330
}
```

**Validator.** New file `packages/api/src/validators/preferences.validators.ts`, hand-written in the same style as the other validators. Rules:

- `blockedCategories` — must be an array; each element must match an `AdCategory` enum value.
- `tzOffsetMinutes` — integer within `[-720, 840]` (Etc/GMT+12 to Pacific/Kiritimati).
- Any other key → 400 `{ error: "unknown_field" }`.

**Handler.** Drizzle upsert on `preferences.userId`:

```typescript
db.insert(preferences)
  .values({ userId, blockedCategories, tzOffsetMinutes })
  .onConflictDoUpdate({
    target: preferences.userId,
    set: { blockedCategories, tzOffsetMinutes, updatedAt: sql`now()` },
  })
  .returning()
```

Only columns present in the request body are written on conflict — unspecified fields are preserved. Implementation builds the `values` and `set` objects dynamically from the validated input.

**Response.** `200 { preferences: { blockedCategories, enabledSurfaces, maxPerHour, maxPerDay, quietHoursStart, quietHoursEnd, tzOffsetMinutes, idleSensitivityMs } }` — the full current row, so the CLI (and future dashboard) can confirm what got saved.

**Tests.** New `packages/api/src/__tests__/preferences-routes.test.ts` with: first-write inserts, second-write updates existing row, invalid category value returns 400, unknown key returns 400, unauthenticated returns 401.

**S4-06 scope note.** This endpoint is the `PUT` half only. S4-06 retains ownership of `GET /preferences`, 30-min daemon sync loop, last-write-wins conflict resolution, and the dashboard preferences UI. A comment will be posted on S4-06 after merge.

## Renderer

New file `packages/cli/src/lib/render-box.ts`. Pure function:

```typescript
renderBox(ad: ServedAdPayload, opts?: { earningsUsdc?: number, source?: string }): string
```

MVP behavior — fixed 72-column width, unicode box-drawing chars, ASCII fallback when `!process.stdout.isTTY` or `NO_COLOR=1` is set. Word-wrapped body at width-4. Header shows `DEV DRIP TV` and the source badge; footer shows `press enter to dismiss`. No action-key footer (`[D][S][K][M]`) and no progress bar — those come with S3-01 and the daemon-driven display.

**Sample output:**

```
╔═ DEV DRIP TV ═══════════════════ via Carbon ══╗
║                                                ║
║  Vercel — ship web apps that scale             ║
║  Deploy Next.js in seconds with zero config.   ║
║                                                ║
║  Learn more → vercel.com                        ║
║                                                ║
║                  press enter to dismiss         ║
╚════════════════════════════════════════════════╝
```

**Tests.** Snapshot three representative ads: short, long word-wrapped, unicode body.

## `devdrip demo` command

`packages/cli/src/commands/demo.ts`. One-shot flow:

1. Read config. Not signed in → error + exit 1.
2. Ensure `device.id` in config; if missing, re-register via existing `registerDevice()`.
3. `GET /ads/next?surface=terminal-tv&deviceId=<id>` via `apiFetch`.
   - 204 → print "no ads queued right now — try again after your next Claude session", exit 0.
   - 200 → parse `{ ad }` (snake_case per existing route).
4. Render via `renderBox()`, print.
5. Wait for a single enter press (readline); exit 0.

Demo uses the real waterfall. In local dev without `CARBON_ZONE_KEY`, the seeded manual campaign serves. In prod with a Carbon zone key, Carbon serves. No separate "demo" code path, no fake ads.

**S5-04 scope note.** This is the MVP cut. S5-04 retains ownership of the `[DEMO]` badge, full key-practice ([D] dismiss, [S] skip, [K] kill, [M] mute), and vanish-timing stats shown after dismiss.

## Health check (inline mini-doctor)

No separate command, just four verification lines printed as the last wizard step before the summary:

```
health check:
  ✓ auth valid (GET /me)
  ✓ device registered (id: abc12345…)
  ✓ hooks installed in ~/.claude/settings.json
  ✓ backend reachable (GET /health)
```

Implementation: `packages/cli/src/lib/health.ts` exposes `runInitHealthCheck(cfg): Promise<Probe[]>` that returns four `{ name, ok, detail }` records. Probes run in parallel via `Promise.all`, each with a 500ms fetch timeout — worst-case total ~500ms. `init.ts` prints the results in fixed order (auth, device, hooks, backend) regardless of resolve order.

Any probe failing → init still prints the summary but exits with status 1 and appends a hint: "one or more health checks failed — run `devdrip doctor` once S5-02 ships for detailed remediation". A single ✗ line makes it obvious which probe failed.

**S5-02 scope note.** Full `devdrip doctor` command with colored output, per-failure remediation text, plus daemon / ad-cache / tty / disk probes remains in S5-02.

## Summary + earnings projection

Final output block:

```
✓ all set.

early-mvp earnings estimate: ~$0.13–$0.27/month
  assumes 4h Claude usage/day · 2–4 ads/hr · $0.80 CPM · 70% dev share
  that's ~$0.00056 per ad — rates climb as premium campaigns join.
  → dashboard: https://devdrip.xyz (coming soon)
  → run `devdrip status` to see actual earnings

open a new Claude Code session to start earning.
```

**Formula:** `monthly = hoursPerDay × adsPerHour × 30 × (cpm / 1000) × devShare`.

- `hoursPerDay = 4` (MVP assumption, labeled as "assumes" in copy).
- `adsPerHour` range — `2` (light) to `4` (moderate default; half of `MAX_ADS_PER_HOUR_TOTAL`).
- `cpm = 0.80` (matches `CARBON_CPM_RATE` default in `packages/api/src/config/env.ts`). If the CLI can read the actual rate from the API it should — otherwise fall back to the constant.
- `devShare = REVENUE_SHARE_DEVELOPER` (`0.7`) — imported from `@devdrip/shared/constants`.

Worked example: light = `4 × 2 × 30 × 0.0008 × 0.7 = $0.134`; moderate = `4 × 4 × 30 × 0.0008 × 0.7 = $0.269`. Numbers in the printed block above reflect this.

Honest framing is intentional — promising big numbers to 100 early MVP devs and then delivering cents is worse than under-promising. The per-ad rate ($0.00056) plus "rates climb as premium campaigns join" positions the estimate correctly. Dashboard URL is stubbed for MVP; replaced when S4 ships.

## Config schema additions

`~/.devdrip/config.json` gains two fields. Bump `CONFIG_VERSION` from 1 to 2. Legacy v1 configs are migrated in place on first read: `device = { id: null }`, `cli = { binPath: <resolved> }`.

```typescript
interface DevdripConfig {
  version: 2
  apiUrl: string
  auth: { accessToken; refreshToken; accessTokenExpiresAt }
  user: { id; githubLogin; email; avatarUrl }
  device: { id: string | null } // new
  cli: { binPath: string } // new
}
```

**Migration rule.** `readConfig()` accepts both v1 and v2 shapes; when it reads v1 it returns a v2 object with `device: { id: null }` and `cli: { binPath: "" }` (empty string is the "not yet resolved" sentinel). Init's hook-merge step always re-resolves `cli.binPath` and writes the config back, so the sentinel is guaranteed to be filled on the first init run after upgrade. `writeConfig()` always writes v2.

## File / module layout

**New files:**

- `packages/cli/src/lib/claude-settings.ts` — read / merge / atomic-write of `settings.json`.
- `packages/cli/src/lib/render-box.ts` — pure-function renderer.
- `packages/cli/src/lib/preferences-client.ts` — `putPreferences(cfg, body)` wrapper around `apiFetch`.
- `packages/cli/src/lib/health.ts` — four-probe init health check.
- `packages/api/src/routes/me-preferences.ts` — `PUT /me/preferences`.
- `packages/api/src/validators/preferences.validators.ts` — input validation.
- `packages/api/src/__tests__/preferences-routes.test.ts` — route tests.
- `packages/cli/src/lib/__tests__/claude-settings.test.ts` — merge idempotency across five fixtures.
- `packages/cli/src/lib/__tests__/render-box.test.ts` — three snapshot tests.
- `packages/cli/src/commands/__tests__/init.test.ts` — integration against a temp `$HOME`.

**Changed files:**

- `packages/cli/src/commands/init.ts` — placeholder → full wizard.
- `packages/cli/src/commands/demo.ts` — placeholder → one-shot fetch + render.
- `packages/cli/src/lib/config.ts` — add `device`, `cli` fields, v1→v2 migration.
- `packages/cli/package.json` — add `@clack/prompts` dependency.
- `packages/api/src/app.ts` — register `me-preferences` route.

**Deps added:** `@clack/prompts` (zero runtime deps, ~20kb, matches shadcn/create-next-app style).

## Testing

**Unit (cli):**

- `claude-settings.test.ts` — merge across five fixtures: empty file, missing `hooks` key, our hooks already present (no-op), other-tool hooks present (preserved, ours appended), malformed JSON (throws).
- `render-box.test.ts` — three snapshots: short ad, long ad that triggers word-wrap, ad with unicode body.
- `health.test.ts` — each probe with `fetch` mocked for 200 / 4xx / timeout.
- `config.test.ts` — v1→v2 migration on read.

**Unit (api):**

- `preferences-routes.test.ts` — insert, update, invalid category, unknown key, unauthenticated.

**Integration (cli):**

- `init.test.ts` — run the full wizard against a temp `$HOME` with stdin stubbed via `@clack/prompts` test helpers. Mock the API with a tiny Express instance (same pattern as existing CLI tests). Assert config.json + settings.json + settings.json.devdrip-backup contents after run. Re-run and assert no duplicate entries.

## Local demo / manual test plan

```bash
# 1. bring up local postgres
bash ~/.superset/worktrees/devdrip/setup-worktree.sh --db-up

# 2. migrate + seed (seeded manual campaign serves ads when CARBON_ZONE_KEY is empty)
pnpm --filter @devdrip/api db:migrate
pnpm --filter @devdrip/api db:seed

# 3. start api in dev
pnpm --filter @devdrip/api dev    # listens on :3000

# 4. build the cli
pnpm --filter @devdrip/cli build

# 5. run the wizard against local api
DEVDRIP_API_URL=http://localhost:3000 node packages/cli/dist/index.js init

# 6. verify state via curl + file inspection
cat ~/.devdrip/config.json | jq '{ handle: .user.githubLogin, device: .device.id, bin: .cli.binPath }'
cat ~/.claude/settings.json | jq '.hooks'
cat ~/.claude/settings.json.devdrip-backup | jq '.'
TOKEN=$(jq -r .auth.accessToken < ~/.devdrip/config.json)
curl -s http://localhost:3000/me -H "Authorization: Bearer $TOKEN" | jq
curl -s "http://localhost:3000/ads/next?surface=terminal-tv&deviceId=$(jq -r .device.id < ~/.devdrip/config.json)" \
     -H "Authorization: Bearer $TOKEN" | jq

# 7. verify idempotency
node packages/cli/dist/index.js init
# → six ✓ lines, ~2s runtime, no duplicate hooks

# 8. exercise demo directly
node packages/cli/dist/index.js demo
# → ad box renders from the real waterfall

# 9. sanity-check hook wiring (handlers still TODO from S2-11, must exit 0)
$(jq -r .cli.binPath < ~/.devdrip/config.json) hook pre-tool < /dev/null ; echo "exit=$?"
# → exit=0
```

**Reset between test runs:**

```bash
rm -rf ~/.devdrip
# restore claude settings from backup
[ -f ~/.claude/settings.json.devdrip-backup ] && mv ~/.claude/settings.json.devdrip-backup ~/.claude/settings.json
```

## Open TODOs (future tickets)

- Privacy / data-sharing consent screen — deferred from this ticket per MVP scope decision. Add a ticket for a dedicated first-run consent step plus a `--show-privacy-notice` flag before public release.
- Non-interactive mode (`--yes` + flag-based category / frequency selection) for CI/scripted installs.
- Multi-width renderer + action-key footer — S3-01.
- `[DEMO]` badge + key practice + vanish stats — S5-04.
- Full `devdrip doctor` with colored output + remediation — S5-02.
- Two-way preferences sync + 30-min daemon loop — S4-06.

## Sprint ticket updates (post-merge)

- **S2-07 (this)** — mark Done. Post comment summarizing what shipped, what was descoped (daemon start, frequency prompt, consent screen), and what was pulled forward.
- **S4-06 (Preferences sync API)** — scope shrinks. `PUT /preferences` shipped in S2-07. Remaining: `GET /preferences`, 30-min daemon sync loop, last-write-wins conflict resolution, dashboard preferences UI.
- **S3-01 (ANSI box renderer)** — minimal `renderBox()` shipped in S2-07 (fixed 72 cols, no action keys, no progress bar). Remaining: 50/60/80/100 col adaptation, `[D][S][K][M]` footer, progress bar, polished source/advertiser badges.
- **S5-04 (devdrip demo command)** — minimal one-shot shipped in S2-07. Remaining: `[DEMO]` badge, interactive key practice, vanish-timing stats.
- **S5-02 (devdrip doctor command)** — inline four-probe health check shipped in `init`. Remaining: full standalone `doctor` with colored pass/fail, per-failure remediation, daemon/cache/tty/disk probes.
- **S2-11 (Hook commands)** — unchanged. Note that `devdrip init` now writes hook entries pointing at `devdrip hook pre-tool|stop|prompt-submit`; S2-11 still owns implementing the real handlers.

## Gitbook doc updates

- `gitbook-docs/cli/current-state.md` — replace `devdrip init` placeholder section with the wizard walkthrough.
- `gitbook-docs/backend/api.md` — add `PUT /me/preferences` endpoint reference.

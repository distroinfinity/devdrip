# Ads

Sponsored slots are the default feed. They play in the Claude Code status line while the
agent works. Advertisers pay Distro; Distro pays the developer a share of each ad they actually
see and keeps a margin. The split is internal (`REVENUE_SHARE_DEVELOPER`) and is never shown to users.
News, markets and utilities are opt-in channels on the same surface.

Status: on the `ad-exchange` branch, runs locally. Not deployed, not released.

## Flow

```
Carbon SDK ─┐
            ├─ ad-supply.service ─ GET /me/content/next ─ slot cache ─ orchestrator ─ status line
house ads ──┘        │ inserts ad_impressions row (result = pending)          │
                     │                                           ledger.impressions (SQLite)
GET /c/:code ────────┤ marks clicked, fires click beacon, 302                 │
GET /ads/click/:id ──┘                                            POST /ingest impressions[]
                 ad_impressions (Postgres) ─ /me/earnings/* ─ /dashboard/revenue
```

1. `GET /me/content/next` reads `preferences.enabled_feeds` and asks `nextAds()` for the ad
   share of the batch. Carbon fills the first slot when it has an ad; house ads fill the rest.
2. Every served ad is inserted into `ad_impressions` as `pending`. **That row is the delivery
   record.** It lives in Postgres rather than Redis so deliveries survive API restarts (the
   local Redis stand-in is in-memory).
3. The CLI shows the slot for up to 12s. On vanish the state machine emits `recordImpression`;
   the orchestrator writes the local ledger; the sync loop posts `impressions[]` to `/ingest`.
4. `/ingest` fills the pending row: duration, result, `earned_amount`. A row that is already
   filled is left alone, so a retried batch never pays twice.
5. A click goes through our redirect. It marks the row clicked and sends a 302 to the
   advertiser. The target comes only from the row, never from the request.

## The panel

```
▍ AD  Linear                                                  +$0.0070
▍ Plan and build products. Issue tracking your team will actually use.
▍ ↗ https://api.distrotv.xyz/c/3f0c2f0e7f1a  ⌘ click     est. today $0.0770
```

- Every row starts with the bar: Claude Code strips leading whitespace from status lines, so
  indentation cannot group the block.
- The click URL is printed in full and never truncated. Terminals make a visible `http(s)://`
  URL cmd/ctrl-clickable, which is the only same-terminal click that needs no key capture
  (raw-mode key capture fights Claude Code for the tty and stays disabled).
- On narrow terminals the hint drops first, then the daily total.
- `dtv open` opens the ad on screen from any terminal. OSC 8 hyperlinks are opt-in:
  `DISTRO_HYPERLINKS=1`.
- Ad copy is third-party text. `render-sponsored.ts` strips escape sequences and control bytes.

## Direct ads (advertiser portal)

Anyone signed in can write an ad at `/advertisers/portal`: brand, one line (≤140), an https
link and a CPM bid (1–100). It is stored in `ad_campaigns` and served as `source: "direct"`,
`ad_id = "direct:<id>"`.

- **Order:** direct ads first, highest bid first (oldest first on ties), rotating so every
  active ad gets served. They take at most half of a batch; the rest is Carbon, then house ads.
- **Price:** the bid is the impression's `cpm_rate`, so a higher bid also pays the viewer more.
  Nothing is charged in the pilot; `stats.spend` is what the paid views would have cost.
- **Stats** (`served`, `views`, `clicks`, `ctr`, `spend`) are read straight from `ad_impressions`.
- **Old clients:** the cli sends its version (`?v=`) with every content request; sponsored
  slots go only to 0.3.0+, which can draw the panel.
- **Safety:** https links to a public host only, no credentials in the url, length limits,
  escape sequences and control bytes stripped on write and again at render, 10 ads per user.
  New ads are `active` at once only when `AD_AUTO_APPROVE` is on (default on outside
  production) or the author is an admin (`ADMIN_EMAILS`). **Production runs with it off**: ads
  start in `review`, and an advertiser cannot approve their own ad. Admins review through
  `GET /admin/ads?status=review` and `PATCH /admin/ads/:id { status }`; there is no review page yet.
- **Carbon pool:** Carbon returns one ad per call, so the API keeps a pool of up to 8 distinct
  ads (3 calls at most once a minute, 30-minute ttl) and fills three of every four network slots
  from it, rotating; the fourth is a house ad. With an empty pool, house ads fill everything.
- **Fill in production:** house ads are Distro TV's own promos only (the recognisable dev-tool
  creatives are local-only), and Carbon serves only with a real `CARBON_ZONE_KEY` or
  `CARBON_ENABLED=1` — its sandbox zone must be a deliberate choice for a public audience.
- Importing from Google Ads / Meta Ads / Amazon Ads is shown as coming soon. The plan is a
  read-only copy of the creative (search ads are text, so they map one to one); it needs each
  platform's API approval and is not built.

## Earnings rule

An ad pays when it was on screen for at least one second and was not skipped:

```
earned = durationMs >= 1000 && result !== "skipped" ? AD_CPM_RATE / 1000 * 0.70 : 0
```

The rule lives in two places that must change together: `computeEarned`
(`packages/api/src/services/ad-impression.service.ts`) and the ledger's `sumTodayOptimistic`
(`packages/cli/src/lib/ledger.ts`). All money is an **estimate**; Carbon's SDK returns no price.

## Feeds

`preferences.enabled_feeds` (`Feed = "ads" | "news" | "markets"`, default `["ads"]`):

| Feeds                     | What plays                                  |
| ------------------------- | ------------------------------------------- |
| ads                       | every slot is sponsored                     |
| ads + news and/or markets | alternate ad / content, starting with an ad |
| news and/or markets       | content only, earns nothing                 |
| none                      | nothing                                     |

With both content feeds on, `channelMode` sets the news:markets ratio. Utilities (CH 03) is a
local toggle, off by default. Change feeds with `dtv preferences` (applies at once: the daemon
fingerprints prefs and refreshes the slot cache) or on the dashboard preferences page (applies
at the next cache refresh, a few minutes).

## Data

`ad_impressions`: `id`, `user_id`, `device_id`, `delivery_id` (unique), `ad_id`, `source`
(`carbon` | `house`), `advertiser`, `headline`, `target_url`, `click_beacon_url`,
`view_beacon_url`, `duration_ms`, `result` (`pending` | ImpressionResult), `clicked`,
`clicked_at`, `cpm_rate`, `earned_amount`, `created_at`. Migrations `0023`, `0024`.

`served` = all rows, `impressions` = rows that are no longer `pending`. The gap is fill that
was cached by a device but never shown.

## Endpoints

| Route                                                                        | Auth   | Purpose                                                                  |
| ---------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| `GET /me/content/next`                                                       | bearer | slots by enabled feeds                                                   |
| `POST /ingest` `impressions[]`                                               | bearer | `{ deliveryToken, durationMs, result }` → index-aligned `{ ok, error? }` |
| `GET /c/:code`                                                               | public | short click link: first 12 hex chars of the delivery id                  |
| `GET /ads/click/:deliveryId`                                                 | public | long click link                                                          |
| `GET /advertiser/ads` · `POST /advertiser/ads` · `PATCH /advertiser/ads/:id` | bearer | advertiser portal: list with stats, create, pause / resume               |
| `GET /me/earnings/summary` · `/timeseries?days=` · `/recent?limit=`          | bearer | dashboard                                                                |

Ingest errors `invalid_or_expired_delivery_token` and `delivery_not_owned` are in the CLI's
terminal set, so a bad row is tombstoned instead of retried forever.

## Env

| Var                | Default    | Notes                                     |
| ------------------ | ---------- | ----------------------------------------- |
| `CARBON_ZONE_KEY`  | empty      | empty = Carbon's demo zone (pays nothing) |
| `CARBON_PLACEMENT` | `distrotv` |                                           |
| `AD_CPM_RATE`      | `10`       | estimated USD CPM                         |

## Known gaps

- Carbon's demo zone pays nothing, and serving Carbon ads server-side into a terminal needs a
  real publisher agreement and zone before production.
- In the demo zone Carbon's `link` equals its `statlink`, so the redirect itself counts the
  click and no extra beacon fires. `statviewUrl` comes back empty.
- House ads are demo creatives, not sold inventory.
- Pending rows that are never shown are not pruned.
- A 12-hex short code is 48 bits; enough for a demo, not a fraud control. No fraud controls
  exist beyond single-use delivery rows and the one-second view rule.
- Existing users would get `enabled_feeds = {ads}` from the column default if `0023` ran in
  production. Flipping real users to ads needs explicit consent first.

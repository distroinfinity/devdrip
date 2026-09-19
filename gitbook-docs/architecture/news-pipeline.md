# News pipeline

Distro TV pulls public news feeds into Postgres on a 5-min cron, then scores them per device at sync time. M3 introduced this end-to-end.

## Data model

- **`channels`** — six fixed channels (`tech`, `finance`, `crypto`, `ai-papers`, `design`, `gaming`). Tech + Finance are default-on for new users.
- **`channel_subscriptions`** — composite PK on `(user_id, channel_id)` with `priority` (0 = top). Defaults are auto-created lazily on first call to `getSubscriptionsForUser` or `nextPicksForDevice`.
- **`news_sources`** — `(channel_id, key, kind, url, half_life_hours, fetch_interval_min, healthy, last_fetched_at, last_error)`. Seeded via migration 0012 with 11 default sources.
- **`news_items`** — `(id text PK, channel_id, source_id, headline, url, comments_url, score, comments_count, published_at, fetched_at)`. Indexed on `(channel_id, published_at)` for the selection query and `(published_at)` for global recency.

The text PK on `news_items.id` uses namespaced source-stable identifiers (`hn:38291043`, `rss:techcrunch:<sanitized-guid>`, `reddit:<id>`), which makes upserts cheap and prevents duplicate ingestion across ticks.

## Fetcher worker

Scheduling lives in `packages/api/src/scheduler.ts` (`startScheduler()`): news fetch on `*/5 * * * *`, alert eval on `*/1`, and a source-health sweep on `*/15`, plus an eager `runFetchTick(0)` on boot so a fresh process doesn't wait 5 min for its first news.

`startScheduler()` runs in **two** places: the standalone `worker.ts` entry (`worker:start`, kept for local dev / future scale-out) **and in-process inside the API** (`index.ts`, gated by `RUN_INPROCESS_WORKER`, default on). Prod runs only the single Railway API service, so without the in-process path the cron never fired and `news_items` stayed empty — the API start command (`node packages/api/dist/index.js`) never started `worker.js`. The per-source Redis lock means even multiple API instances won't double-fetch. Set `RUN_INPROCESS_WORKER=false` only if a dedicated worker service is added, so the two don't double-schedule.

Each tick walks every `news_sources` row whose `fetch_interval_min` divides the current minute bucket and dispatches by `kind` to a per-protocol fetcher:

- `news-fetchers/hn.ts` — HN Firebase API. Top 60 ids, batches of 10 concurrent fetches, filters `type === "story"` and `score >= 50`.
- `news-fetchers/rss.ts` — `fast-xml-parser`. Handles RSS 2.0 (`<channel><item>`) and Atom (`<feed><entry>`). Maps source enum from key prefix.
- `news-fetchers/reddit.ts` — `<sub>/top.json?t=day`.

All three set a 15s `AbortSignal.timeout` to prevent stalled HTTP from holding source locks. Per-source Redis lock (`news:fetcher:lock:<source_id>`, 90s TTL) prevents overlap if two pods race.

On success: source row gets `healthy=true, lastError=null, lastFetchedAt=now`. On error: `healthy=false, lastError=<msg>`. The coordinator continues with other sources — one bad URL doesn't block the rest.

## Selection

`/me/content/next` (route in `packages/api/src/routes/me-content.ts`) calls `nextPicksForDevice({ userId, deviceId, n })`:

1. **Hot path:** if `news:nextpicks:<deviceId>` (Redis, 5-min TTL) is non-empty, slice and return. Sparse-channel users get partial results rather than a tight DB-poll loop.
2. Else, ensure the user has default subscriptions (idempotent INSERT…SELECT…ON CONFLICT).
3. Pull subscribed channels with `(channelId, key, priority)`.
4. Pull up to 200 newest items from those channels (≤ 72h old), joined to `news_sources` for `key` and `halfLifeHours`.
5. Score every candidate:

   ```
   score = 0.45 · recency_decay(age_hours, half_life_hours)
         + 0.20 · log10(score + 1) / 3
         + 0.30 · 1 / (1 + channel_priority)
         + 0.05 · is_first_time
   ```

   Per-source `half_life_hours` lets HN (6h) decay faster than RSS (24h) or Smashing Magazine (72h).

6. **Tiered picks** so the surface always trends toward fresh content:
   - **tier 1 (preferred):** items neither in `news:served:<deviceId>` nor in `news:offered:<deviceId>` (recently offered). Take the top `n`. Serving **fewer than `n` is intentional** — the CLI slot-cache handles partial batches, and a short fresh batch beats padding with repeats.
   - **recycle (only if tier 1 is empty):** fresh inventory is exhausted for this device, so rather than show an empty surface we serve offered-but-never-rendered items, then already-served — both score-ranked — and `DEL` the offered set to start a new cycle.
7. Write the `n` picks to `news:nextpicks:<deviceId>` (5-min TTL) **and** add their ids to `news:offered:<deviceId>` (`recentlyOfferedKey`, ~4h TTL). Offered is marked **at selection time**; served is still marked on impression (see "Dedupe" below).

## Failure modes

| failure                              | behavior                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source 4xx/5xx                       | Mark `news_sources.healthy=false`, write `lastError`. Coordinator continues other sources.                                                                                            |
| HTTP stall                           | 15s `AbortSignal.timeout` aborts; same as 4xx path.                                                                                                                                   |
| Empty news_items + empty Redis queue | `/me/content/next` returns `{ items: [] }`. CLI slot-cache falls back to the single offline demo fixture. If this persists, the scheduler isn't running — check `/admin/news-health`. |
| Bloomberg blocks bot UA              | Marked unhealthy on first tick. HN + TechCrunch + Verge + Smashing + ArsTechnica + Polygon + Reddit carry the demo.                                                                   |
| Worker process killed mid-fetch      | Per-source Redis lock expires after 90s; next tick proceeds normally.                                                                                                                 |

## Dedupe — two sets

Repetition ("the same handful over and over") is governed by two Redis sets, on purpose:

- **`news:offered:<deviceId>`** (SET, ~4h TTL) — marked **at selection time**. Hard-excluded from tier-1 picks. This is what guarantees a device doesn't get the same batch back even if impressions never sync (cache eviction, daemon crash, flaky `/ingest`, user closes Claude before a slot fires). Closing that window was the fix for the repeating-handful symptom.
- **`news:served:<deviceId>`** (SET, 30d TTL) — marked **on impression** only. The CLI POSTs to `/ingest` after a slot displays for ≥1ms and `recordSlotImpression` calls `markServedOnImpression`. This is the long-term "don't show me this again for a month" set; it also feeds the `is_first_time` scoring bonus. Failures are logged (`markServedOnImpression failed`) but no longer load-bearing for dedup, since `offered` already covers the short term.

An item the device never rendered ages out of `offered` after ~4h and becomes a candidate again — intended resurfacing once fresh inventory is thin.

Reuters source was retired by Reuters Agency in 2024; migration `0015` drops
the row.

## Health monitoring

`packages/api/src/services/news-health.service.ts` exposes `getNewsHealth()` (flags sources that have never fetched, are stale beyond `3× fetch_interval_min` (15-min floor), or carry a `lastError`, plus a pipeline-wide "no items at all" check). `runNewsHealthCheck()` runs on the `*/15` cron and fires a deduped Slack alert when degraded; `GET /admin/news-health` returns the same report on demand. This exists because the pipeline previously failed **silently** — the worker simply wasn't running, and nothing surfaced it.

## Adding a source

1. INSERT a row into `news_sources` (or via admin in M7) with the right `kind`, `url`, `half_life_hours`, and `fetch_interval_min`.
2. If the source is RSS-based, ensure its key prefix is in BOTH `packages/api/src/services/news-fetchers/rss.ts` SOURCE_BY_KEY_PREFIX and `packages/api/src/services/news-selection.service.ts` SOURCE_BY_KEY_PREFIX. Drift between the two will silently bucket items as `NewsSource.Generic`.
3. The next 5-min tick picks it up.

## Capacity at this scale

For 100 users × 6 channels × 200 candidates per sync = ~120k candidate scoring ops/hour. Negligible for the in-process scheduler running alongside the API. The Postgres index on `(channel_id, published_at)` covers the selection query without a full table scan.

The served set per device grows up to ~36k entries for a heavy user over 30 days (~1-2 MB Redis). At 100 users this is well under 200 MB total Redis SET memory. M5+ may need eviction logic at 10k+ users.

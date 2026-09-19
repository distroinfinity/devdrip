# News pipeline

Distro TV pulls public news feeds into Postgres on a 5-min cron, then scores them per device at sync time. M3 introduced this end-to-end.

## Data model

- **`channels`** — six fixed channels (`tech`, `finance`, `crypto`, `ai-papers`, `design`, `gaming`). Tech + Finance are default-on for new users.
- **`channel_subscriptions`** — composite PK on `(user_id, channel_id)` with `priority` (0 = top). Defaults are auto-created lazily on first call to `getSubscriptionsForUser` or `nextPicksForDevice`.
- **`news_sources`** — `(channel_id, key, kind, url, half_life_hours, fetch_interval_min, healthy, last_fetched_at, last_error)`. Seeded via migration 0012 with 11 default sources.
- **`news_items`** — `(id text PK, channel_id, source_id, headline, url, comments_url, score, comments_count, published_at, fetched_at)`. Indexed on `(channel_id, published_at)` for the selection query and `(published_at)` for global recency.

The text PK on `news_items.id` uses namespaced source-stable identifiers (`hn:38291043`, `rss:techcrunch:<sanitized-guid>`, `reddit:<id>`), which makes upserts cheap and prevents duplicate ingestion across ticks.

## Fetcher worker

`packages/api/src/worker.ts` runs `node-cron` on `*/5 * * * *`. Each tick walks every `news_sources` row whose `fetch_interval_min` divides the current minute bucket and dispatches by `kind` to a per-protocol fetcher:

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

   Per-source `half_life_hours` lets HN (6h) decay faster than RSS (24h), Reuters (1h), or Smashing Magazine (72h).

6. Prefer unseen items at the top of the sorted list. Only fall back to seen items when the unseen pool is shorter than `n` — that's the resurfacing path for power users.
7. Write the `n` picks to `news:nextpicks:<deviceId>` (5-min TTL); add each id to `news:served:<deviceId>` (SET, 30d TTL); refresh expire.

## Failure modes

| failure                              | behavior                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Source 4xx/5xx                       | Mark `news_sources.healthy=false`, write `lastError`. Coordinator continues other sources.                          |
| HTTP stall                           | 15s `AbortSignal.timeout` aborts; same as 4xx path.                                                                 |
| Empty news_items + empty Redis queue | `/me/content/next` returns `{ items: [] }`. CLI slot-cache falls back to demo fixtures.                             |
| Bloomberg/Reuters block bot UA       | Marked unhealthy on first tick. HN + TechCrunch + Verge + Smashing + ArsTechnica + Polygon + Reddit carry the demo. |
| Worker process killed mid-fetch      | Per-source Redis lock expires after 90s; next tick proceeds normally.                                               |

## Adding a source

1. INSERT a row into `news_sources` (or via admin in M7) with the right `kind`, `url`, `half_life_hours`, and `fetch_interval_min`.
2. If the source is RSS-based, ensure its key prefix is in BOTH `packages/api/src/services/news-fetchers/rss.ts` SOURCE_BY_KEY_PREFIX and `packages/api/src/services/news-selection.service.ts` SOURCE_BY_KEY_PREFIX. Drift between the two will silently bucket items as `NewsSource.Generic`.
3. The next 5-min tick picks it up.

## Capacity at this scale

For 100 users × 6 channels × 200 candidates per sync = ~120k candidate scoring ops/hour. Negligible on a single Railway worker. The Postgres index on `(channel_id, published_at)` covers the selection query without a full table scan.

The served set per device grows up to ~36k entries for a heavy user over 30 days (~1-2 MB Redis). At 100 users this is well under 200 MB total Redis SET memory. M5+ may need eviction logic at 10k+ users.

# Ticker pipeline

Distro TV pulls quote + history data for tickers in active watchlists from Finnhub (US equities) and CoinGecko (crypto), every 60s, server-side. M4 introduces this end-to-end.

## Data model

- **`watchlists`** — per-user named list with `priority` for ordering. Composite-unique on `(user_id, name)`. Capped at 3 per user.
- **`watchlist_tickers`** — composite PK `(watchlist_id, symbol)`. `asset_class ∈ {"equity", "crypto"}`. Capped at 25 per watchlist. Cascade delete from watchlists.
- **`ticker_quotes`** — one row per symbol globally (PK on symbol). Updated by the fetcher coordinator. `stale = true` when last fetch failed and the row was preserved as fallback.
- **`ticker_history`** — daily OHLC per `(symbol, date)`. Volume is `real` (not `integer`) so crypto USD-denominated volumes don't overflow int32. Index `(symbol, date DESC)` matches the chart query. M4 uses live fetcher candles for the chart page; the worker doesn't backfill `ticker_history` itself yet (M5+).

## Fetcher worker

`packages/api/src/worker.ts` adds `cron.schedule("*/1 * * * *", runTickerTick)` alongside the news fetch. Each tick:

1. Acquires a global `ticker:fetcher:lock:global-tick` (CAS-safe — random token + Lua compare-and-delete; falls back to a no-op log on TestRedis in dev).
2. Reads `SELECT DISTINCT symbol, asset_class FROM watchlist_tickers` — cross-user dedup.
3. Splits into equities (Finnhub) + cryptos (CoinGecko).
4. Cryptos: one batched `simple/price` call (`?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true`).
5. Equities: per-symbol with a 1.1s rate-limit delay (Finnhub free tier: 60 req/min).
6. Each successful quote is upserted into `ticker_quotes` (onConflictDoUpdate keyed on symbol) + cached to Redis at `ticker:price:<symbol>` (60s TTL, plain object — never JSON.stringify).
7. Failures mark the affected rows `stale = true` so the daemon can dim the box color. The next successful tick clears the flag.

In dev, `FINNHUB_API_KEY=dev_placeholder` short-circuits to synthetic stable-per-symbol quotes (matching the M2 `re_dev_placeholder` pattern). CoinGecko free tier needs no key, so crypto prices are real even in dev.

## Selection

`/me/content/next` reads `preferences.channelMode` and dispatches:

- **`news`** → `nextPicksForDevice(...)` (M3 path, unchanged)
- **`markets`** → `n` calls to `nextTickerForDevice(...)` with rotationIndex 0..n-1; bounded retry skips null indices when ticker_quotes hasn't caught up yet
- **`mix`** → `ceil(n/2)` news + `floor(n/2)` tickers, interleaved starting with news; cascade falls through to whichever pool has items if one is empty

`nextTickerForDevice`:

1. Ensures a Default watchlist exists (lazy-init, gated on `WHERE NOT EXISTS` so explicit unsubscribes are not silently re-undone).
2. Reads the priority-0 watchlist (single-list v1; multi-list management is M6 polish).
3. Picks a rotation index — by `(deviceId hash + minute_bucket) % length` so a user sees a different ticker each minute, no server-side rotation state needed.
4. Loads the latest `ticker_quotes` row + the last 14 daily closes from `ticker_history` (or falls back to `[prevClose, price]` when history is empty).
5. Computes `TickerStats` (d1Pct from `(price - prevClose)/prevClose`, w1/m1 pct change over the sparkline, w52Hi/Lo as max/min over sparkline + price; all rounded to 1 decimal).
6. Returns a `TickerPayload` with `kind: "ticker"`, `layout: "single"`, the sparkline, stats, and the `stale` flag.

## Watchlist API

`PUT /me/watchlists` is **full replacement** with server-assigned priority — same contract as M3 channels:

- Body: `{ watchlists: [{ name, tickers: [{symbol, assetClass}] }] }`
- Server runs in `db.transaction()`: wipe-and-rewrite for the user; priority assigned by array index
- Validator caps: 3 watchlists/user, 25 tickers/list, name 1-32 chars, symbol matches `/^[A-Z0-9.\-]{1,16}$/`
- 23505 unique-violation in `ensureDefaultWatchlist` is swallowed (TOCTOU race between concurrent first GETs)

## Chart endpoint

`GET /tickers/:symbol/history?range=1d|1w|1m|3m|1y` is **public** (no auth — chart pages are shareable URLs). Resolves asset class from `watchlist_tickers` (defaults to `equity` for unknowns). Dispatches to `fetchFinnhubCandles` or `fetchCoinGeckoCandles`. Returns `{ symbol, assetClass, range, candles: [{date ISO, open, high, low, close, volume|null}] }`.

The frontend `/chart/[symbol]` page uses Recharts with 1d/1w/1m/3m/1y tabs. SSR uses plain `fetch` against `API_URL/tickers/...` (not `apiFetchOrRefresh`), so logged-out visitors don't get redirected to sign-in on a public page.

## Failure modes

| failure                          | behavior                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Finnhub rate-limit (429)         | per-symbol error caught; affected symbols marked `stale = true`; redis cache serves last known quote |
| Finnhub down                     | fetch throws → mark stale → daemon dims color via `stale: true` on the payload                       |
| CoinGecko down                   | crypto symbols marked stale en bloc (single batched call); equities continue independently           |
| Watchlist edited mid-tick        | next tick (60s) picks up the new symbol set                                                          |
| Symbol not in CoinGecko's id map | silently skipped (logged); add to `symbol-map.ts` to fix                                             |
| Fetch outlives 90s lock          | CAS-safe lock prevents corruption; second tick can run in parallel briefly                           |

## Adding a crypto symbol

Edit `packages/api/src/services/ticker-fetchers/symbol-map.ts` to add the CoinGecko id. Future M7 admin will manage this server-side.

## Capacity at this scale

For 100 users × 5 tickers each, deduped → ~50 unique symbols. Finnhub free (60 req/min) is plenty for the equity portion. CoinGecko's batched `simple/price` is one call regardless of crypto count. Total tick time: ~30s for 50 equities (rate-limited 1.1s × 50) + 1s for crypto batch = ~31s per minute, well within the 60s window.

Hard ceilings v1: 25 tickers per list, 3 lists max per user — caps long-tail symbol explosion as user count grows.

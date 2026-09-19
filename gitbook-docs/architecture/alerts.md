# Alerts

Distro TV fires alerts when a watched ticker moves by more than the user's threshold (default ±5%) in a day. M5 introduces this end-to-end.

## Data model

- **`alerts`** — per-user rules. Two partial unique indexes enforce the cardinality:
  - `alerts_user_global_uq UNIQUE (user_id) WHERE symbol IS NULL` — at most one global rule per user.
  - `alerts_user_symbol_uq UNIQUE (user_id, symbol) WHERE symbol IS NOT NULL` — at most one per-ticker override per (user, symbol).

  Postgres treats NULLs as distinct in plain unique indexes, so a single `(user_id, symbol)` unique would have allowed multiple global rows; the partial-index split is the fix.

- **`alert_events`** — fire log. One row per (user, device, symbol) fire. The `(device_id, symbol, fired_at DESC)` index serves the 60-min debounce check.

## Evaluator

`packages/api/src/services/alert-evaluator.service.ts` runs **inside** `runTickerTick()` after the equity + crypto upserts complete. The dispatch:

1. `loadCandidates()` — joins `watchlist_tickers ↔ watchlists ↔ ticker_quotes`, filters out `stale=true` rows, pairs each (user, symbol) with the effective threshold (per-ticker override beats global; default 5%).
2. For each candidate where `|change_pct| ≥ threshold`:
   - Look up all of the user's devices.
   - For each device, check `alert_events` for any fire in the last 60 minutes for the same `(device_id, symbol)`. Skip if found (debounce).
   - **LPUSH first, INSERT second.** A failing `lpush` must not consume the debounce window — if Redis is flaky and the row commits anyway, the daemon never sees the alert and the user is debounced out for an hour. The reversed ordering means a transient Redis failure leaves no `alert_events` row, so the next 60s tick re-evaluates and can fire again. Worst case if the insert fails after a successful lpush: payload sits in Redis for the device (delivered), no debounce row → next tick may re-fire if the condition persists. Acceptable trade-off.

A failure inside the evaluator is logged and swallowed — the next ticker tick proceeds normally.

## Selection-side promotion

`nextTickerForDevice` does an `LPOP alert:pending:<deviceId>` at the top, immediately after `ensureDefaultWatchlist`. If a payload comes back, the rotation is bypassed: `buildTickerPayload(userId, pending.symbol, pending)` returns the alerted symbol with the `alert` field populated on the `TickerPayload`. Otherwise normal rotation continues. The `LPOP` is consume-once — each device sees each alert exactly once unless the worker fires again after the debounce expires.

The shared `buildTickerPayload(userId, symbol, alert?)` helper backs both the alert path and the rotation path. Asset class falls back from the user's watchlist row to `ticker_quotes.assetClass` when the alerted symbol isn't in the user's watchlist (rare race window between an alert firing and a watchlist edit).

## Daemon-side rendering

`packages/cli/src/lib/render-ticker.ts` checks `payload.alert`. When present:

- header label switches from `📈 SYM` to `🔔 SYM ALERT`
- the entire box is wrapped in ANSI red bold (`\x1b[31m\x1b[1m...\x1b[0m`)
- ASCII fallback path skips color (non-TTY output: pipes, CI)

The wrap is per-line (each `lines[i]` gets its own escape sequence), not on the joined string, because the daemon may render line-by-line into the scroll region.

## Failure modes

| failure                               | behavior                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Evaluator throws                      | Logged with the symbol context; next tick re-evaluates                                                     |
| Redis lpush fails                     | Insert is skipped → no `alert_events` row → next tick re-evaluates with no debounce penalty                |
| DB insert fails after lpush           | Payload sits in Redis (delivered to daemon), no debounce row → next tick may re-fire if condition persists |
| Multiple alerts queued for one device | LPOP serves them oldest-first across slots; one alert per slot                                             |
| Alert fires after device offline      | `LPUSH` succeeds; on next sync the daemon sees the queue (60-min TTL on the list)                          |
| Stale ticker quote                    | Evaluator skips (`stale=true` candidates excluded) — no false fires on a Finnhub outage                    |
| Multiple devices for one user         | Fan-out: each device gets its own `alert_events` row + Redis list entry; per-device debounce               |

## Demo trigger

`POST /__test/fire-alert` (production-gated; 404 in `NODE_ENV=production`) lets the demo deterministically force a fire:

```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"userId":"<uuid>","symbol":"NVDA","changePct":6.2}' \
  http://localhost:3001/__test/fire-alert
```

Mirrors what the production evaluator does for one specific (user, symbol) pair, including the lpush-before-insert ordering.

## Configuration

- Default global threshold: **5%** (in code at `alert.service.ts`). Editable via `/me/alerts` or `distro preferences → alerts`.
- Per-ticker overrides: up to 25 per user, threshold range 0.5..50.
- Debounce window: **60 min** per `(device_id, symbol)` — durable in `alert_events.fired_at`, survives Redis flushes and worker restarts.
- Pending alerts queue TTL: 60 min (matches debounce).

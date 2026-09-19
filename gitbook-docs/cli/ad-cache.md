# Local Ad Cache

Pre-fetched ads stored on disk so hooks can serve in <200ms without a network round-trip.

## Why local

- **Latency** — `VANISH_DEADLINE_MS = 200ms` (see `packages/shared/src/constants/index.ts`). A cold `GET /ads/batch` costs tens of ms minimum. Ads must be preloaded.
- **Never-block hooks** — the hook path reads from the cache only. Refresh happens in the background.
- **Transient backend gaps** — brief Railway/Neon/wifi hiccups during a Claude session don't interrupt ad delivery.
- **Demo/dev UX** — when the backend is down and the cache is empty, the daemon serves clearly-labeled demo ads so the product still demonstrates. Not the driver of the design — a side benefit.

## Storage

- Path: `~/.devdrip/ad-cache.json`
- File mode: `0600`
- Plain JSON, atomic write via tmp + rename. No SQLite needed — the file holds 10 rows with a whole-file TTL.

## File shape

```json
{
  "version": 1,
  "userId": "...",
  "deviceId": "...",
  "surface": "terminal-tv",
  "fetchedAt": 1713788400000,
  "expiresAt": 1713788880000,
  "ads": [
    {
      "id": "...",
      "campaignId": "...",
      "format": "text",
      "headline": "...",
      "body": "...",
      "url": "...",
      "displayTimeMs": 8000,
      "deliveryToken": "jwt...",
      "impressionBeaconUrl": "...",
      "clickTrackingUrl": "...",
      "cacheSource": "api"
    }
  ]
}
```

`cacheSource` is a CLI-side discriminator: `"api"` for backend-served ads, `"demo"` for offline-fallback fixtures. The daemon must check this before writing an impression to the ledger — demo ads don't earn.

## Identity scoping

Delivery tokens are issued for a specific `(userId, deviceId, surface)` triple and `POST /impressions` enforces that binding. The cache file stores the triple it was fetched with, and `openAdCache` drops the on-disk cache if any of the three has changed since the last session (re-auth as a different account, `devdrip init` re-registering the device, or a surface switch). Without this check, a re-auth could silently serve ads that can never be credited.

`openAdCache` throws early if `userId` or `deviceId` is empty. Callers (the future daemon) must have both before opening the cache.

## Module API

`packages/cli/src/lib/ad-cache.ts`:

```ts
openAdCache(deps: {
  apiFetch?: typeof defaultApiFetch
  userId: string
  deviceId: string
  surface: "terminal-tv"
  now?: () => number       // injectable for tests
}): AdCache

interface AdCache {
  next(): CachedAd | null     // pops front; triggers background refresh if <3 left
  count(): number
  refreshNow(): Promise<void> // single-flight
  close(): void
}
```

The constructor warms the cache in the background. Callers don't need to `await` anything; the first `next()` returns whatever's available now, and the cache fills as `GET /ads/batch` completes.

## TTL and token expiry

Delivery tokens are minted with a **10-minute TTL** (`packages/api/src/lib/ad-delivery.ts:DELIVERY_TOKEN_TTL`). If we let a cached ad outlive its token, `POST /impressions` will reject it at sync time and the developer silently loses earnings.

To avoid this, the cache TTL is set to **8 minutes** — a 2-minute safety margin. Any ad served from the cache is guaranteed to have at least 2 minutes of token life remaining, which is more than enough time for the hook → display → impression-write chain.

If the token TTL changes on the backend, update `CACHE_TTL_MS` in `ad-cache.ts`.

## Refresh flow

1. On open, if `ads.length < 3 OR now() >= expiresAt`, a background refresh kicks off.
2. Refresh calls `GET /ads/batch?deviceId=<id>&surface=terminal-tv&count=10` via `apiFetch` (bearer auth with transparent 401 refresh).
3. Success → atomic write to disk, `expiresAt = now + 8m`.
4. `204` / empty response → keep prior cache. If prior cache is also empty, fall back to demo fixtures.
5. Network / 5xx / 401-after-retry → log to stderr, keep prior cache or fall back to demos.
6. Refresh errors **never throw** to the consumer.

Concurrent `refreshNow()` calls share a single in-flight `Promise` via a private `refreshInFlight` slot — no duplicate network traffic.

## Demo fallback

`packages/cli/src/lib/ad-cache-fixtures.ts` exports three hardcoded ads, `cacheSource: "demo"`, with copy that clearly labels them as demos (e.g. "DevDrip demo — no real advertiser"). They render fine in the terminal and are safe to serve when offline, but the daemon layer must skip them when writing to the ledger.

## At MVP scale

At 100 devs with an 8-minute refresh interval, the system-wide load on `/ads/batch` is ~750 req/hour. Comfortably within the `userLimiter` ceiling (60 req/min per user). No aggressive caching, adaptive refresh, or per-ad TTL needed — revisit when we hit 10k devs.

## Testing

`packages/cli/src/lib/__tests__/ad-cache.test.ts` mocks `apiFetch` and exercises: happy path, 204 empty response, network failure → demo fallback, TTL expiry, `<3 left` refresh trigger, single-flight concurrent refreshes, partial/corrupt on-disk cache recovery.

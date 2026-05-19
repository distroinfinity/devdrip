# Slot Cache

The daemon's local content cache. Previously called `ad-cache` when the product served ads; renamed to `slot-cache` when Distro TV landed news + ticker slots. The cache file is `slot-cache.json` (was `ad-cache.json`); contents are `CachedSlot[]` (discriminated `NewsSlot | TickerSlot`).

See [Channel Modes](../architecture/channel-modes.md) and [Slot Content](../architecture/slot-content.md) for context.

Pre-fetched slots stored on disk so hooks can serve in <200ms without a network round-trip.

## Why local

- **Latency** — `VANISH_DEADLINE_MS = 200ms` (see `packages/shared/src/constants/index.ts`). A cold `/me/content/next` fetch costs tens of ms minimum. Slots must be preloaded.
- **Never-block hooks** — the hook path reads from the cache only. Refresh happens in the background.
- **Transient backend gaps** — brief Railway/Neon/wifi hiccups during a Claude session don't interrupt slot delivery.
- **Demo/dev UX** — when the backend is down and the cache is empty, the daemon serves labeled demo slots so the product still demonstrates.

## Storage

- Path: `~/.distro/slot-cache.json`
- File mode: `0600`
- Plain JSON, atomic write via tmp + rename.
- Cache version 3; older files are silently dropped on first run after upgrade.

## File shape

```json
{
  "version": 3,
  "userId": "...",
  "deviceId": "...",
  "fetchedAt": 1713788400000,
  "expiresAt": 1713788880000,
  "slots": [
    {
      "kind": "news",
      "payload": {
        "newsId": "hn:38291043",
        "headline": "...",
        "url": "...",
        "source": "hn",
        "score": 342,
        "publishedAt": "...",
        "cacheSource": "api"
      }
    },
    {
      "kind": "ticker",
      "payload": {
        "symbol": "AAPL",
        "price": 234.56,
        "changePct": 2.34,
        "sparkline": [231, 232, 233, 234],
        "cacheSource": "api"
      }
    }
  ]
}
```

`cacheSource` is a CLI-side discriminator: `"api"` for backend-served slots, `"demo"` for offline-fallback fixtures.

## TTL and refresh

- Cache TTL: **8 minutes** (refresh every ~8 min to keep slots fresh without hammering the API).
- On open, if `slots.length < 3 OR now() >= expiresAt`, a background refresh kicks off.
- Refresh calls `GET /me/content/next?n=10&deviceId=<id>` via `apiFetch`.
- `204` / empty response → keep prior cache. If prior cache is also empty, fall back to demo fixtures.
- Network / 5xx errors → log to stderr, keep prior cache or fall back to demos.
- Concurrent `refreshNow()` calls share a single in-flight `Promise` — no duplicate network traffic.

## Module API

`packages/cli/src/lib/slot-cache.ts`:

```ts
openSlotCache(deps: {
  apiFetch?: typeof defaultApiFetch
  userId: string
  deviceId: string
  now?: () => number
}): SlotCache

interface SlotCache {
  next(): CachedSlot | null   // pops front; triggers background refresh if <3 left
  count(): number
  refreshNow(): Promise<void> // single-flight
  close(): void
}
```

## Capacity

At 100 users with an 8-minute refresh interval, system-wide load on `/me/content/next` is ~750 req/hour — well within rate limits. Revisit at 10k users.

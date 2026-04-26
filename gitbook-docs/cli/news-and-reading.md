# News and Reading

## News source (MVP: HN only)

The API service `packages/api/src/services/news.service.ts` fetches HN top stories every 15 min, filters to `score >= 100` and `age <= 24h`, caches in Redis. Stale-cache fallback covers HN outages.

Per-user dedup: `news:seen:{userId}` Redis SET, 7-day rolling TTL. Resurfacing fallback shows top story even if seen, so power users never get a blank slot.

## CLI render

News headlines render via `renderNewsBox` in `packages/cli/src/lib/render-box.ts`. Same border style as ads, headlines-only (no description — locked product decision for MVP). Same `<200ms` vanish contract as ads.

```
┌─ DEV DRIP TV · 📰 NEWS ─────────────────────────────────────────┐
│  📰 hn · 342 pts · 1h                                          │
│  why static types still matter in 2026                          │
│  [D] open  [B] save  [S] skip  [K] kill  [M] mute              │
└─────────────────────────────────────────────────────────────────┘
```

## Save keybind

`b` while a news headline is up writes to local SQLite `reading_pending` table. The daemon's sync loop POSTs each pending save to `/me/reading` (idempotent on `(user_id, news_id)` unique index). Saves survive offline / API outages.

## `devdrip preferences` command

Top-level menu (`select` from `@clack/prompts`):

- channel mode
- ad categories
- caps & quiet hours (placeholder)
- news topics (v1.1 placeholder)

Multi-edit in one session — loops until cancel.

## Related

- [Channel Modes](../architecture/channel-modes.md)
- [Reading List (Dashboard)](../dashboard/reading.md)

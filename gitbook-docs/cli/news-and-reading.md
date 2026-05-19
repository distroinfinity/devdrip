# News and Reading

## News selection

The API service `packages/api/src/services/news-selection.service.ts` scores and ranks news items per device at sync time. Items are pulled from `news_items` (fetched every 5 min by the worker), filtered by the user's channel subscriptions, and scored with a recency + engagement + channel-priority formula. See [News Pipeline](../architecture/news-pipeline.md) for the full selection algorithm.

Per-user dedup: `news:served:<deviceId>` Redis SET, 30-day rolling TTL, advanced only on impression (not on cache pre-fill).

## CLI render

News headlines render via `renderNewsBox` in `packages/cli/src/lib/render-box.ts`. Same DECSTBM-anchored border style as ticker slots. Headlines only (no description — locked product decision for MVP). Same `<200ms` vanish contract.

```
╔═ ● DISTRO TV · 📰 CH 01 NEWS ═══════════════════════════════╗
║  hn · 342 pts · 1h                                          ║
║  why static types still matter in 2026                       ║
║  [O]pen  [B] save  [N]ext  [S]kip  [K]ill  [M]ute           ║
╚══════════════════════════════════════════════════════════════╝
```

## Save keybind

`b` while a news headline is up writes to local SQLite `reading_pending` table. The daemon's sync loop POSTs each pending save to `/me/reading` (idempotent on `(user_id, news_id)` unique index). Saves survive offline / API outages.

## `distro preferences` command

Top-level menu (`select` from `@clack/prompts`):

- channel mode (5-position: news only / news heavy / balanced / ticker heavy / ticker only)
- quiet hours
- tz offset

Multi-edit in one session — loops until cancel.

## Related

- [Channel Modes](../architecture/channel-modes.md)
- [Reading List (Dashboard)](../dashboard/reading.md)

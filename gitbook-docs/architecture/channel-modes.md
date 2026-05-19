# Channel Modes

Distro TV is a content-serving terminal slot. Users pick what content fills the slot:

- 📰 **news only** — tech news only
- 📈 **ticker only** — markets only
- 🎭 **balanced / mix** — alternates news and ticker 1:1 (default)
- **news heavy** — 3 news for every 1 ticker
- **ticker heavy** — 1 news for every 3 tickers

Mode is set per-user in `preferences.channel_mode` and synced across CLI ↔ dashboard.

See [Ratio Selection](ratio-selection.md) for the full 5-position enum and alternation algorithm.

## Init flow

`distro init` prompts for mode during onboarding. The mode is the gate at delivery time — no separate topic picker is shown for ticker-only users.

## Delivery

The CLI fetches from `GET /me/content/next?n=N&deviceId=...`. The server reads `channelMode` from prefs and dispatches:

- `ticker_only` → `n` calls to `nextTickerForDevice(...)`
- `news_only` → `nextPicksForDevice(...)` (news selection)
- `balanced` / `news_heavy` / `ticker_heavy` → ratio-based interleaving (see [Ratio Selection](ratio-selection.md))

See [Slot Content](slot-content.md) for the discriminated-union shape.

## Related

- [Slot Content](slot-content.md)
- [Ratio Selection](ratio-selection.md)
- [News and Reading (CLI)](../cli/news-and-reading.md)
- [Reading List (Dashboard)](../dashboard/reading.md)
- [Backend API](../backend/api.md)

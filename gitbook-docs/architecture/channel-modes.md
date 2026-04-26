# Channel Modes

DevDrip TV is a content-serving terminal slot. Users pick what content fills the slot:

- 📰 **learn** — tech news only, no ads, no earnings
- 💰 **earn** — ads only, full USDC payouts
- 🎭 **both / mix** — alternates ads and news 1:1 (default)

Mode is set per-user in `preferences.channel_mode` and synced across CLI ↔ dashboard.

## Init flow

`devdrip init` prompts for mode first (order: learn → earn → both, default both highlighted). For learn-mode users, the ad-categories prompt is skipped — the mode itself is the gate at delivery time, not the prefs layer. Categories from a prior earn session are preserved if the user later flips back to earn or mix.

## Delivery

The CLI fetches from `GET /me/content/next?n=N&deviceId=...`. The server reads `channelMode` from prefs and dispatches:

- `earn` → existing ad waterfall
- `learn` → `pickNewsForUser` (HN top stories with per-user dedup)
- `mix` → atomic `INCRBY mix:counter:{userId}`, alternates by `pos % 2`

See [Slot Content](slot-content.md) for the discriminated-union shape.

## Earnings isolation

News impressions never credit earnings. Three structural guarantees:

1. `news-impression.service.ts` does not import from `earnings.service`, `budget`, `frequency`, or `beacon`
2. `news_impressions` table has no `earned_amount` column
3. `/ingest` only invalidates the earnings cache when `impressions.length > 0`

## Related

- [Slot Content](slot-content.md)
- [News and Reading (CLI)](../cli/news-and-reading.md)
- [Reading List (Dashboard)](../dashboard/reading.md)
- [Backend API](../backend/api.md)

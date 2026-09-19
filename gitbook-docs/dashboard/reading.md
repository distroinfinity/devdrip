# Reading List Dashboard

`/dashboard/reading` lists saved stories chronologically (newest first), capped at 100 in MVP.

Each row shows headline (linked, opens in new tab), source, score, and saved-at relative time. `[× delete]` removes the item via `DELETE /me/reading/:id` (optimistic UI, rolls back on error).

Snapshot fields (headline/url/score) are captured at save time in the `reading_list_items` table — the reading list survives upstream HN edits or link rot.

## Mode toggle

Three-segment pill in the dashboard header: 📰 learn / 💰 earn / 🎭 both. Optimistic update via `PUT /me/preferences { channelMode }`. CLI's `prefs-sync.ts` polls the same endpoint and propagates within ~30s.

## Stories-read stat card

Counts `news_impressions` over the last 7 days, with a delta vs the prior 7. For earn-mode users with 0 reads, shows a "switch to mix or learn" nudge.

Endpoint: `GET /me/news-stats` returns `{ thisWeek, lastWeek }`. Cached 60s server-side.

## Related

- [Channel Modes](../architecture/channel-modes.md)
- [News and Reading (CLI)](../cli/news-and-reading.md)

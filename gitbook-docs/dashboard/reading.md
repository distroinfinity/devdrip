# Reading List Dashboard

`/dashboard/reading` lists saved stories chronologically (newest first), capped at 100 in MVP.

Each row shows headline (linked, opens in new tab), source, score, and saved-at relative time. `[× delete]` removes the item via `DELETE /me/reading/:id` (optimistic UI, rolls back on error).

Snapshot fields (headline/url/score) are captured at save time in the `reading_list_items` table — the reading list survives upstream HN edits or link rot.

## Mode toggle

Five-position `ModePill` in the dashboard header: news only / news heavy / balanced / ticker heavy / ticker only. Optimistic update via `PUT /me/preferences { channelMode }`. CLI daemon polls preferences every 30s and propagates the change live.

## Stories-read stat card

Counts `news_impressions` over the last 7 days, with a delta vs the prior 7. For ticker-only users with 0 reads, shows a "switch to balanced or news" nudge.

Endpoint: `GET /me/news-stats` returns `{ thisWeek, lastWeek }`. Cached 60s server-side.

## Related

- [Channel Modes](../architecture/channel-modes.md)
- [News and Reading (CLI)](../cli/news-and-reading.md)

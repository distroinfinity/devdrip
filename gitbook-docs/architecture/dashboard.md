# Dashboard

The Distro TV dashboard at `/dashboard` is the user-facing surface that mirrors what the CLI is doing and lets the user manage their config. M6 rebuilt it as a deliberate product surface using the v5 visual language (sharp edges, hairlines, brand tokens, no soft shadows).

## Composition

Top to bottom:

1. **Header** — page title (Space Mono 14px bold), meta line (mono 10px, market state + date), 5-position `ModePill` on the right
2. **Live bar** — single-line LIVE pill + current slot description + delta + slot-ends-in countdown + device name. Background `--bg-secondary`.
3. **Activity tape** — 24h timeline of all slots (`slot_impressions` + `alert_events`). Bars: 2px wide, height by weight (8/11/14px for normal news/ticker/alert respectively); alerts are 3px-wide oxblood at full height; "now" position is a glowing forest bar at the right edge. 24-column grid lines for hour boundaries.
4. **Terminal mirror** — solid `#0E0E11` block, 0px radius, 1px `#2A2A2E` border. Polls `GET /me/devices/:id/now` at 1Hz and renders the slot the daemon is currently rendering. ASCII box-drawing frame with progress bar (`▓▓░░`). When idle: shows `$ distro overview --idle`.
5. **Tab bar** — sharp segmented control with 4 tabs: News / Watchlist / Alerts / All. Active tab gets a 2px `--accent-color` bottom border. Default-open tab is mode-aware (see below).
6. **Tab content** — per-tab layout fit to content type (HN-style for news, tabular for watchlist, log table for alerts, mixed-with-chips for all).
7. **Footer** — single-line totals "▸ N events / 7d · M saved · K alerts · last sync Ys".
8. **Setup banner** — only renders when channels or watchlist is empty. Disappears on completion.

## Sidebar

Always-visible config readout (`dl/dt/dd` of mode · channels · watchlist · alerts threshold · quiet hours · device + last sync). Answers "what is distro doing right now?" without any click. Lives in `frontend/components/dashboard/sidebar/config-readout.tsx`.

## Default tab

Mapped from `preferences.channelMode`:

| Mode                                  | Default tab |
| ------------------------------------- | ----------- |
| `news_only`, `news_heavy`, `balanced` | News        |
| `ticker_heavy`, `ticker_only`         | Watchlist   |

## Tab data sources

| Tab       | Endpoint                                                   | Source tables                                        |
| --------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| News      | `GET /me/recent-news?limit=25`                             | `slot_impressions ⨝ news_items`                      |
| Watchlist | `GET /me/watchlist/sparklines?windowSec=86400` (read-only) | `watchlist_tickers ⨝ ticker_quotes ⨝ ticker_history` |
| Alerts    | `GET /me/alerts/events?limit=25`                           | `alert_events`                                       |
| All       | `GET /me/activity-summary?windowSec=86400`                 | `slot_impressions ∪ alert_events`                    |

## Now-playing protocol

The daemon writes the active slot to Redis on slot start: `device:nowplaying:<deviceId>` with TTL 20s (slot duration ~15s + 5s buffer). On slot vanish, the daemon deletes the key. The dashboard polls `GET /me/devices/:id/now` at 1Hz to mirror the state.

Failure modes:

| Failure                          | Behavior                                                     |
| -------------------------------- | ------------------------------------------------------------ |
| Daemon crashes after writing key | TTL expires within 20s → mirror returns idle                 |
| Network blip during 1Hz poll     | Mirror keeps last known state; recovers on next tick         |
| Multiple slots in queue          | Only the active slot is mirrored; `next` field is null in v1 |

## v5 visual language

Defined in `docs/superpowers/specs/2026-05-07-m6-dashboard-polish-design.md`. Key constraints: 0px radius on terminal-like elements, 0–2px on cards. Hairline 1px borders. No soft shadows beyond `--shadow-sm`. Indigo (`--accent-color`) is the only chromatic accent; status uses oxblood (`--status-negative`) and forest (`#2F8F4E`). Banned: 12+px radii, Tailwind primary defaults, gradient backgrounds, page-corner color glows.

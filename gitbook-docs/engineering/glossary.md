# Glossary

## Channel

A named content stream (e.g. `CH 01 NEWS`, `CH 02 MARKETS`). Users subscribe to channels; the slot selection algorithm draws from subscribed channels. Defined in the `channels` table.

## Channel Mode

Controls the news/ticker ratio for slot delivery. Five positions: `news_only`, `news_heavy`, `balanced`, `ticker_heavy`, `ticker_only`. Stored in `preferences.channel_mode`.

## Device

A registered machine belonging to a user. Identified by a stable `machineIdHash` (SHA-256 of platform UUID). Stored in the `devices` table. The daemon runs as a per-user singleton, not per-device.

## Device Bearer Auth

The CLI's anonymous authentication method. `distro init` generates a 256-bit `device_secret`, stores it locally, and uses `Authorization: Bearer device.<secret>` for API calls. No sign-in required.

## Hook

A Claude Code settings.json entry that fires the CLI (`distro hook pre-tool`, `distro hook stop`, etc.) on coding tool lifecycle events. Hooks must always exit 0.

## Impression

A recorded slot display event. News impressions go to `news_impressions`; ticker impressions to `slot_impressions`. Local SQLite ledger is ground truth; backend syncs via `/ingest`.

## IDE Type

Client context classification: `terminal`, `vscode`, or `cursor`.

## Local Ledger

SQLite database at `~/.distro/ledger.db`. Stores slot impressions locally before the backend syncs them. Ground truth for what the user has seen.

## Magic Link

The email-based sign-in method. A 32-byte token is emailed via Resend; the user clicks the link to verify and receive a 7-day session JWT.

## Pairing

The CLI ↔ browser handoff that upgrades an anonymous device session to an email-bound user account. The CLI generates a pairing code, opens the browser at `/setup?pair=<code>`, and waits. See [Identity & Auth](../architecture/identity.md).

## Session JWT

The 7-day JWT issued after magic-link verification. Stored as an HTTP-only cookie (`distrotv_session`) in the browser and used as `Authorization: Bearer <jwt>` in CLI/API calls.

## Slot

A single content item displayed in the terminal during AI tool idle time. Two slot kinds: `news` (headlines) and `ticker` (market data). The slot vanishes in <200ms from the `Stop` hook firing.

## Slot Cache

JSON file at `~/.distro/slot-cache.json`. Pre-fetches `SlotContent[]` from the API so hooks can serve in <200ms. See [Slot Cache](../cli/ad-cache.md).

## Surface

Short form for the render context where a slot appears. Primary surface: `terminal-tv` (the CLI scroll region during tool use).

## Watchlist

A named list of ticker symbols (up to 25 per list, 3 lists per user). Used by the ticker pipeline to determine which symbols to fetch. Default watchlist is auto-created on first use.

# Ratio Selection

The CLI daemon picks news vs ticker slots based on the user's `channelMode` preference. M6 expanded the enum to 5 positions and replaced the previous 3-state branching with a deterministic alternation pattern.

## Enum

`ChannelMode` in `packages/shared/src/types/index.ts`:

| Value          | Pattern                          | Effective ratio    |
| -------------- | -------------------------------- | ------------------ |
| `news_only`    | `[news]`                         | 100% news          |
| `news_heavy`   | `[news, news, news, ticker]`     | 3:1 news to ticker |
| `balanced`     | `[news, ticker]`                 | 1:1                |
| `ticker_heavy` | `[news, ticker, ticker, ticker]` | 1:3                |
| `ticker_only`  | `[ticker]`                       | 100% ticker        |

## Algorithm

`pickKind(mode, slotIndex)` in `packages/cli/src/lib/slot-cache.ts`:

```typescript
const RATIO_PATTERNS: Record<ChannelMode, ("news" | "ticker")[]> = { ... }

export function pickKind(mode: ChannelMode, slotIndex: number): "news" | "ticker" {
  const pattern = RATIO_PATTERNS[mode]
  return pattern[slotIndex % pattern.length]
}
```

Deterministic. Demos are reproducible. Unit-tested with 5 cases.

## `slotIndex` counter

Per-process monotonic counter at module scope in `slot-cache.ts`. Incremented on every regular (non-alert) slot pick. Resets on daemon restart — acceptable for v1. Future enhancement: persist to local SQLite ledger for restart-survival.

Alerts always preempt regardless of mode — the LPOP-from-pending check at the top of `nextTickerForDevice` (M5) takes precedence. Alert preemption does NOT advance `slotIndex`; only "regular" slot picks do. This way the news/ticker alternation pattern is preserved across alerts.

## Mode changes mid-rotation

The daemon picks up the new mode on the next slot via the existing 30s preferences poll. The `slotIndex % newPattern.length` calculation seamlessly handles the change — no glitch, just a different pattern starting from the current counter value.

## Migration from M5 (3-position) to M6 (5-position)

Migration `0018_update_channel_mode_to_5_positions.sql` in `packages/api/src/db/migrations/` handles the legacy values:

| Legacy    | New           |
| --------- | ------------- |
| `news`    | `news_only`   |
| `markets` | `ticker_only` |
| `mix`     | `balanced`    |

A `CHECK` constraint enforces the 5-value enum. Default value updated to `'balanced'`.

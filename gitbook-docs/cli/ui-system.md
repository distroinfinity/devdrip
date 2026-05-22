# CLI UI system

The terminal slot renderers (NEWS and MARKETS channels) share a single visual system: Editorial direction, Coinbase dark palette, landing indigo for chrome, branded chips for tickers, brand-colored source names for news, single-row Braille curves for markets.

Design spec: `docs/superpowers/specs/2026-05-20-distro-tv-ui-refresh-design.md`.

## Color tokens

Defined in `packages/cli/src/lib/ansi.ts`. Used via `color(token, text, mode)`.

| Token       | Truecolor | 256 fallback | Role                                                    |
| ----------- | --------- | ------------ | ------------------------------------------------------- |
| `fg`        | `#ffffff` | xterm-231    | Headline, price, ticker name                            |
| `muted`     | `#8a919e` | xterm-247    | Source name, separators, age, action keys, stats labels |
| `rule`      | `#1a1c20` | xterm-235    | Thin horizontal rules `─`                               |
| `indigo`    | `#818cf8` | xterm-105    | Left bar `▍`, channel label (`markets` / `news`)        |
| `indigoDim` | `#5054a8` | xterm-61     | Bar pulse half-cycle                                    |
| `positive`  | `#27ad75` | xterm-72     | Gain change %, gain chart, ✓ saved flash                |
| `negative`  | `#f0616d` | xterm-167    | Loss change %, loss chart                               |
| `warning`   | `#f89656` | xterm-215    | Alert variant header + body line                        |

## Brand chips

Defined in `packages/cli/src/lib/brand-colors.ts`. ~50 curated brands across equities, crypto, and news sources. Unknown tickers / sources fall back to a neutral dark chip (`#2a2a2c` bg, `#ffffff` fg).

Adding a brand: add an entry to the `BRANDS` map with the ticker / source identifier in uppercase, plus `bg` and `fg` as RGB tuples. Aim for the brand's primary color; ensure fg contrast against bg meets readability.

## Chart curve

Defined in `packages/cli/src/lib/sparkline.ts`. **Single-row Braille curve at 4 y-levels** (one cell tall), built from a 4×4 = 16-glyph table generated at module load from per-row dot masks (`LEFT_DOT[y]`, `RIGHT_DOT[y]`).

`renderChart(values, { width, direction, mode })` walks three stages before drawing:

1. **3-day centered moving average** smooths daily noise so day-to-day oscillation doesn't make the curve read as scatter when the underlying trend is calm.
2. **Linear-interpolated resampling** to `2 × width` datapoints — neighbors in the sampled array differ by at most `range / sampleCount` in value-space, so adjacent dots end up ≤1 y-step apart in smooth regions.
3. **Per-cell rendering**: for each pair `(left_y, right_y)`, one dot is lit in the left column at `left_y` and one in the right column at `right_y`. When `|left_y − right_y| ≥ 2`, **intermediate y rows are filled too** — distributed across columns by proximity — so steep moves render as a diagonal trail instead of two disconnected dots.

Direction tints the entire chart in `positive` / `negative` / `muted` based on `directionFor(values)` (first vs last comparison).

Flat-series fallback: `⠒` (centered horizontal line).

The chart is rendered with the `1M` label since the backend ships ~22 daily closes from Yahoo (1-month range).

## Motion

Defined in `packages/cli/src/lib/daemon/display.ts`. Timings live in `packages/shared/src/constants/index.ts`.

| Moment         | Constant                                    | Approx. budget                                    |
| -------------- | ------------------------------------------- | ------------------------------------------------- |
| Reveal stagger | `REVEAL_STAGGER_MS`                         | 40ms × rows ≈ 400ms total                         |
| Vanish wipe    | `VANISH_WIPE_PER_ROW_MS`                    | 20ms × rows ≈ 180ms total (under 200ms hard rule) |
| Bar pulse      | `BAR_PULSE_INTERVAL_MS`                     | 110ms frame · 2.2s loop                           |
| Chart shift    | `CHART_SHIFT_MS`                            | 120ms                                             |
| Save flash     | `SAVE_FLASH_FADE_MS` + `SAVE_FLASH_HOLD_MS` | 200 + 800 + 200 ≈ 1.2s                            |

## Responsive breakpoints

| Terminal width | Behaviour                                                                   |
| -------------- | --------------------------------------------------------------------------- |
| ≥ 80 cols      | Full layout                                                                 |
| 60–79          | NEWS drops source name from meta; MARKETS drops stats row                   |
| 40–59          | NEWS drops "live" + score; MARKETS drops chart; footer shrinks to icon-only |
| < 40           | Slot suppressed (stderr log once per session)                               |

## External actions

The CLI never embeds article previews or chart renders. The `[D] open` (news) and `[C] chart` (markets) actions invoke the platform URL handler:

- News: opens `payload.url` (the article URL from the slot payload).
- Markets: opens `payload.chartUrl ?? buildBareSymbolUrl(symbol, assetClass)` (TradingView). The backend populates `chartUrl` per spec §8; the CLI fallback handles backward-compat with old payload producers.

## Data sourcing

Per spec §12, the backend doesn't persist market data. `packages/api/src/lib/yahoo-chart.ts` is the single upstream provider:

- `fetchTickerSnapshot(symbol, assetClass)` returns the current price, prevClose (penultimate candle), 52-week high/low (from Yahoo's quote meta), display name (longName / shortName), and a ~22-point daily-close sparkline — all in one Yahoo chart-endpoint call.
- `fetchYahooCandles(symbol, assetClass, range)` returns OHLCV candles for the dashboard `/tickers/:symbol/history` endpoint.

Both cache in Redis with a 5-minute TTL so we don't hammer Yahoo, and fail soft (return null) on upstream errors so the orchestrator can skip the slot instead of rendering stale data.

## Source-name color (news)

News slots don't render a chip block — instead, the source name itself is rendered in the brand's foreground color via `renderBrandLabel(key, displayName, mode)` (see `packages/cli/src/lib/brand-colors.ts`). HN renders in orange, The Verge in pink, Bloomberg in amber, etc. The chip block treatment is reserved for ticker symbols on the markets slot where it carries identity that the symbol alone doesn't.

## Hooks lifecycle

Distro registers five hooks via `claude-settings.ts`:

| Hook               | Event sent to daemon | Effect                                                                                                             |
| ------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `PreToolUse`       | `idle-start`         | Trigger slot rotation when Claude starts a tool call                                                               |
| `Stop`             | `idle-end`           | Vanish active slot when Claude finishes responding                                                                 |
| `UserPromptSubmit` | `idle-start`         | Same as PreToolUse — surface a slot during a prompt cycle                                                          |
| `SessionStart`     | `session-start`      | Reset per-session state (kill flag, counters)                                                                      |
| `SessionEnd`       | `session-end`        | **Force-vanish any active slot when Claude exits** — ensures the slot doesn't linger in the terminal after `/exit` |

## When you change the system

1. Update the spec section first (`docs/superpowers/specs/2026-05-20-distro-tv-ui-refresh-design.md`).
2. Update this file with the visible changes (table, breakpoint, etc.).
3. Update the code.
4. Manual smoke test: `distro demo --news`, `distro demo --markets` at 40 / 60 / 80 / 120 cols.

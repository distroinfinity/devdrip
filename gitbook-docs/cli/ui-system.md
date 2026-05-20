# CLI UI system

The terminal slot renderers (NEWS and MARKETS channels) share a single visual system: Editorial direction, Coinbase dark palette, landing indigo for chrome, branded chips for sources and tickers, thick-stroke Braille charts.

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

## Chart glyphs

Defined in `packages/cli/src/lib/sparkline.ts`. 9-glyph thick-stroke Braille table indexed by `[left_y][right_y]` where `y ∈ {0, 1, 2}` (0 = top of chart, 2 = bottom).

| L\R   | 0   | 1   | 2   |
| ----- | --- | --- | --- |
| **0** | `⠛` | `⠳` | `⢣` |
| **1** | `⠞` | `⠶` | `⢦` |
| **2** | `⡜` | `⡴` | `⣤` |

`renderChart(values, { width, direction, mode })` resamples to `2 × width` datapoints, maps each to a y-band, and looks up the glyph. Direction tints the entire chart in `positive` / `negative` / `muted`.

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

## When you change the system

1. Update the spec section first (`docs/superpowers/specs/2026-05-20-distro-tv-ui-refresh-design.md`).
2. Update this file with the visible changes (table, breakpoint, etc.).
3. Update the code.
4. Manual smoke test: `distro demo --news`, `distro demo --markets` at 40 / 60 / 80 / 120 cols.

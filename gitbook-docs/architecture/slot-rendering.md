# Slot rendering

The CLI daemon dispatches by `slot.kind` to one of two renderers:

- **News (`renderNewsBox`)** — single headline + source/age/score line + footer hotkeys. M3.
- **Ticker (`renderTickerBox`)** — layout B: header row, price + sparkline + 1m label, stats row (d1/w1/m1/52w), footer hotkeys. M4.

Both renderers produce a multi-line string. The renderer dispatch lives in `packages/cli/src/lib/daemon/display.ts` (`showAd`).

## Rendering model: inline, append-only

`showAd` writes the rendered block **once** to the user's TTY as ordinary scrolling output, then closes the fd. There is **no** scroll region (DECSTBM), **no** cursor save/restore (DECSC/DECRC), **no** absolute positioning, and **no** repaint timers (pulse / progress / resize poll). The block becomes part of the scrollback and scrolls away naturally as the host produces more output.

```ts
const block = "\r\n" + text.split("\n").join("\r\n") + "\x1b[0m\r\n"
writeWithRetry(fd, block)
```

CRLF joins each row so the block lands correctly whether the host left the TTY in cooked or raw mode; the trailing SGR reset prevents color bleed.

**Why this model.** The previous approach pinned a fixed bottom pane via DECSTBM and repainted it on timers. That fought Claude Code's TUI, which owns the same bottom rows (its input box + footer), shares the single cursor-save register, and periodically resets the scroll region — the two writers clobbered each other and corrupted the host screen. Appending plain text can't: it composes with the host like any other line. The tradeoff is that there is no persistent pane, live progress bar, pulse animation, or in-place vanish — the slot just scrolls by.

The orchestrator still drives its show / vanish / progress timers (for impression accounting and rotation), so the `DisplayHandle` keeps its shape but `flash` / `updateProgress` / `vanish` / `onResize` are no-ops; `vanish` reports `latencyMs: 0` (nothing to wipe).

The `as` cast in the dispatch is for the `cacheSource` field on `CachedSlot` and the future `sponsored`/`portfolio` kinds in the `SlotKind` enum that don't have payload types yet.

## Layout B (single ticker)

```
╔═ ● DISTRO TV · 📈 AAPL ═══════════════════════ EQUITY ═╗
║                                                          ║
║  AAPL  $234.56  ▲ +2.34%   ▁▂▂▃▅▆▆▇█▇▆▅▆▇ 1m            ║
║  1d +2.3%  1w +5.1%  1m -1.2%  52w 165-237              ║
║                                                          ║
║  [O]pen  [C]hart  [N]ext  [W]atchlist  [S]kip  [K]ill  [M]ute       ║
╚══════════════════════════════════════════════════════════╝
```

Width is clamped 40-120 cols. ASCII fallback (`+` `-` `|`) when not a TTY (piped output, CI). Arrow is `▲` for non-negative `changePct`, `▼` otherwise; the `+` sign is added for non-negative percentages (the `-` is already on the number).

## Sparkline

`packages/cli/src/lib/sparkline.ts` is a pure block-glyph renderer:

```ts
sparkline(values: number[], width: number): string
```

Block alphabet: `▁▂▃▄▅▆▇█`. Resamples by nearest-neighbor index (`Math.floor((i * values.length) / width)`). Edge cases:

- `width === 0` → empty string
- `values === []` → `width` spaces
- `values.length === 1` or all-equal series → flat mid-block (`▄`-repeat)
- normal series → min/max scaled across the 8 blocks

Six unit tests in `__tests__/sparkline.test.ts` pin these invariants.

## Hotkey map

Same set of hotkeys regardless of slot kind (M5 will add alert behavior):

| key   | news                        | ticker                         |
| ----- | --------------------------- | ------------------------------ |
| `O`   | open story                  | open ticker page               |
| `C`   | —                           | open chart at `/chart/<sym>`   |
| `B`   | save story                  | add ticker to active watchlist |
| `N`   | next                        | next ticker in rotation        |
| `S`   | skip                        | skip                           |
| `K`   | kill all slots this session | same                           |
| `M`   | mute 30 min                 | same                           |
| `Esc` | dismiss                     | dismiss                        |

Layout C (multi-ticker grid) is in the cut-order #2 — deferred until needed.

# Slot rendering

The CLI daemon dispatches by `slot.kind` to one of two renderers:

- **News (`renderNewsBox`)** — single headline + source/age/score line + footer hotkeys. M3.
- **Ticker (`renderTickerBox`)** — layout B: header row, price + sparkline + 1m label, stats row (d1/w1/m1/52w), footer hotkeys. M4.

Both renderers produce a multi-line string anchored to the bottom of the TTY via DECSTBM scroll-region pinning. The renderer dispatch lives in `packages/cli/src/lib/daemon/display.ts`:

```ts
function renderInitial(): string {
  if (slot.kind === "ticker") {
    return renderTickerBox(slot, { width: ctx.width ?? initialCols })
  }
  return renderNewsBox(slot as Parameters<typeof renderNewsBox>[0], baseNewsOpts)
}
```

The `as` cast is for the `cacheSource` field on `CachedSlot` and the future `sponsored`/`portfolio` kinds in the `SlotKind` enum that don't have payload types yet.

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

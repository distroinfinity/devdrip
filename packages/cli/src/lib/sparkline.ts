import type { ColorMode } from "./ansi.js"
import { color } from "./ansi.js"

// Single-dot Braille curve with diagonal bridging.
// Each glyph is a 2-column × 4-row Braille cell. We render the data series
// at 4 y-levels (0 = top, 3 = bottom) — one dot per timestep on the column
// the timestep lives in. For pairs whose left_y and right_y differ by more
// than 1, we ALSO light the intermediate y rows, distributed across columns
// by proximity. That bridges the slope so a steep day-to-day move shows up
// as a diagonal trail instead of two disconnected dots.
//
// Combined with linear-interpolated resampling (see sampling loop below),
// the result is a thin Braille curve that traces the real price action.

// Dot masks by y-level. Dot numbering follows the Braille standard:
//   1 4
//   2 5
//   3 6
//   7 8
const LEFT_DOT = [0x01, 0x02, 0x04, 0x40] as const // y=0..3, left column
const RIGHT_DOT = [0x08, 0x10, 0x20, 0x80] as const // y=0..3, right column

function pairGlyph(ly: number, ry: number): string {
  let leftMask = LEFT_DOT[ly] as number
  let rightMask = RIGHT_DOT[ry] as number
  if (Math.abs(ly - ry) >= 2) {
    const step = ly < ry ? 1 : -1
    for (let y = ly + step; y !== ry; y += step) {
      // intermediate y goes to whichever column is "closer" — first half
      // of the slope stays on the left, second half migrates to the right.
      if (Math.abs(y - ly) <= Math.abs(y - ry)) {
        leftMask |= LEFT_DOT[y] as number
      } else {
        rightMask |= RIGHT_DOT[y] as number
      }
    }
  }
  return String.fromCodePoint(0x2800 | leftMask | rightMask)
}

const GLYPHS: readonly (readonly string[])[] = Array.from({ length: 4 }, (_, ly) =>
  Array.from({ length: 4 }, (_, ry) => pairGlyph(ly, ry))
)

const FLAT_GLYPH = "⠒" // mid-row horizontal line for flat / single-point series

export type ChartDirection = "positive" | "negative" | "neutral"

export interface ChartOpts {
  width: number
  direction?: ChartDirection
  mode?: ColorMode
}

// Renders an area chart from a numeric series. Returns a string of `width`
// characters, ANSI-colored by direction. Empty series → spaces. Single point
// or flat series → flat mid-line in muted color.
export function renderChart(values: number[], opts: ChartOpts): string {
  const { width, direction = "neutral", mode = "none" } = opts
  if (width <= 0) return ""
  if (values.length === 0) return " ".repeat(width)
  if (values.length < 2) return tint(FLAT_GLYPH.repeat(width), direction, mode)

  // Smooth daily noise with a 3-day moving average before resampling. Daily
  // closes oscillate enough that without smoothing, sequential dots flip
  // between adjacent y-rows ~every char even when the underlying trend is
  // stable — making the chart read as scatter instead of a curve. A 3-day
  // window is small enough to preserve real direction changes, big enough
  // to absorb single-day noise.
  const smoothed = smoothSeries(values, 3)

  // Resample to 2 * width datapoints (left + right column per char). Linear
  // interpolation, not nearest-neighbor — neighbors in `sampled` then differ
  // by at most `range / sampleCount` in value-space, so adjacent dots end up
  // ≤1 y-step apart in calm regions. Genuine spikes still jump, and the
  // bridging glyphs handle those.
  const sampleCount = 2 * width
  const sampled: number[] = []
  const lastIdx = smoothed.length - 1
  for (let i = 0; i < sampleCount; i++) {
    const t = (i / Math.max(1, sampleCount - 1)) * lastIdx
    const lo = Math.floor(t)
    const hi = Math.min(lastIdx, lo + 1)
    const frac = t - lo
    const a = smoothed[lo] as number
    const b = smoothed[hi] as number
    sampled.push(a + (b - a) * frac)
  }

  let min = sampled[0] as number
  let max = sampled[0] as number
  for (const v of sampled) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const range = max - min
  if (range === 0) return tint(FLAT_GLYPH.repeat(width), direction, mode)

  // Map each datapoint to y ∈ {0, 1, 2, 3}. Higher price = lower y (top of chart).
  const ys: number[] = sampled.map((v) => {
    const ratio = (v - min) / range
    const inverted = 1 - ratio
    return Math.max(0, Math.min(3, Math.round(inverted * 3)))
  })

  let out = ""
  for (let i = 0; i < width; i++) {
    const ly = ys[2 * i] ?? 1
    const ry = ys[2 * i + 1] ?? 1
    const row = GLYPHS[ly]
    const glyph = row?.[ry] ?? FLAT_GLYPH
    out += glyph
  }
  return tint(out, direction, mode)
}

// Centered moving average. Returns a series the same length as `values`;
// each output[i] is the mean of values in [i - window/2, i + window/2].
// Window is clamped against the array bounds at the edges so the smoothed
// series doesn't drift away from the real endpoints.
function smoothSeries(values: number[], window: number): number[] {
  if (values.length <= window || window <= 1) return values
  const half = Math.floor(window / 2)
  const out: number[] = []
  for (let i = 0; i < values.length; i++) {
    const lo = Math.max(0, i - half)
    const hi = Math.min(values.length, i + half + 1)
    let sum = 0
    let count = 0
    for (let j = lo; j < hi; j++) {
      sum += values[j] as number
      count++
    }
    out.push(count > 0 ? sum / count : (values[i] as number))
  }
  return out
}

function tint(s: string, direction: ChartDirection, mode: ColorMode): string {
  if (direction === "positive") return color("positive", s, mode)
  if (direction === "negative") return color("negative", s, mode)
  return color("muted", s, mode)
}

// Direction helper — pass first and last values, returns the tint to use.
export function directionFor(values: number[]): ChartDirection {
  if (values.length < 2) return "neutral"
  const first = values[0] as number
  const last = values[values.length - 1] as number
  if (last > first) return "positive"
  if (last < first) return "negative"
  return "neutral"
}

// Deprecated — the v1 UI refresh replaced this signature with `renderChart`.
// Kept as a no-color shim so `render-ticker.ts` still compiles during the
// migration; a later task removes the caller.
export function sparkline(values: number[], width: number): string {
  return renderChart(values, { width, mode: "none" })
}

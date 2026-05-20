import type { ColorMode } from "./ansi.js"
import { color } from "./ansi.js"

// Thick-stroke Braille area chart per spec §9.
// Each glyph is a 2-column × 4-row Braille cell rendering one of 3 vertical
// y-bands (top, mid, bot). Adjacent glyphs share at least one row of dots
// with their neighbors, so the visual reads as a continuous flowing stroke.
//
// Y bands (0 = top of chart, 2 = bottom):
//   y=0 → rows 0,1 lit  (top thick line)
//   y=1 → rows 1,2 lit  (mid thick line)
//   y=2 → rows 2,3 lit  (bot thick line)
//
// 9-glyph table indexed by [left_y][right_y]:
const GLYPHS: readonly (readonly string[])[] = [
  // L=0    R=0   R=1   R=2
  /* L=0 */ ["⠛", "⠳", "⢣"],
  // L=1    R=0   R=1   R=2
  /* L=1 */ ["⠞", "⠶", "⢦"],
  // L=2    R=0   R=1   R=2
  /* L=2 */ ["⡜", "⡴", "⣤"],
] as const

const FLAT_GLYPH = "⠶" // mid-line for flat / single-point series

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

  // Resample to 2 * width datapoints (left + right column per char).
  const sampleCount = 2 * width
  const sampled: number[] = []
  for (let i = 0; i < sampleCount; i++) {
    const idx = Math.floor((i * values.length) / sampleCount)
    sampled.push(values[idx] as number)
  }

  let min = sampled[0] as number
  let max = sampled[0] as number
  for (const v of sampled) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const range = max - min
  if (range === 0) return tint(FLAT_GLYPH.repeat(width), direction, mode)

  // Map each datapoint to y ∈ {0, 1, 2}. Higher price = lower y (top of chart).
  const ys: number[] = sampled.map((v) => {
    const ratio = (v - min) / range
    const inverted = 1 - ratio
    return Math.max(0, Math.min(2, Math.round(inverted * 2)))
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

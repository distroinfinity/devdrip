const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]

// Renders a Unicode block-glyph sparkline from a numeric series.
// - resamples to width via nearest-neighbor (good enough for 14-30 → 14-30)
// - all-equal series → flat mid-block line
// - single-point series → flat mid-block line
// - empty series → spaces (preserves layout width)
export function sparkline(values: number[], width: number): string {
  if (width <= 0) return ""
  if (values.length === 0) return " ".repeat(width)
  const flat = BLOCKS[3] ?? "▄"
  if (values.length === 1) return flat.repeat(width)

  const sampled: number[] = []
  for (let i = 0; i < width; i++) {
    const idx = Math.floor((i * values.length) / width)
    const v = values[idx]
    if (typeof v === "number") sampled.push(v)
  }

  if (sampled.length === 0) return " ".repeat(width)

  let min = sampled[0] as number
  let max = sampled[0] as number
  for (const v of sampled) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const range = max - min
  if (range === 0) return flat.repeat(width)

  let out = ""
  for (const v of sampled) {
    const ratio = (v - min) / range
    const idx = Math.min(BLOCKS.length - 1, Math.floor(ratio * BLOCKS.length))
    out += BLOCKS[idx] ?? flat
  }
  return out
}

import type { CachedSlot } from "./slot-cache.js"
import { chipLabelFor } from "./brand-colors.js"

// Single-line slot renderer for Claude Code's statusLine. Plain text (no ANSI,
// no box) so it stays readable wherever Claude pins it. Capped so it never
// blows out the status bar — Claude truncates further if the terminal is narrow.
const MAX = 140
const BAR = "▍"

function age(seconds: number): string {
  if (seconds < 60) return "now"
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 })
  if (p >= 1) return p.toFixed(2)
  return p.toPrecision(4)
}

export function renderSlotLine(slot: CachedSlot): string {
  let line: string
  if (slot.kind === "ticker") {
    const arrow = slot.changePct >= 0 ? "▲" : "▼"
    const sign = slot.changePct >= 0 ? "+" : ""
    line = `${BAR} ${slot.symbol} $${fmtPrice(slot.price)} ${arrow} ${sign}${slot.changePct.toFixed(2)}%`
  } else {
    line = `${BAR} NEWS · ${chipLabelFor(slot.source)} · ${slot.headline} · ${age(slot.ageSeconds)}`
  }
  return line.length > MAX ? line.slice(0, MAX - 1) + "…" : line
}

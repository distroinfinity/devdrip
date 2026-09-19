import type { CachedSlot } from "./slot-cache.js"
import { color, type ColorMode } from "./ansi.js"
import { renderChip, getBrandName, chipLabelFor } from "./brand-colors.js"
import { renderChart, directionFor } from "./sparkline.js"
import { renderOnchainBox } from "./render-onchain.js"

// Multi-line, colored slot panel for Claude Code's statusLine. Mirrors the old
// box's look (indigo bar, brand chip badge, colored change, braille sparkline,
// stats, brand footer) and uses the terminal width — passed in from the daemon,
// which reads it off the tty — to right-align the price/change/age so the panel
// spreads across the available space instead of bunching on the left.
//
// Returned as a "\n"-joined string; the daemon stores it in now-playing.json and
// `distro statusline` prints it verbatim, so Claude renders each line as a row.

const ANSI_RE = /\x1b\[[0-9;]*m/g
const MIN_WIDTH = 48
const MAX_WIDTH = 120
const HEADLINE_MAX_LINES = 2
const LEFT_PAD = "  "

function visLen(s: string): number {
  return [...s.replace(ANSI_RE, "")].length
}

// left … right, right-justified to `width` (min 3-space gap so they never touch)
function spread(left: string, right: string, width: number): string {
  const gap = Math.max(3, width - visLen(left) - visLen(right))
  return left + " ".repeat(gap) + right
}

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

// "+1.26%" / "−1.43%" (unicode minus reads cleaner, matching the old box)
function pct(n: number): string {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}%`
}

// Word-wrap into up to `maxLines`, ellipsizing the last line if it overflows.
function wrapHeadline(text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  let consumed = 0
  for (const word of words) {
    if (current.length === 0) {
      current = word
      consumed++
      continue
    }
    if (current.length + 1 + word.length <= width) {
      current += " " + word
      consumed++
    } else {
      lines.push(current)
      if (lines.length >= maxLines) {
        current = ""
        break
      }
      current = word
      consumed++
    }
  }
  if (current.length > 0 && lines.length < maxLines) lines.push(current)
  if (consumed < words.length && lines.length > 0) {
    const last = lines[lines.length - 1] as string
    const trimmed = last.length >= width ? last.slice(0, width - 1) : last
    lines[lines.length - 1] = trimmed + "…"
  }
  return lines
}

// One-line update prompt shown above the slot heading when a newer CLI exists.
function updateNudge(latest: string, mode: ColorMode): string {
  return `${color("warning", "↑", mode)} ${color("muted", `distro tv ${latest} available · curl -fsSL https://get.distrotv.xyz/install.sh | sh`, mode)}`
}

export function renderSlotLine(
  slot: CachedSlot,
  mode: ColorMode = "truecolor",
  width = 80,
  updateLatest?: string
): string {
  const W = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))
  const dot = color("muted", "·", mode)
  const nudge = updateLatest ? [updateNudge(updateLatest, mode)] : []

  if (slot.kind === "ticker") {
    const header = `${color("indigo", "▍", mode)} ${color("indigo", "markets", mode)} ${dot} ${color("muted", "live", mode)}`

    const chip = renderChip(slot.symbol, mode)
    const name = slot.name ?? getBrandName(slot.symbol) ?? slot.symbol
    const up = slot.changePct >= 0
    const tok = up ? "positive" : "negative"
    const priceLeft = `${LEFT_PAD}${chip}  ${color("fg", name, mode)}`
    const priceRight = `${color("fg", `$${fmtPrice(slot.price)}`, mode)}   ${color(tok, `${up ? "▲" : "▼"} ${pct(slot.changePct)}`, mode)}`
    const priceLine = spread(priceLeft, priceRight, W)

    const sparkW = Math.max(16, Math.min(48, W - 12))
    const chart = renderChart(slot.sparkline, {
      width: sparkW,
      direction: directionFor(slot.sparkline),
      mode,
    })
    const chartLine = `${LEFT_PAD}${chart}  ${color("muted", "1M", mode)}`

    const s = slot.stats
    const stat = (label: string, v: number): string =>
      `${color("muted", label, mode)} ${color(v >= 0 ? "positive" : "negative", pct(v), mode)}`
    const statsLeft = `${LEFT_PAD}${stat("day", s.d1Pct)}   ${dot}   ${stat("wk", s.w1Pct)}   ${dot}   ${stat("mo", s.m1Pct)}`
    const statsRight = color("muted", `52w ${Math.round(s.w52Lo)}–${Math.round(s.w52Hi)}`, mode)
    const statsLine = spread(statsLeft, statsRight, W)

    const footer = `${LEFT_PAD}${color("muted", "distro tv · markets", mode)}`
    return [...nudge, header, priceLine, chartLine, statsLine, footer].join("\n")
  }

  if (slot.kind === "onchain") {
    const box = renderOnchainBox(slot, { width: W, color: mode })
    return [...nudge, box].join("\n")
  }

  // news
  const header = `${color("indigo", "▍", mode)} ${color("indigo", "news", mode)} ${dot} ${color("muted", "live", mode)}`

  const label = chipLabelFor(slot.source)
  const chip = renderChip(label, mode)
  const name = getBrandName(label) ?? label
  const scorePart =
    slot.score != null ? `   ${dot}   ${color("muted", `↑ ${slot.score}`, mode)}` : ""
  const metaLeft = `${LEFT_PAD}${chip}  ${color("fg", name, mode)}${scorePart}`
  const metaRight = color("muted", age(slot.ageSeconds), mode)
  const metaLine = spread(metaLeft, metaRight, W)

  const hlLines = wrapHeadline(slot.headline, W - LEFT_PAD.length, HEADLINE_MAX_LINES).map(
    (l) => `${LEFT_PAD}${color("fg", l, mode)}`
  )

  const footer = `${LEFT_PAD}${color("muted", "distro tv · news", mode)}`
  return [...nudge, header, metaLine, ...hlLines, footer].join("\n")
}

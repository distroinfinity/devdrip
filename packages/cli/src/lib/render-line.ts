import { UTILITY_CTX_WARN_PCT, UTILITY_LIMIT_WARN_PCT, type UtilityPayload } from "@distrotv/shared"
import type { CachedSlot } from "./slot-cache.js"
import { bgRgb, color, rgb, type ColorMode } from "./ansi.js"
import { renderChip, getBrandName, chipLabelFor } from "./brand-colors.js"
import { renderChart, directionFor } from "./sparkline.js"

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

  if (slot.kind === "utility") {
    return renderUtilityPanel(slot, mode, nudge, dot)
  }

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

// ── CH 03 utility panel ─────────────────────────────────────────────────────

type Rgb = readonly [number, number, number]

// per-gauge accent hues (echoing an instrument-panel feel, in our palette)
const GAUGE_CTX: Rgb = [255, 150, 40] // amber — context (focal)
const GAUGE_5H: Rgb = [132, 165, 240] // periwinkle — 5h limit
const GAUGE_7D: Rgb = [94, 200, 188] // teal — weekly limit
const TRACK: Rgb = [60, 64, 74] // shared neutral track
const WARN: Rgb = [240, 97, 109] // red — at/over threshold

const BAR_W = 8

// Colored progress bar: bg blocks in truecolor, fg block chars otherwise.
function renderBar(pct: number, width: number, fill: Rgb, mode: ColorMode): string {
  const p = Math.max(0, Math.min(100, pct))
  const filled = Math.min(width, Math.round((p * width) / 100))
  const empty = width - filled
  if (mode === "truecolor") {
    return (
      bgRgb(" ".repeat(filled), fill[0], fill[1], fill[2], mode) +
      bgRgb(" ".repeat(empty), TRACK[0], TRACK[1], TRACK[2], mode)
    )
  }
  return (
    rgb("█".repeat(filled), fill[0], fill[1], fill[2], mode) +
    color("muted", "░".repeat(empty), mode)
  )
}

// "1h 1m" / "4d 18h" / "12m" / "-" countdown to an epoch-ms reset.
function fmtReset(at: number | undefined, now: number): string {
  if (at === undefined) return "-"
  const diff = Math.max(0, at - now)
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// label + bar + "NN%[ · suffix]"; turns red + ⚠ at/over the warn threshold.
function gauge(
  label: string,
  pct: number | undefined,
  warnAt: number,
  accent: Rgb,
  suffix: string,
  mode: ColorMode
): string | null {
  if (pct === undefined) return null
  const warned = pct >= warnAt
  const fill = warned ? WARN : accent
  const bar = renderBar(pct, BAR_W, fill, mode)
  const pctTok = warned ? "negative" : "muted"
  const pre = warned ? color("warning", "⚠ ", mode) : ""
  const tail = suffix ? ` ${color("muted", `· ${suffix}`, mode)}` : ""
  return `${pre}${color("muted", label, mode)} ${bar} ${color(pctTok, `${pct}%`, mode)}${tail}`
}

function renderUtilityPanel(
  slot: UtilityPayload,
  mode: ColorMode,
  nudge: string[],
  dot: string
): string {
  const now = Date.now()
  const sep = `   ${dot}   `
  const header = `${color("indigo", "▍", mode)} ${color("indigo", "utils", mode)} ${dot} ${color("muted", "live", mode)}`
  const lines: string[] = [...nudge, header]
  const complement = slot.layout === "complement"

  const { ai, git, machine, health } = slot

  if (ai) {
    if (!complement) {
      // full: raw gauges the user doesn't already have on screen
      const gauges = [
        gauge("ctx", ai.ctxPct, UTILITY_CTX_WARN_PCT, GAUGE_CTX, "", mode),
        gauge(
          "5h",
          ai.fiveHourPct,
          UTILITY_LIMIT_WARN_PCT,
          GAUGE_5H,
          fmtReset(ai.fiveHourResetAt, now),
          mode
        ),
        gauge(
          "7d",
          ai.sevenDayPct,
          UTILITY_LIMIT_WARN_PCT,
          GAUGE_7D,
          fmtReset(ai.sevenDayResetAt, now),
          mode
        ),
      ].filter((g): g is string => g !== null)
      if (gauges.length > 0) lines.push(`${LEFT_PAD}${gauges.join(sep)}`)
    }

    // derived/econ line — useful in both layouts (basic status lines rarely show these)
    const econ: string[] = []
    if (ai.costUsd !== undefined) econ.push(`$${ai.costUsd.toFixed(2)}`)
    if (ai.cachePct !== undefined) econ.push(`cache ${ai.cachePct}%`)
    if (ai.burnUsdPerMin !== undefined) econ.push(`burn $${ai.burnUsdPerMin.toFixed(2)}/m`)
    if (ai.timeToLimitMin !== undefined) econ.push(`~${fmtMins(ai.timeToLimitMin)} to limit`)
    if (ai.model) econ.push(ai.effort ? `${ai.model}/${ai.effort}` : ai.model)
    if (econ.length > 0) {
      lines.push(`${LEFT_PAD}${color("muted", econ.join(" · "), mode)}`)
    }
  }

  if (git) {
    const parts: string[] = []
    if (git.branch) parts.push(color("fg", git.branch, mode))
    const ab: string[] = []
    if (git.ahead) ab.push(`↑${git.ahead}`)
    if (git.behind) ab.push(`↓${git.behind}`)
    if (ab.length > 0) parts.push(color("muted", ab.join(" "), mode))
    if (git.dirtyFiles !== undefined) {
      parts.push(color(git.dirtyFiles > 0 ? "warning" : "muted", `${git.dirtyFiles} dirty`, mode))
    }
    if (git.uncommittedLines) parts.push(color("muted", `±${git.uncommittedLines}`, mode))
    if (git.lastCommitAgeSec !== undefined) {
      parts.push(color("muted", `${age(git.lastCommitAgeSec)} ago`, mode))
    }
    if (parts.length > 0) lines.push(`${LEFT_PAD}${parts.join(`  ${dot}  `)}`)
  }

  const tail: string[] = []
  if (machine) {
    const m: string[] = []
    if (machine.cpuPct !== undefined) m.push(`cpu ${machine.cpuPct}%`)
    if (machine.memPct !== undefined) m.push(`mem ${machine.memPct}%`)
    if (machine.battPct !== undefined) m.push(`batt ${machine.battPct}%`)
    if (machine.diskFreePct !== undefined) m.push(`disk ${machine.diskFreePct}%`)
    if (m.length > 0) tail.push(color("muted", m.join(" · "), mode))
  }
  if (health) {
    const h: string[] = []
    if (health.anthropic) {
      const tok = health.anthropic === "ok" ? "positive" : "warning"
      h.push(`${color("muted", "api", mode)} ${color(tok, health.anthropic, mode)}`)
    } else if (health.online === false) {
      h.push(color("negative", "offline", mode))
    }
    if (health.apiLatencyMs !== undefined) h.push(color("muted", `${health.apiLatencyMs}ms`, mode))
    if (h.length > 0) tail.push(h.join(" "))
  }
  if (tail.length > 0) lines.push(`${LEFT_PAD}${tail.join(sep)}`)

  lines.push(`${LEFT_PAD}${color("muted", "distro tv · utils", mode)}`)
  return lines.join("\n")
}

// "90m" → "1h 30m", "45m" → "45m"
function fmtMins(min: number): string {
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`
  return `${min}m`
}

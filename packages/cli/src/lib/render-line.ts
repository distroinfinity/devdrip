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
    return renderUtilityPanel(slot, mode, W, nudge)
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
// "instrument panel": context / gauge / machine rows share one 4-column grid
// (col hues teal · amber · violet · periwinkle), fill+track bars that line up
// across rows, branch + ahead/behind, and an api line only on an incident.

type Rgb = readonly [number, number, number]
interface Hue {
  fill: Rgb
  track: Rgb
}

// per-column hue + its dark "unfilled" track tint (tuned for a dark terminal).
const H_TEAL: Hue = { fill: [94, 200, 188], track: [34, 65, 62] }
const H_AMBER: Hue = { fill: [255, 150, 40], track: [67, 51, 30] }
const H_VIOLET: Hue = { fill: [170, 132, 235], track: [51, 42, 71] }
const H_PERI: Hue = { fill: [132, 165, 240], track: [38, 52, 86] }
const H_GRAY: Hue = { fill: [107, 114, 128], track: [35, 39, 47] }
const H_RED: Hue = { fill: [240, 97, 109], track: [65, 34, 42] }
const FG_RGB: Rgb = [233, 235, 242]

// per-column label field (max label + a space) so bars start at the same x in
// their column on every row.
// columns: ctx(0) · cache(1) · week(2) · 5h(3); machine cpu(0)/mem(1)/disk(2).
const COL_FIELD = [4, 6, 5, 3] as const

// fill + track bar. truecolor → bg blocks; else █/░ fallback.
function renderBar(pct: number, width: number, h: Hue, mode: ColorMode): string {
  const p = Math.max(0, Math.min(100, pct))
  const filled = Math.min(width, Math.round((p * width) / 100))
  const empty = width - filled
  if (mode === "truecolor") {
    return (
      bgRgb(" ".repeat(filled), h.fill[0], h.fill[1], h.fill[2], mode) +
      bgRgb(" ".repeat(empty), h.track[0], h.track[1], h.track[2], mode)
    )
  }
  return (
    rgb("█".repeat(filled), h.fill[0], h.fill[1], h.fill[2], mode) +
    rgb("░".repeat(empty), h.track[0], h.track[1], h.track[2], mode)
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

// right-pad a (possibly colored) string to `n` visible columns.
function padEndVis(s: string, n: number): string {
  return s + " ".repeat(Math.max(0, n - visLen(s)))
}

// one grid cell: label(padded to its column field) + bar + value(+suffix).
function gcell(
  label: string,
  col: number,
  pct: number,
  barW: number,
  h: Hue,
  value: string,
  valueRgb: Rgb,
  mode: ColorMode,
  suffix?: string
): string {
  const lab = color("muted", label.padEnd(COL_FIELD[col] ?? 4), mode)
  const val = rgb(value, valueRgb[0], valueRgb[1], valueRgb[2], mode)
  const suf = suffix ? color("muted", ` · ${suffix}`, mode) : ""
  return `${lab}${renderBar(pct, barW, h, mode)} ${val}${suf}`
}

function renderUtilityPanel(
  slot: UtilityPayload,
  mode: ColorMode,
  W: number,
  nudge: string[]
): string {
  const now = Date.now()
  const header = `${color("indigo", "▍", mode)} ${color("indigo", "utils", mode)}`
  const sep = color("muted", " │ ", mode)
  const { ai, git, machine, health } = slot

  // bar width scales with the terminal width the daemon read off the tty.
  const barW = W >= 110 ? 8 : W >= 90 ? 7 : W >= 72 ? 6 : 5

  // ── context row ── git | cost/burn/proj | model | api(incident only)
  const ctx: string[] = ["", "", "", ""]
  if (git?.branch) {
    // git-CLI style: just the branch + ↑ahead/↓behind vs remote (no dirty count).
    const ab: string[] = []
    if (git.ahead) ab.push(`↑${git.ahead}`)
    if (git.behind) ab.push(`↓${git.behind}`)
    const meta = ab.length ? color("muted", ` ${ab.join(" ")}`, mode) : ""
    ctx[0] = rgb(`⎇ ${git.branch}`, H_TEAL.fill[0], H_TEAL.fill[1], H_TEAL.fill[2], mode) + meta
  }
  if (ai) {
    const econ: string[] = []
    if (ai.costUsd !== undefined) econ.push(`$${ai.costUsd.toFixed(2)}`)
    if (ai.burnUsdPerMin !== undefined) econ.push(`$${ai.burnUsdPerMin.toFixed(2)}/m`)
    let e = econ.length ? color("muted", econ.join(" · "), mode) : ""
    if (ai.timeToLimitMin !== undefined) {
      const proj = rgb(
        `~${fmtMins(ai.timeToLimitMin)}`,
        H_AMBER.fill[0],
        H_AMBER.fill[1],
        H_AMBER.fill[2],
        mode
      )
      e += (e ? color("muted", " · ", mode) : "") + proj
    }
    ctx[1] = e
    if (ai.model) {
      ctx[2] = rgb(
        ai.effort ? `${ai.model} / ${ai.effort}` : ai.model,
        H_VIOLET.fill[0],
        H_VIOLET.fill[1],
        H_VIOLET.fill[2],
        mode
      )
    }
  }
  if (health?.anthropic && health.anthropic !== "ok") {
    ctx[3] = color("negative", `⚠ api ${health.anthropic}`, mode)
  } else if (health && health.online === false) {
    ctx[3] = color("negative", "⚠ offline", mode)
  }

  // ── gauge row ── ctx | cache | week | 5h  (the two limits kept together)
  const gau: string[] = ["", "", "", ""]
  if (ai) {
    if (ai.ctxPct !== undefined) {
      const w = ai.ctxPct >= UTILITY_CTX_WARN_PCT
      gau[0] = gcell(
        "ctx",
        0,
        ai.ctxPct,
        barW,
        w ? H_RED : H_AMBER,
        `${ai.ctxPct}%`,
        w ? H_RED.fill : H_AMBER.fill,
        mode
      )
    }
    if (ai.cachePct !== undefined) {
      gau[1] = gcell(
        "cache",
        1,
        ai.cachePct,
        barW,
        H_VIOLET,
        `${ai.cachePct}%`,
        H_VIOLET.fill,
        mode
      )
    }
    if (ai.sevenDayPct !== undefined) {
      const w = ai.sevenDayPct >= UTILITY_LIMIT_WARN_PCT
      gau[2] = gcell(
        "week",
        2,
        ai.sevenDayPct,
        barW,
        w ? H_RED : H_TEAL,
        `${ai.sevenDayPct}%`,
        w ? H_RED.fill : H_TEAL.fill,
        mode,
        ai.sevenDayResetAt ? fmtReset(ai.sevenDayResetAt, now) : undefined
      )
    }
    if (ai.fiveHourPct !== undefined) {
      const w = ai.fiveHourPct >= UTILITY_LIMIT_WARN_PCT
      const pre = w ? color("negative", "⚠ ", mode) : ""
      gau[3] =
        pre +
        gcell(
          "5h",
          3,
          ai.fiveHourPct,
          barW,
          w ? H_RED : H_PERI,
          `${ai.fiveHourPct}%`,
          w ? H_RED.fill : H_PERI.fill,
          mode,
          ai.fiveHourResetAt ? fmtReset(ai.fiveHourResetAt, now) : undefined
        )
    }
  }

  // ── machine row ── cpu | mem | disk (gray; redden when full ≥90%).
  const mac: string[] = ["", "", "", ""]
  if (machine) {
    const mc = (label: string, col: number, pct: number | undefined): string => {
      if (pct === undefined) return ""
      const hot = pct >= 90
      return gcell(
        label,
        col,
        pct,
        barW,
        hot ? H_RED : H_GRAY,
        String(pct),
        hot ? H_RED.fill : FG_RGB,
        mode
      )
    }
    mac[0] = mc("cpu", 0, machine.cpuPct)
    mac[1] = mc("mem", 1, machine.memPct)
    mac[2] = mc("disk", 2, machine.diskUsedPct)
  }

  // pad cols 0-2 to their widest cell across the rendered rows (col 3 is the
  // tail — its cells already start at the same x, so they align unpadded).
  const build = (rows: string[][]): { lines: string[]; max: number } => {
    const present = rows.filter((r) => r.some((c) => c.length > 0))
    const w = [0, 0, 0]
    for (const r of present)
      for (let i = 0; i < 3; i++) w[i] = Math.max(w[i] ?? 0, visLen(r[i] ?? ""))
    const lines: string[] = []
    let max = 0
    for (const r of present) {
      // a faint divider between the gauge and machine rows —
      // a truly-blank line makes Claude drop the rows after it, so we use a dim rule.
      if (r === mac && max > 0) {
        const ruleW = Math.max(1, max - LEFT_PAD.length)
        lines.push(`${LEFT_PAD}${rgb("\u2500".repeat(ruleW), 60, 64, 74, mode)}`)
      }
      let s =
        padEndVis(r[0] ?? "", w[0] ?? 0) +
        sep +
        padEndVis(r[1] ?? "", w[1] ?? 0) +
        sep +
        padEndVis(r[2] ?? "", w[2] ?? 0)
      if ((r[3] ?? "").length > 0) s += sep + r[3]
      const line = `${LEFT_PAD}${s}`
      lines.push(line)
      max = Math.max(max, visLen(line))
    }
    return { lines, max }
  }

  // progressive degradation so the core gauges always fit: full → drop machine
  // → drop context detail (keep git + api) → gauges only.
  const slimCtx = [ctx[0] ?? "", "", "", ctx[3] ?? ""]
  const attempts = [[ctx, gau, mac], [ctx, gau], [slimCtx, gau], [gau]]
  let chosen = build(attempts[attempts.length - 1] as string[][])
  for (const rows of attempts) {
    const r = build(rows)
    if (r.max <= W) {
      chosen = r
      break
    }
    chosen = r
  }

  return [...nudge, header, ...chosen.lines].join("\n")
}

// "90m" → "1h 30m", "45m" → "45m"
function fmtMins(min: number): string {
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`
  return `${min}m`
}

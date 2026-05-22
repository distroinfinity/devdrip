import type { TickerPayload } from "@distrotv/shared"
import { detectColor, color, type ColorMode } from "./ansi.js"
import { getBrandName, renderChip } from "./brand-colors.js"
import { directionFor, renderChart } from "./sparkline.js"

const DEFAULT_WIDTH = 80
const MIN_WIDTH = 40
const MAX_WIDTH = 120
const ANSI_ESCAPE_RE = /\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g

function visibleLen(s: string): number {
  return [...s.replace(ANSI_ESCAPE_RE, "")].length
}

function clampWidth(w: number | undefined): number {
  const v = w ?? DEFAULT_WIDTH
  if (!Number.isFinite(v)) return DEFAULT_WIDTH
  if (v < MIN_WIDTH) return MIN_WIDTH
  if (v > MAX_WIDTH) return MAX_WIDTH
  return v
}

function pctFormat(n: number): string {
  const sign = n >= 0 ? "+" : ""
  return `${sign}${n.toFixed(2)}%`
}

function pctShort(n: number): string {
  const sign = n >= 0 ? "+" : ""
  return `${sign}${n.toFixed(1)}%`
}

function nowClock(): string {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

function marketsFooter(innerWidth: number, isAlert: boolean): string {
  const full = isAlert
    ? "[O] open · [A] ack · [T] tune · [S] skip"
    : "[C] chart · [W] watch · [S] skip · [K] kill"
  const short = isAlert ? "[O] · [A] · [T] · [S]" : "[C] · [W] · [S] · [K]"
  return innerWidth >= full.length ? full : short
}

export interface TickerRenderOpts {
  width?: number
  color?: ColorMode
  flash?: { text: string; token: "positive" | "negative" | "muted" | "warning" }
  // kept for caller compat with the daemon until later tasks update display.ts.
  source?: string
  progress?: number
  elapsedMs?: number
}

export function renderTickerBox(payload: TickerPayload, opts: TickerRenderOpts = {}): string {
  const width = clampWidth(opts.width)
  const mode: ColorMode = opts.color ?? detectColor()

  // tier selection per spec §10.
  const showChart = width >= 60
  const showStats = width >= 80

  const isAlert = payload.alert != null
  const changeToken = payload.changePct >= 0 ? "positive" : "negative"

  // ── header ──────────────────────────────────────────────
  const headerLeftWords = isAlert
    ? `${color("warning", "▍", mode)} ${color("warning", "alert", mode)} ${color("muted", "·", mode)} ${color("warning", "markets", mode)}`
    : `${color("indigo", "▍", mode)} ${color("indigo", "markets", mode)} ${color("muted", "·", mode)} ${color("muted", "live", mode)}`
  const headerLeftPlain = isAlert ? `▍ alert · markets` : `▍ markets · live`

  const clock = nowClock()
  const rightPlain = opts.flash ? opts.flash.text + "   " + clock : clock
  const right = opts.flash
    ? `${color(opts.flash.token, opts.flash.text, mode)}   ${color("muted", clock, mode)}`
    : color("muted", clock, mode)

  const headerPad = Math.max(1, width - headerLeftPlain.length - rightPlain.length)
  const header = headerLeftWords + " ".repeat(headerPad) + right

  // ── rules ───────────────────────────────────────────────
  const rule = color("rule", "─".repeat(width), mode)

  // ── price line ──────────────────────────────────────────
  //   [TSLA]  Tesla Inc                $404.11   −1.43%
  const chip = renderChip(payload.symbol, mode)
  const chipPlain = ` ${payload.symbol} `
  // Prefer backend-supplied name; fall back to the CLI's curated map so the
  // ticker doesn't render twice (chip + symbol) when the backend ships
  // `name: null`. Last resort: the symbol itself.
  const name = payload.name ?? getBrandName(payload.symbol) ?? payload.symbol
  const price = `$${payload.price.toFixed(2)}`
  const change = pctFormat(payload.changePct)
  const changeDisplay = change.startsWith("+") ? change : change.replace("-", "−") // unicode minus sign reads cleaner in the slot

  const leftSegPlain = `  ${chipPlain}  ${name}`
  const rightSegPlain = `${price}   ${changeDisplay}`
  const priceGap = Math.max(2, width - leftSegPlain.length - rightSegPlain.length - 2)
  const priceLine =
    `  ${chip}  ${color("fg", name, mode)}` +
    " ".repeat(priceGap) +
    `${color("fg", price, mode)}   ${color(changeToken, changeDisplay, mode)}`

  // ── chart line ──────────────────────────────────────────
  let chartLine = ""
  if (showChart) {
    const chartW = Math.max(8, Math.min(32, width - 8))
    const dir = directionFor(payload.sparkline)
    const chart = renderChart(payload.sparkline, { width: chartW, direction: dir, mode })
    // Backend returns ~30 daily candles per slot for a 1-month window.
    chartLine = `  ${chart}  ${color("muted", "1M", mode)}`
  }

  // ── stats row ───────────────────────────────────────────
  let statsLine = ""
  if (showStats && !isAlert) {
    const dPct = pctFormat(payload.stats.d1Pct)
    const wPct = pctShort(payload.stats.w1Pct)
    const mPct = pctShort(payload.stats.m1Pct)
    const range52 = `${Math.round(payload.stats.w52Lo)} — ${Math.round(payload.stats.w52Hi)}`
    const dTok = payload.stats.d1Pct >= 0 ? "positive" : "negative"
    const wTok = payload.stats.w1Pct >= 0 ? "positive" : "negative"
    const mTok = payload.stats.m1Pct >= 0 ? "positive" : "negative"
    statsLine =
      `  ${color("muted", "day", mode)} ${color(dTok, dPct.replace("-", "−"), mode)}` +
      `   ${color("muted", "wk", mode)} ${color(wTok, wPct.replace("-", "−"), mode)}` +
      `   ${color("muted", "mo", mode)} ${color(mTok, mPct.replace("-", "−"), mode)}` +
      `   ${color("muted", "52w", mode)} ${color("muted", range52, mode)}`
  }

  // ── alert body ──────────────────────────────────────────
  // PendingAlert has no free-text message field; compose one from thresholdPct.
  let alertLine = ""
  if (isAlert && payload.alert) {
    const sign = payload.alert.thresholdPct >= 0 ? "+" : ""
    const msg = `threshold ${sign}${payload.alert.thresholdPct.toFixed(1)}% hit`
    alertLine = `  ${color("warning", "▲ " + msg, mode)}`
  }

  // ── footer ──────────────────────────────────────────────
  const footerInner = width - 4
  const footerLine = "  " + color("muted", marketsFooter(footerInner, isAlert), mode)

  // ── assembly ────────────────────────────────────────────
  const blocks: string[] = [header, rule, "", priceLine, ""]
  if (showChart) blocks.push(chartLine, "")
  if (isAlert && alertLine) blocks.push(alertLine, "")
  else if (showStats && statsLine) blocks.push(statsLine, "")
  blocks.push(rule, footerLine)

  // pad each line to `width` for clean scroll-region anchoring (no trailing
  // background color bleed from previous frames).
  return blocks.map((l) => padVisible(l, width)).join("\n")
}

function padVisible(s: string, w: number): string {
  const len = visibleLen(s)
  if (len >= w) return s
  return s + " ".repeat(w - len)
}

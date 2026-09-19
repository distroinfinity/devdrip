import type { OnchainPayload } from "@distrotv/shared"
import { detectColor, color, type ColorMode } from "./ansi.js"

const DEFAULT_WIDTH = 80
const MIN_WIDTH = 40
const MAX_WIDTH = 120
const ANSI_ESCAPE_RE = /\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g

function visibleLen(s: string): number {
  return [...s.replace(ANSI_ESCAPE_RE, "")].length
}

function padVisible(s: string, w: number): string {
  const len = visibleLen(s)
  if (len >= w) return s
  return s + " ".repeat(w - len)
}

function clampWidth(w: number | undefined): number {
  const v = w ?? DEFAULT_WIDTH
  if (!Number.isFinite(v)) return DEFAULT_WIDTH
  if (v < MIN_WIDTH) return MIN_WIDTH
  if (v > MAX_WIDTH) return MAX_WIDTH
  return v
}

function nowClock(): string {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

export interface OnchainRenderOpts {
  width?: number
  color?: ColorMode
}

export function renderOnchainBox(p: OnchainPayload, opts: OnchainRenderOpts = {}): string {
  const width = clampWidth(opts.width)
  const mode: ColorMode = opts.color ?? detectColor()
  const isAlert = p.alert != null
  const accent = isAlert ? "warning" : "indigo"

  // ── header ──────────────────────────────────────────────
  const headerLeftWords =
    `${color(accent, "▍", mode)} ${color(accent, "lp guard", mode)} ` +
    `${color("muted", "·", mode)} ${color("muted", p.poolLabel, mode)}`
  const headerLeftPlain = `▍ lp guard · ${p.poolLabel}`
  const clock = nowClock()
  const headerPad = Math.max(1, width - headerLeftPlain.length - clock.length)
  const header = headerLeftWords + " ".repeat(headerPad) + color("muted", clock, mode)

  // ── rules ───────────────────────────────────────────────
  const rule = color("rule", "─".repeat(width), mode)

  // ── price line ──────────────────────────────────────────
  const volTok = p.volBps > 50 ? "warning" : "muted"
  const priceLine =
    `  ${color("fg", `price ${p.price.toFixed(2)}`, mode)}` +
    `    ${color("muted", `fee ${p.feeBps}bps`, mode)}` +
    `    ${color(volTok, `vol ${p.volBps}`, mode)}`

  // ── range line ──────────────────────────────────────────
  const rangeTok = p.inRange ? "positive" : "negative"
  const rangeLine =
    `  ${color("muted", `range ${p.rangeLower}–${p.rangeUpper}`, mode)}` +
    `   ${color(rangeTok, p.inRange ? "in range" : "out of range", mode)}`

  // ── alert line ──────────────────────────────────────────
  let alertLine = ""
  if (isAlert && p.alert) {
    alertLine = `  ${color("warning", "▲ " + p.alert.message, mode)}`
  }

  // ── footer ──────────────────────────────────────────────
  const footerLine = `  ${color("muted", "[r]ebalance  [e]xit  [h]edge", mode)}`

  // ── assembly ────────────────────────────────────────────
  const blocks: string[] = [header, rule, "", priceLine, rangeLine, ""]
  if (isAlert && alertLine) blocks.push(alertLine, "")
  blocks.push(rule, footerLine)

  return blocks.map((l) => padVisible(l, width)).join("\n")
}

import type { TickerPayload } from "@distrotv/shared"
import { sparkline } from "./sparkline.js"

interface RenderOpts {
  width?: number
  source?: string
  progress?: number
  elapsedMs?: number
}

interface BoxChars {
  tl: string
  tr: string
  bl: string
  br: string
  h: string
  v: string
}

const UNICODE_BOX: BoxChars = { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" }
const ASCII_BOX: BoxChars = { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|" }

const ASCII_FALLBACK = !process.stdout.isTTY

const ANSI_RED = "\x1b[31m"
const ANSI_BOLD = "\x1b[1m"
const ANSI_RESET = "\x1b[0m"

function padLine(s: string, w: number): string {
  if (s.length > w) return s.slice(0, w)
  return s + " ".repeat(w - s.length)
}

function pct(n: number): string {
  const sign = n >= 0 ? "+" : ""
  return `${sign}${n.toFixed(1)}%`
}

export function renderTickerBox(payload: TickerPayload, opts: RenderOpts = {}): string {
  const width = Math.max(40, Math.min(opts.width ?? 80, 120))
  const c = ASCII_FALLBACK ? ASCII_BOX : UNICODE_BOX
  const inner = width - 2
  const isAlert = payload.alert != null
  const arrow = payload.changePct >= 0 ? "▲" : "▼"
  const sign = payload.changePct >= 0 ? "+" : ""

  // header: "═ ● DISTRO TV · 📈 AAPL ═══════════════════════ EQUITY ═"
  const symbolBadge = isAlert ? `🔔 ${payload.symbol} ALERT` : `📈 ${payload.symbol}`
  const headerLeft = ` ● DISTRO TV · ${symbolBadge} `
  const headerRight = ` ${payload.assetClass.toUpperCase()} `
  const fillLen = Math.max(2, inner - headerLeft.length - headerRight.length - 2)
  const headerMid = c.h.repeat(fillLen)
  const header = `${c.tl}${c.h}${headerLeft}${headerMid}${headerRight}${c.h}${c.tr}`

  const priceLine = `  ${payload.symbol}  $${payload.price.toFixed(2)}  ${arrow} ${sign}${payload.changePct.toFixed(2)}%`
  const sparkWidth = Math.max(8, inner - priceLine.length - 5)
  const spark = sparkline(payload.sparkline, sparkWidth)
  const priceFull = padLine(`${priceLine}   ${spark} 1m`, inner)

  const stats = padLine(
    `  1d ${pct(payload.stats.d1Pct)}  1w ${pct(payload.stats.w1Pct)}  1m ${pct(payload.stats.m1Pct)}  52w ${payload.stats.w52Lo.toFixed(0)}-${payload.stats.w52Hi.toFixed(0)}`,
    inner
  )

  const footer = padLine(`  [O]pen  [C]hart  [N]ext  [W]atchlist  [S]kip  [K]ill  [M]ute`, inner)

  const blank = padLine("", inner)
  const lines = [
    header,
    `${c.v}${blank}${c.v}`,
    `${c.v}${priceFull}${c.v}`,
    `${c.v}${stats}${c.v}`,
    `${c.v}${blank}${c.v}`,
    `${c.v}${footer}${c.v}`,
    `${c.bl}${c.h.repeat(inner)}${c.br}`,
  ]
  if (isAlert && !ASCII_FALLBACK) {
    return lines.map((l) => `${ANSI_RED}${ANSI_BOLD}${l}${ANSI_RESET}`).join("\n")
  }
  return lines.join("\n")
}

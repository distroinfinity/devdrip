import { bold, detectColor, dim, green, type ColorMode } from "./ansi.js"

// earnings micro-confirmation — a single-line toast that replaces the
// vanishing ad box for ~2s. kept deliberately unobtrusive: one row, no heavy
// border, accent only on the checkmark and the +$ delta.

export interface EarningsToastOpts {
  deltaUsdc: number
  todayUsdc: number
  width?: number
  ascii?: boolean
  color?: ColorMode
}

function formatUsdc(n: number, digits: number): string {
  // floor to the requested precision so we never inflate the displayed amount
  // relative to what the backend will credit. toFixed rounds half-up which
  // can claim +$0.0050 → +$0.01 when the ledger will only sync $0.0050.
  const factor = 10 ** digits
  const floored = Math.floor(n * factor) / factor
  return `$${floored.toFixed(digits)}`
}

export function renderEarningsToast(opts: EarningsToastOpts): string {
  const ascii = opts.ascii ?? false
  const color: ColorMode = ascii ? "none" : (opts.color ?? detectColor())
  const check = ascii ? "[+]" : "✓"
  const sep = ascii ? "." : "·"

  // delta at 4 decimals (matches the ad-box "$X.XXXX earned" precision).
  // today at 2 decimals (human-facing running total).
  const delta = formatUsdc(opts.deltaUsdc, 4)
  const today = formatUsdc(opts.todayUsdc, 2)

  const parts = [
    green(check, color),
    bold(`+${delta} earned`, color),
    dim(`${sep} today ${today}`, color),
  ]
  return `  ${parts.join(" ")}  `
}

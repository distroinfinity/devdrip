import { REVENUE_SHARE_DEVELOPER, type SponsoredPayload } from "@distrotv/shared"
import { bgRgb, bold, color, rgb, type ColorMode } from "./ansi.js"
import { spread, visLen, wrapHeadline } from "./render-utils.js"

export interface RenderExtras {
  earnedTodayUsd?: number
  // OSC 8 hyperlinks — only when the status line passes them through
  hyperlinks?: boolean
}

// sub-dollar totals keep 4 decimals so per-ad progress stays visible
export function formatEarned(usd: number): string {
  return usd < 1 ? usd.toFixed(4) : usd.toFixed(2)
}

export function perImpressionUsd(cpmRate: number): number {
  return (cpmRate / 1000) * REVENUE_SHARE_DEVELOPER
}

// ad copy is third-party text: drop escape sequences and control bytes before it reaches the tty.
function clean(s: string): string {
  return s
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
}

function link(text: string, url: string, on: boolean): string {
  return on ? `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\` : text
}

const CLICK_HINT = process.platform === "darwin" ? "⌘ click" : "ctrl click"

// three rows, every one led by the bar: claude code strips leading whitespace from
// status lines, so indentation can't group the block — the bar does.
//   ▍ AD  Advertiser                                  +$0.0070
//   ▍ one or two lines of copy
//   ▍ ↗ http://…/c/<code>  ⌘ click          est. today $0.0770
// the url is printed in full on purpose: terminals make any visible http url
// cmd/ctrl-clickable, which is the only same-terminal click that needs no key capture.
export function renderSponsoredPanel(
  slot: SponsoredPayload,
  mode: ColorMode,
  W: number,
  nudge: string[],
  extras: RenderExtras = {}
): string {
  const bar = `${color("indigo", "▍", mode)} `
  const inner = W - 2

  const badge =
    mode === "none" ? "AD" : bgRgb(rgb(bold(" AD ", mode), 10, 10, 12, mode), 129, 140, 248, mode)
  const headLeft = `${badge}  ${bold(color("fg", clean(slot.advertiser), mode), mode)}`
  const headRight = color("positive", `+$${perImpressionUsd(slot.cpmRate).toFixed(4)}`, mode)
  const head = spread(headLeft, headRight, inner)

  const copy = wrapHeadline(clean(slot.headline), inner, 2).map((l) => color("fg", l, mode))

  const useLinks = extras.hyperlinks === true && mode !== "none"
  const url = link(color("indigo", `↗ ${slot.clickUrl}`, mode), slot.clickUrl, useLinks)
  const hint = `  ${color("muted", CLICK_HINT, mode)}`
  const today =
    extras.earnedTodayUsd != null
      ? color("muted", `est. today $${formatEarned(extras.earnedTodayUsd)}`, mode)
      : ""
  // drop the hint, then the total, before ever truncating the url — a cut url can't be clicked
  const fits = (left: string, right: string): boolean =>
    visLen(left) + (right ? 3 + visLen(right) : 0) <= inner
  let action: string
  if (fits(url + hint, today)) action = today ? spread(url + hint, today, inner) : url + hint
  else if (fits(url, today)) action = today ? spread(url, today, inner) : url
  else action = url

  return [...nudge, ...[head, ...copy, action].map((l) => bar + l)].join("\n")
}

import { REVENUE_SHARE_DEVELOPER, type SponsoredPayload } from "@distrotv/shared"
import { color, type ColorMode } from "./ansi.js"
import { LEFT_PAD, spread, wrapHeadline } from "./render-utils.js"

export interface RenderExtras {
  earnedTodayUsd?: number
  // OSC 8 hyperlinks — only when the status line passes them through
  hyperlinks?: boolean
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

export function renderSponsoredPanel(
  slot: SponsoredPayload,
  mode: ColorMode,
  W: number,
  nudge: string[],
  extras: RenderExtras = {}
): string {
  const dot = color("muted", "·", mode)
  const via = slot.source === "carbon" ? "via Carbon" : "via Distro · demo"
  const headerLeft = `${color("indigo", "▍", mode)} ${color("indigo", "sponsored", mode)} ${dot} ${color("muted", via, mode)}`
  const headerRight = color("positive", `+$${perImpressionUsd(slot.cpmRate).toFixed(4)} est`, mode)
  const header = spread(headerLeft, headerRight, W)

  const advertiser = `${LEFT_PAD}${color("fg", clean(slot.advertiser), mode)}`
  const copy = wrapHeadline(clean(slot.headline), W - LEFT_PAD.length, 2).map(
    (l) => `${LEFT_PAD}${color("fg", l, mode)}`
  )

  const useLinks = extras.hyperlinks === true && mode !== "none"
  const host = link(color("indigo", `↗ ${clean(slot.displayUrl)}`, mode), slot.clickUrl, useLinks)
  const today =
    extras.earnedTodayUsd != null
      ? `  ${dot}  ${color("muted", `today $${extras.earnedTodayUsd.toFixed(2)}`, mode)}`
      : ""
  // no spread() on this line — OSC 8 bytes would break its width maths
  const action = `${LEFT_PAD}${host}  ${dot}  ${color("muted", "dtv open", mode)}${today}`

  return [...nudge, header, advertiser, ...copy, action].join("\n")
}

import { describe, it, expect } from "vitest"
import type { SponsoredPayload } from "@distrotv/shared"
import { renderSlotLine } from "../render-line.js"
import { perImpressionUsd } from "../render-sponsored.js"

const ad: SponsoredPayload & { cacheSource: "api" } = {
  kind: "sponsored",
  adId: "house:sentry",
  source: "carbon",
  advertiser: "Sentry",
  headline: "See the error, the commit, and the fix. Monitoring built for developers.",
  ctaText: "Try Sentry",
  displayUrl: "sentry.io",
  clickUrl: "http://localhost:3011/ads/click/3f0c2f0e-7f1a-4b57-9d9e-0d8f4f3f2a11",
  deliveryId: "3f0c2f0e-7f1a-4b57-9d9e-0d8f4f3f2a11",
  cpmRate: 10,
  cacheSource: "api",
}
const strip = (s: string): string =>
  s.replace(/\x1b\][^\x1b]*\x1b\\/g, "").replace(/\x1b\[[0-9;]*m/g, "")

describe("sponsored panel", () => {
  it("estimates the per-impression share", () => {
    expect(perImpressionUsd(10)).toBeCloseTo(0.007, 6)
  })
  it("shows label, advertiser, copy, link, command and estimates", () => {
    const out = renderSlotLine(ad, "none", 80, undefined, { earnedTodayUsd: 0.42 })
    expect(out).toContain("sponsored")
    expect(out).toContain("via Carbon")
    expect(out).toContain("Sentry")
    expect(out).toContain("See the error")
    expect(out).toContain("sentry.io")
    expect(out).toContain("dtv open")
    expect(out).toContain("+$0.0070 est")
    expect(out).toContain("today $0.42")
  })
  it("says demo for house ads", () => {
    expect(renderSlotLine({ ...ad, source: "house" }, "none", 80)).toContain("via Distro")
  })
  it.each([60, 80, 120])("fits width %i and stays within 6 lines", (w) => {
    const lines = strip(
      renderSlotLine(ad, "truecolor", w, undefined, { earnedTodayUsd: 1.5, hyperlinks: true })
    ).split("\n")
    expect(lines.length).toBeLessThanOrEqual(6)
    for (const l of lines) expect([...l].length).toBeLessThanOrEqual(w)
  })
  it("wraps the link in an OSC 8 hyperlink only when enabled", () => {
    expect(renderSlotLine(ad, "truecolor", 80, undefined, { hyperlinks: true })).toContain(
      "\x1b]8;;http://localhost:3011/ads/click/"
    )
    expect(renderSlotLine(ad, "truecolor", 80, undefined, { hyperlinks: false })).not.toContain(
      "\x1b]8;;"
    )
  })
  it("strips control characters from ad copy", () => {
    const out = renderSlotLine({ ...ad, headline: "hi\x1b[31m there\x07" }, "none", 80)
    expect(out).not.toContain("\x07")
    expect(out).not.toContain("\x1b[31m")
    expect(out).toContain("hi there")
  })
})

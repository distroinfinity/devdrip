import { describe, it, expect } from "vitest"
import type { SponsoredPayload } from "@distrotv/shared"
import { renderSlotLine } from "../render-line.js"
import { formatEarned, perImpressionUsd } from "../render-sponsored.js"

const ad: SponsoredPayload & { cacheSource: "api" } = {
  kind: "sponsored",
  adId: "house:sentry",
  source: "carbon",
  advertiser: "Sentry",
  headline: "See the error, the commit, and the fix. Monitoring built for developers.",
  ctaText: "Try Sentry",
  displayUrl: "sentry.io",
  clickUrl: "http://localhost:3011/c/3f0c2f0e7f1a",
  deliveryId: "3f0c2f0e-7f1a-4b57-9d9e-0d8f4f3f2a11",
  cpmRate: 10,
  cacheSource: "api",
}
const strip = (s: string): string =>
  s.replace(/\x1b\][^\x1b]*\x1b\\/g, "").replace(/\x1b\[[0-9;]*m/g, "")

describe("sponsored panel", () => {
  it("keeps sub-dollar totals at 4 decimals", () => {
    expect(formatEarned(0.028)).toBe("0.0280")
    expect(formatEarned(12.5)).toBe("12.50")
  })
  it("estimates the per-impression share", () => {
    expect(perImpressionUsd(10)).toBeCloseTo(0.007, 6)
  })
  it("shows an AD badge, the advertiser, the copy, a clickable url and the estimates", () => {
    const out = renderSlotLine(ad, "none", 80, undefined, { earnedTodayUsd: 0.42 })
    const lines = out.split("\n")
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain("AD")
    expect(lines[0]).toContain("Sentry")
    expect(lines[0]).toContain("+$0.0070")
    expect(lines[1]).toContain("See the error")
    // the full http url is printed so the terminal itself makes it cmd-clickable
    expect(lines[2]).toContain(ad.clickUrl)
    expect(lines[2]).toMatch(/click/)
    expect(lines[2]).toContain("est. today $0.4200")
  })
  it("marks every line with the bar so the block survives stripped indentation", () => {
    const lines = renderSlotLine(ad, "none", 80, undefined, { earnedTodayUsd: 1 }).split("\n")
    for (const l of lines) expect(l.startsWith("▍ ")).toBe(true)
  })
  it("drops the noise: no network label, no command hint", () => {
    const out = renderSlotLine({ ...ad, source: "house" }, "none", 80)
    expect(out).not.toContain("via ")
    expect(out).not.toContain("demo")
    expect(out).not.toContain("dtv open")
  })
  it("never truncates the url, even when the terminal is narrow", () => {
    const out = renderSlotLine(ad, "none", 48, undefined, { earnedTodayUsd: 3 })
    expect(out).toContain(ad.clickUrl)
  })
  it("keeps long copy to one line on wide terminals and two on narrow ones", () => {
    expect(renderSlotLine(ad, "none", 120).split("\n")).toHaveLength(3)
    expect(renderSlotLine(ad, "none", 50).split("\n").length).toBeLessThanOrEqual(4)
  })
  it.each([60, 80, 120])("fits width %i and stays within 4 lines", (w) => {
    const lines = strip(
      renderSlotLine(ad, "truecolor", w, undefined, { earnedTodayUsd: 1.5, hyperlinks: true })
    ).split("\n")
    expect(lines.length).toBeLessThanOrEqual(4)
    for (const l of lines) expect([...l].length).toBeLessThanOrEqual(w)
  })
  it("wraps the link in an OSC 8 hyperlink only when enabled", () => {
    expect(renderSlotLine(ad, "truecolor", 80, undefined, { hyperlinks: true })).toContain(
      "\x1b]8;;http://localhost:3011/c/"
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

import { describe, it, expect } from "vitest"
import { mapCarbonAd, displayLabel } from "../services/carbon-ad.provider.js"
import { houseAd, HOUSE_ADS } from "../services/house-ads.js"

function must<T>(v: T | null | undefined): T {
  if (v == null) throw new Error("expected a value")
  return v
}

describe("mapCarbonAd", () => {
  const base = {
    company: "Sentry",
    description: "Fix errors before users notice. Application monitoring for developers.",
    link: "https://sentry.io/welcome",
    statlink: "https://srv.carbonads.net/ads/click/x/abc",
    statviewUrl: "https://srv.carbonads.net/ads/view/x/abc",
    callToAction: "Try Sentry",
  }
  it("maps fields and derives a stable id", () => {
    const a = must(mapCarbonAd(base))
    expect(a.source).toBe("carbon")
    expect(a.advertiser).toBe("Sentry")
    expect(a.headline).toContain("Fix errors")
    expect(a.ctaText).toBe("Try Sentry")
    expect(a.targetUrl).toBe("https://sentry.io/welcome")
    expect(a.clickBeaconUrl).toBe(base.statlink)
    expect(a.viewBeaconUrl).toBe(base.statviewUrl)
    expect(a.adId).toMatch(/^carbon:[0-9a-f]{32}$/)
    expect(must(mapCarbonAd(base)).adId).toBe(a.adId)
  })
  it("does not double count when the link already is the tracking url", () => {
    // what carbon's demo zone returns: link === statlink, empty statview
    const a = must(mapCarbonAd({ ...base, link: base.statlink, statviewUrl: "" }))
    expect(a.targetUrl).toBe(base.statlink)
    expect(a.clickBeaconUrl).toBeNull()
    expect(a.viewBeaconUrl).toBeNull()
  })
  it("returns null without a description or any url", () => {
    expect(mapCarbonAd({ ...base, description: "" })).toBeNull()
    expect(mapCarbonAd({ ...base, link: "", statlink: "" })).toBeNull()
  })
  it("truncates long copy", () => {
    expect(
      must(mapCarbonAd({ ...base, description: "x".repeat(300) })).headline.length
    ).toBeLessThanOrEqual(140)
  })
  it("rejects non-http targets", () => {
    expect(mapCarbonAd({ ...base, link: "javascript:alert(1)", statlink: "" })).toBeNull()
  })
})

describe("house ads", () => {
  it("rotates and wraps", () => {
    expect(HOUSE_ADS.length).toBeGreaterThanOrEqual(6)
    expect(houseAd(0).adId).toBe(must(HOUSE_ADS[0]).adId)
    expect(houseAd(HOUSE_ADS.length).adId).toBe(must(HOUSE_ADS[0]).adId)
    for (const a of HOUSE_ADS) {
      expect(a.source).toBe("house")
      expect(a.targetUrl.startsWith("https://")).toBe(true)
    }
  })
})

describe("displayLabel", () => {
  it("shows the bare host", () => {
    expect(displayLabel("https://www.sentry.io/welcome?x=1", "Sentry")).toBe("sentry.io")
  })
  it("falls back to the advertiser when the url is a tracker or junk", () => {
    expect(displayLabel("https://srv.carbonads.net/ads/click/x/abc", "IONOS")).toBe("IONOS")
    expect(displayLabel("not a url", "Acme")).toBe("Acme")
  })
})

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

describe("fillSlots", () => {
  const c = (id: string) => ({ adId: `carbon:${id}` })
  const h = (i: number) => ({ adId: `house:${i}` })
  it("fills mostly from the carbon pool, rotating through it, with a house ad every fourth slot", async () => {
    const { fillSlots } = await import("../services/ad-supply.service.js")
    const out = fillSlots(8, [c("a"), c("b"), c("c")], h, 0).picked.map((x) => x.adId)
    expect(out).toEqual([
      "carbon:a",
      "carbon:b",
      "carbon:c",
      "house:0",
      "carbon:a",
      "carbon:b",
      "carbon:c",
      "house:1",
    ])
  })
  it("continues the rotation across batches so consecutive batches don't restart on the same ad", async () => {
    const { fillSlots } = await import("../services/ad-supply.service.js")
    const first = fillSlots(2, [c("a"), c("b"), c("c")], h, 0)
    const second = fillSlots(2, [c("a"), c("b"), c("c")], h, first.cursor)
    expect(first.picked.map((x) => x.adId)).toEqual(["carbon:a", "carbon:b"])
    expect(second.picked.map((x) => x.adId)).toEqual(["carbon:c", "house:0"])
  })
  it("falls back to house ads alone when the pool is empty", async () => {
    const { fillSlots } = await import("../services/ad-supply.service.js")
    expect(fillSlots(3, [], h, 0).picked.map((x) => x.adId)).toEqual([
      "house:0",
      "house:1",
      "house:2",
    ])
  })
})

describe("carbon pool", () => {
  it("keeps distinct ads, newest last, drops stale ones and caps its size", async () => {
    const { mergeCarbonPool } = await import("../services/carbon-ad.provider.js")
    const ad = (id: string) => ({ adId: id }) as never
    let pool = mergeCarbonPool([], [ad("a"), ad("b"), ad("a")], 1_000)
    expect(pool.map((p) => p.ad.adId)).toEqual(["a", "b"])
    pool = mergeCarbonPool(pool, [ad("c")], 2_000)
    expect(pool.map((p) => p.ad.adId)).toEqual(["a", "b", "c"])
    // 31 minutes later everything older than the 30-minute ttl has aged out
    pool = mergeCarbonPool(pool, [ad("d")], 1_000 + 31 * 60_000)
    expect(pool.map((p) => p.ad.adId)).toEqual(["d"])
    // and it never grows past its cap
    const many = Array.from({ length: 20 }, (_, i) => ad(`x${i}`))
    expect(mergeCarbonPool([], many, 5_000).length).toBeLessThanOrEqual(8)
  })
})

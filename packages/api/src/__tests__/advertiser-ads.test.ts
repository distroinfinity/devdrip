import { describe, it, expect } from "vitest"
import { parseNewAd, pickDirect } from "../services/advertiser-ads.service.js"

const ok = {
  brand: "Lumen",
  line: "Deploys that finish before your coffee does.",
  url: "https://lumen.dev",
}

describe("parseNewAd", () => {
  it("accepts a well-formed ad and defaults the bid", () => {
    expect(parseNewAd(ok)).toEqual({ ok: true, ad: { ...ok, bidCpm: 10 } })
    expect(parseNewAd({ ...ok, bidCpm: 25 })).toEqual({ ok: true, ad: { ...ok, bidCpm: 25 } })
  })
  it("trims and collapses whitespace, and strips control characters", () => {
    const r = parseNewAd({
      ...ok,
      brand: "  Lu\x1b[31mmen\x07  ",
      line: "Deploys   that\nfinish fast.",
    })
    expect(r).toEqual({
      ok: true,
      ad: { brand: "Lumen", line: "Deploys that finish fast.", url: ok.url, bidCpm: 10 },
    })
  })
  it("rejects bad brand, line, url and bid with a field-specific code", () => {
    expect(parseNewAd({ ...ok, brand: "x" })).toEqual({ ok: false, error: "invalid_brand" })
    expect(parseNewAd({ ...ok, brand: "x".repeat(41) })).toEqual({
      ok: false,
      error: "invalid_brand",
    })
    expect(parseNewAd({ ...ok, line: "too short" })).toEqual({ ok: false, error: "invalid_line" })
    expect(parseNewAd({ ...ok, line: "x".repeat(141) })).toEqual({
      ok: false,
      error: "invalid_line",
    })
    expect(parseNewAd({ ...ok, bidCpm: 0 })).toEqual({ ok: false, error: "invalid_bid" })
    expect(parseNewAd({ ...ok, bidCpm: 101 })).toEqual({ ok: false, error: "invalid_bid" })
    expect(parseNewAd({ ...ok, bidCpm: "10" })).toEqual({ ok: false, error: "invalid_bid" })
    expect(parseNewAd(null)).toEqual({ ok: false, error: "invalid_brand" })
  })
  it("only allows https links to a real host", () => {
    for (const url of [
      "http://lumen.dev",
      "javascript:alert(1)",
      "https://",
      "https://localhost/x",
      "https://user:pw@lumen.dev",
      "not a url",
    ]) {
      expect(parseNewAd({ ...ok, url })).toEqual({ ok: false, error: "invalid_url" })
    }
  })
})

describe("pickDirect", () => {
  const ads = [
    { id: "a", bidCpm: 10, createdAt: 1 },
    { id: "b", bidCpm: 30, createdAt: 2 },
    { id: "c", bidCpm: 30, createdAt: 3 },
  ]
  it("every batch leads with the highest bid; ties go to the older ad", () => {
    expect(pickDirect(ads, 5).map((a) => a.id)).toEqual(["b", "c", "a", "b", "c"])
    // asking again gives the same order — no cursor that lets a low bid jump the queue
    expect(pickDirect(ads, 5).map((a) => a.id)).toEqual(["b", "c", "a", "b", "c"])
  })
  it("when slots are scarce the highest bids win them", () => {
    expect(pickDirect(ads, 2).map((a) => a.id)).toEqual(["b", "c"])
    expect(pickDirect(ads, 1).map((a) => a.id)).toEqual(["b"])
  })
  it("a higher bid never gets fewer slots than a lower one", () => {
    const counts = new Map<string, number>()
    for (const p of pickDirect(ads, 7)) counts.set(p.id, (counts.get(p.id) ?? 0) + 1)
    expect(counts.get("b") ?? 0).toBeGreaterThanOrEqual(counts.get("a") ?? 0)
    expect(counts.get("c") ?? 0).toBeGreaterThanOrEqual(counts.get("a") ?? 0)
  })
  it("returns nothing when there are no ads or no room", () => {
    expect(pickDirect([], 3)).toEqual([])
    expect(pickDirect(ads, 0)).toEqual([])
  })
})

import { describe, it, expect } from "vitest"
import { buildAdImpression, toIngestImpression } from "../ad-impression.js"

const slot = {
  kind: "sponsored" as const,
  adId: "house:neon",
  source: "house" as const,
  advertiser: "Neon",
  headline: "x",
  ctaText: "Start",
  displayUrl: "neon.tech",
  clickUrl: "http://localhost:3011/ads/click/abc",
  deliveryId: "3f0c2f0e-7f1a-4b57-9d9e-0d8f4f3f2a11",
  cpmRate: 10,
}

describe("buildAdImpression", () => {
  it("maps a sponsored slot onto the ledger row", () => {
    const row = buildAdImpression({
      id: "i1",
      slot,
      shownAt: 1000,
      durationMs: 12000,
      result: "completed",
      deviceId: "dev1",
    })
    expect(row).toEqual({
      id: "i1",
      adId: "house:neon",
      campaignId: "house",
      surface: "terminal-tv",
      source: "house",
      deliveryToken: slot.deliveryId,
      startedAt: 1000,
      durationMs: 12000,
      result: "completed",
      deviceId: "dev1",
      cpmRate: 10,
    })
  })
})

describe("toIngestImpression", () => {
  it("sends only what the server needs", () => {
    const row = buildAdImpression({
      id: "i1",
      slot,
      shownAt: 1000,
      durationMs: 800,
      result: "interrupted",
      deviceId: "dev1",
    })
    expect(toIngestImpression(row)).toEqual({
      deliveryToken: slot.deliveryId,
      durationMs: 800,
      result: "interrupted",
    })
  })
})

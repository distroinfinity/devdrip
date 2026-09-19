import { describe, it, expect, vi, beforeEach } from "vitest"
import type { AdRequest } from "@devdrip/shared"
import { AdSurface, MAX_AD_DURATION_MS } from "@devdrip/shared"

// mock env before importing provider
vi.mock("../config/env.js", () => ({
  env: {
    carbonZoneKey: "TEST_ZONE",
    carbonPlacement: "test-app",
    carbonCpmRate: 0.8,
  },
}))

// mock Carbon SDK
const mockFetchAd = vi.fn()
vi.mock("@carbonads/sdk", () => ({
  fetchAd: (...args: unknown[]) => mockFetchAd(...args),
}))

// mock DB
vi.mock("../db/index.js", () => ({
  getDb: vi.fn(),
}))

// mock system campaign
vi.mock("../lib/carbon-system-campaign.js", () => ({
  CARBON_CAMPAIGN_ID: "carbon-campaign-uuid",
}))

// mock logger
vi.mock("../lib/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { carbonAdProvider } from "../services/carbon-ad.provider.js"
import { getDb } from "../db/index.js"
import { env } from "../config/env.js"

function baseRequest(overrides: Partial<AdRequest> = {}): AdRequest {
  return {
    deviceId: "device-1",
    userId: "user-1",
    os: "darwin",
    ideType: "cursor",
    surface: AdSurface.TerminalTv,
    count: 1,
    blockedCategories: [],
    enabledSurfaces: Object.values(AdSurface) as AdSurface[],
    maxAdsPerHour: 8,
    maxAdsPerDay: 60,
    tzOffsetMinutes: 0,
    ...overrides,
  }
}

function mockCarbonAd(overrides: Record<string, unknown> = {}) {
  return {
    company: "Acme Corp",
    description: "Build faster with Acme developer tools.",
    link: "https://srv.carbonads.net/ads/click/x/abc123?timestamp=1234",
    statlink: "https://srv.carbonads.net/ads/click/x/abc123",
    statviewUrl: "https://srv.carbonads.net/ads/viewable/x/abc123?segment=placement:test-app",
    image: "https://srv.carbonads.net/static/30242/img.png",
    smallImage: "",
    largeImage: "",
    logo: "",
    backgroundColor: "",
    callToAction: "Get Started",
    companyTagline: "Dev tools that scale",
    adViaLink: "https://discover.buysellads.com/carbon",
    pixel: "",
    ...overrides,
  }
}

function mockDbInsertReturning(id: string) {
  const returningFn = vi.fn().mockResolvedValue([{ id, campaignId: "carbon-campaign-uuid" }])
  const onConflictDoUpdateFn = vi.fn(() => ({ returning: returningFn }))
  const valuesFn = vi.fn(() => ({ onConflictDoUpdate: onConflictDoUpdateFn }))
  const insertFn = vi.fn(() => ({ values: valuesFn }))
  vi.mocked(getDb).mockReturnValue({ insert: insertFn } as unknown as ReturnType<typeof getDb>)
  return { insertFn, valuesFn, onConflictDoUpdateFn, returningFn }
}

describe("CarbonAdProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // reset the mutable env mock
    ;(env as Record<string, unknown>).carbonZoneKey = "TEST_ZONE"
  })

  it("has name 'carbon'", () => {
    expect(carbonAdProvider.name).toBe("carbon")
  })

  it("uses SDK demo defaults when carbonZoneKey is empty", async () => {
    ;(env as Record<string, unknown>).carbonZoneKey = ""
    vi.mocked(mockFetchAd).mockResolvedValueOnce(null)

    const result = await carbonAdProvider.fetchAds(baseRequest())

    expect(mockFetchAd).toHaveBeenCalledWith({ placement: "test-app" })
    expect(result).toEqual([])
  })

  it("returns empty array when Carbon SDK returns null", async () => {
    mockFetchAd.mockResolvedValue(null)
    const result = await carbonAdProvider.fetchAds(baseRequest())
    expect(result).toEqual([])
  })

  it("returns empty array when Carbon SDK throws", async () => {
    mockFetchAd.mockRejectedValue(new Error("network error"))
    const result = await carbonAdProvider.fetchAds(baseRequest())
    expect(result).toEqual([])
  })

  it("returns empty array when Carbon SDK times out", async () => {
    mockFetchAd.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockCarbonAd()), 5000))
    )
    const result = await carbonAdProvider.fetchAds(baseRequest())
    expect(result).toEqual([])
  }, 10000)

  it("translates Carbon response to AdPayload", async () => {
    const ad = mockCarbonAd()
    mockFetchAd.mockResolvedValue(ad)
    mockDbInsertReturning("creative-uuid-1")

    const result = await carbonAdProvider.fetchAds(baseRequest())

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: "creative-uuid-1",
      campaignId: "carbon-campaign-uuid",
      format: "text",
      headline: "Acme Corp",
      body: "Build faster with Acme developer tools.",
      url: ad.link,
      displayTimeMs: MAX_AD_DURATION_MS,
      cpmRate: 0.8,
      impressionBeaconUrl: ad.statviewUrl,
      clickTrackingUrl: ad.statlink,
    })
  })

  it("truncates long headline to 60 chars", async () => {
    const longCompany = "A".repeat(80)
    mockFetchAd.mockResolvedValue(mockCarbonAd({ company: longCompany }))
    mockDbInsertReturning("creative-uuid-2")

    const result = await carbonAdProvider.fetchAds(baseRequest())

    expect(result[0]?.headline.length).toBeLessThanOrEqual(60)
    expect(result[0]?.headline.endsWith("…")).toBe(true)
  })

  it("truncates long body to 140 chars", async () => {
    const longDesc = "B".repeat(200)
    mockFetchAd.mockResolvedValue(mockCarbonAd({ description: longDesc }))
    mockDbInsertReturning("creative-uuid-3")

    const result = await carbonAdProvider.fetchAds(baseRequest())

    expect(result[0]?.body?.length).toBeLessThanOrEqual(140)
    expect(result[0]?.body?.endsWith("…")).toBe(true)
  })

  it("calls fetchAd with configured zone key and placement", async () => {
    mockFetchAd.mockResolvedValue(mockCarbonAd())
    mockDbInsertReturning("creative-uuid-4")

    await carbonAdProvider.fetchAds(baseRequest())

    expect(mockFetchAd).toHaveBeenCalledWith({
      serve: "TEST_ZONE",
      placement: "test-app",
    })
  })

  it("returns at most 1 ad regardless of count", async () => {
    mockFetchAd.mockResolvedValue(mockCarbonAd())
    mockDbInsertReturning("creative-uuid-5")

    const result = await carbonAdProvider.fetchAds(baseRequest({ count: 3 }))
    expect(result).toHaveLength(1)
  })

  it("returns empty array when DB upsert throws", async () => {
    mockFetchAd.mockResolvedValue(mockCarbonAd())
    const returningFn = vi.fn().mockRejectedValue(new Error("db connection lost"))
    const onConflictDoUpdateFn = vi.fn(() => ({ returning: returningFn }))
    const valuesFn = vi.fn(() => ({ onConflictDoUpdate: onConflictDoUpdateFn }))
    const insertFn = vi.fn(() => ({ values: valuesFn }))
    vi.mocked(getDb).mockReturnValue({ insert: insertFn } as unknown as ReturnType<typeof getDb>)

    const result = await carbonAdProvider.fetchAds(baseRequest())
    expect(result).toEqual([])
  })

  it("uses companyTagline as headline when company is empty", async () => {
    mockFetchAd.mockResolvedValue(mockCarbonAd({ company: "", companyTagline: "Great Tagline" }))
    mockDbInsertReturning("creative-uuid-6")

    const result = await carbonAdProvider.fetchAds(baseRequest())
    expect(result[0]?.headline).toBe("Great Tagline")
  })
})

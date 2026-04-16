import { describe, it, expect, vi, beforeEach } from "vitest"
import type { AdRequest, AdPayload } from "@devdrip/shared"
import { AdSurface, MAX_AD_DURATION_MS } from "@devdrip/shared"

// mock Redis
vi.mock("../lib/redis.js", () => ({
  getRedis: vi.fn(() => ({
    set: vi.fn().mockResolvedValue("OK"),
    getdel: vi.fn().mockResolvedValue("1"),
  })),
}))

// mock frequency lib
const mockCheckFrequencyCaps = vi.fn().mockResolvedValue({ allowed: true })
vi.mock("../lib/frequency.js", () => ({
  checkFrequencyCaps: (...args: unknown[]) => mockCheckFrequencyCaps(...args),
  isQuietHours: vi.fn().mockReturnValue(false),
}))

// mock delivery token
vi.mock("../lib/ad-delivery.js", () => ({
  issueDeliveryToken: vi.fn().mockResolvedValue("mock-token"),
}))

// mock providers
const mockCarbonFetchAds = vi.fn().mockResolvedValue([])
vi.mock("../services/carbon-ad.provider.js", () => ({
  carbonAdProvider: {
    name: "carbon",
    fetchAds: (...args: unknown[]) => mockCarbonFetchAds(...args),
  },
}))

const mockManualFetchAds = vi.fn().mockResolvedValue([])
vi.mock("../services/ad-selection.service.js", () => ({
  manualAdProvider: {
    name: "manual",
    fetchAds: (...args: unknown[]) => mockManualFetchAds(...args),
  },
}))

// mock logger
vi.mock("../lib/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { fetchServedAds } from "../services/ad-delivery.service.js"
import { isQuietHours } from "../lib/frequency.js"

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

function fakeAd(id: string, source: string): AdPayload {
  return {
    id,
    campaignId: `camp-${source}`,
    format: "text",
    headline: `${source} ad`,
    url: "https://example.com",
    displayTimeMs: MAX_AD_DURATION_MS,
  }
}

describe("waterfall orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckFrequencyCaps.mockResolvedValue({ allowed: true })
    vi.mocked(isQuietHours).mockReturnValue(false)
    mockCarbonFetchAds.mockResolvedValue([])
    mockManualFetchAds.mockResolvedValue([])
  })

  // ── waterfall order ──────────────────────────────────────────────────────

  it("calls Carbon first (primary provider)", async () => {
    mockCarbonFetchAds.mockResolvedValue([fakeAd("c1", "carbon")])
    const result = await fetchServedAds(baseRequest())

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe("c1")
    expect(mockCarbonFetchAds).toHaveBeenCalled()
    expect(mockManualFetchAds).not.toHaveBeenCalled()
  })

  it("falls back to manual when Carbon returns empty", async () => {
    mockCarbonFetchAds.mockResolvedValue([])
    mockManualFetchAds.mockResolvedValue([fakeAd("m1", "manual")])

    const result = await fetchServedAds(baseRequest())
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe("m1")
    expect(mockManualFetchAds).toHaveBeenCalled()
  })

  it("combines Carbon + manual when Carbon partially fills", async () => {
    mockCarbonFetchAds.mockResolvedValue([fakeAd("c1", "carbon")])
    mockManualFetchAds.mockResolvedValue([fakeAd("m1", "manual")])

    const result = await fetchServedAds(baseRequest({ count: 2 }))
    expect(result).toHaveLength(2)
    expect(result[0]?.id).toBe("c1")
    expect(result[1]?.id).toBe("m1")
  })

  it("returns empty when both providers return empty", async () => {
    const result = await fetchServedAds(baseRequest())
    expect(result).toEqual([])
  })

  it("does not call manual when Carbon fills all requested slots", async () => {
    mockCarbonFetchAds.mockResolvedValue([fakeAd("c1", "carbon")])

    await fetchServedAds(baseRequest({ count: 1 }))
    expect(mockManualFetchAds).not.toHaveBeenCalled()
  })

  // ── frequency caps (shared gate) ────────────────────────────────────────

  it("returns empty when frequency cap is exceeded", async () => {
    mockCheckFrequencyCaps.mockResolvedValue({ allowed: false, reason: "total_hourly_cap" })
    const result = await fetchServedAds(baseRequest())
    expect(result).toEqual([])
    expect(mockCarbonFetchAds).not.toHaveBeenCalled()
    expect(mockManualFetchAds).not.toHaveBeenCalled()
  })

  // ── quiet hours ──────────────────────────────────────────────────────────

  it("returns empty during quiet hours", async () => {
    vi.mocked(isQuietHours).mockReturnValue(true)
    const result = await fetchServedAds(baseRequest())
    expect(result).toEqual([])
    expect(mockCarbonFetchAds).not.toHaveBeenCalled()
  })

  // ── surface gate ─────────────────────────────────────────────────────────

  it("returns empty when surface is disabled", async () => {
    const result = await fetchServedAds(baseRequest({ enabledSurfaces: [AdSurface.CompanionTab] }))
    expect(result).toEqual([])
    expect(mockCarbonFetchAds).not.toHaveBeenCalled()
  })

  // ── delivery tokens ──────────────────────────────────────────────────────

  it("attaches delivery tokens to served ads", async () => {
    mockCarbonFetchAds.mockResolvedValue([fakeAd("c1", "carbon")])
    const result = await fetchServedAds(baseRequest())
    expect(result[0]).toHaveProperty("deliveryToken", "mock-token")
  })
})

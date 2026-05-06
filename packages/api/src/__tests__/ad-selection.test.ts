import { describe, it, expect, vi, beforeEach } from "vitest"
import type { AdRequest } from "@distrotv/shared"
import { AdSurface, MAX_AD_DURATION_MS } from "@distrotv/shared"

// mock Redis and DB before importing service
vi.mock("../lib/redis.js", () => ({
  getRedis: vi.fn(() => ({
    pipeline: () => ({
      get: vi.fn(),
      incr: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn().mockResolvedValue([0, 0, 0]),
    }),
    get: vi.fn().mockResolvedValue(null),
  })),
}))

vi.mock("../db/index.js", () => ({
  getDb: vi.fn(),
}))

vi.mock("../lib/budget.js", () => ({
  nextCreativeIndex: vi.fn().mockResolvedValue(0),
}))

// mock frequency lib — only checkCampaignCap remains in the provider
const mockCheckCampaignCap = vi.fn().mockResolvedValue(true)
vi.mock("../lib/frequency.js", () => ({
  checkCampaignCap: (...args: unknown[]) => mockCheckCampaignCap(...args),
}))

import { manualAdProvider } from "../services/ad-selection.service.js"
import { getDb } from "../db/index.js"
import { nextCreativeIndex } from "../lib/budget.js"

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

function mockCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "creative-1",
    campaignId: "campaign-1",
    headline: "Test Ad",
    body: "Test body",
    ctaUrl: "https://example.com",
    format: "text",
    surface: "terminal-tv",
    category: "developer-tools",
    source: "direct",
    cpmRate: 5.0,
    impressionBeaconUrl: null,
    clickTrackingUrl: null,
    campBudgetTotal: 1000,
    campBudgetSpent: 100,
    campBudgetDaily: 50,
    campPacingStrategy: "even",
    campTargetSurfaces: [],
    campTargetingRules: null,
    ...overrides,
  }
}

// helper to set up DB mock returning specific rows
function mockDbSelect(rows: Record<string, unknown>[]) {
  const selectFn = vi.fn(() => ({
    from: vi.fn(() => ({
      innerJoin: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(rows),
      })),
    })),
  }))
  vi.mocked(getDb).mockReturnValue({ select: selectFn } as unknown as ReturnType<typeof getDb>)
}

describe("ManualAdProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckCampaignCap.mockResolvedValue(true)
    vi.mocked(nextCreativeIndex).mockResolvedValue(0)
  })

  it("has name 'manual'", () => {
    expect(manualAdProvider.name).toBe("manual")
  })

  // note: surface gate, quiet hours, and frequency cap checks are tested
  // in ad-delivery.test.ts (waterfall orchestrator)

  it("returns empty array when no candidates from DB", async () => {
    mockDbSelect([])
    const result = await manualAdProvider.fetchAds(baseRequest())
    expect(result).toEqual([])
  })

  it("returns ad payload when candidates exist and pass all filters", async () => {
    mockDbSelect([mockCandidate()])
    const result = await manualAdProvider.fetchAds(baseRequest())

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: "creative-1",
      campaignId: "campaign-1",
      format: "text",
      headline: "Test Ad",
      body: "Test body",
      url: "https://example.com",
      displayTimeMs: MAX_AD_DURATION_MS,
      cpmRate: 5,
      impressionBeaconUrl: undefined,
      clickTrackingUrl: undefined,
    })
  })

  it("filters out candidates whose campaign targetSurfaces excludes requested surface", async () => {
    mockDbSelect([mockCandidate({ campTargetSurfaces: ["companion-tab"] })])
    const result = await manualAdProvider.fetchAds(baseRequest())
    expect(result).toEqual([])
  })

  it("filters out candidates failing OS targeting", async () => {
    mockDbSelect([mockCandidate({ campTargetingRules: { osAllow: ["linux"] } })])
    const result = await manualAdProvider.fetchAds(baseRequest({ os: "darwin" }))
    expect(result).toEqual([])
  })

  it("filters out candidates failing IDE targeting", async () => {
    mockDbSelect([mockCandidate({ campTargetingRules: { ideAllow: ["vscode"] } })])
    const result = await manualAdProvider.fetchAds(baseRequest({ ideType: "cursor" }))
    expect(result).toEqual([])
  })

  it("filters out candidates with exhausted budget", async () => {
    mockDbSelect([mockCandidate({ campBudgetTotal: 100, campBudgetSpent: 100 })])
    const result = await manualAdProvider.fetchAds(baseRequest())
    expect(result).toEqual([])
  })

  it("filters out candidates exceeding per-campaign frequency cap", async () => {
    mockCheckCampaignCap.mockResolvedValue(false)
    mockDbSelect([mockCandidate({ campTargetingRules: { maxImpressions: 5 } })])
    const result = await manualAdProvider.fetchAds(baseRequest())
    expect(result).toEqual([])
  })

  it("uses nextCreativeIndex for rotation within a campaign", async () => {
    const candidates = [mockCandidate({ id: "creative-a" }), mockCandidate({ id: "creative-b" })]
    mockDbSelect(candidates)
    vi.mocked(nextCreativeIndex).mockResolvedValue(1)

    const result = await manualAdProvider.fetchAds(baseRequest())
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe("creative-b")
  })

  it("returns ads from different campaigns up to count", async () => {
    const candidates = [
      mockCandidate({ id: "c1", campaignId: "camp-a" }),
      mockCandidate({ id: "c2", campaignId: "camp-b" }),
    ]
    mockDbSelect(candidates)

    const result = await manualAdProvider.fetchAds(baseRequest({ count: 2 }))
    expect(result).toHaveLength(2)
    expect(result.map((a) => a.id)).toEqual(["c1", "c2"])
  })

  it("respects count limit", async () => {
    const candidates = [
      mockCandidate({ id: "c1", campaignId: "camp-a" }),
      mockCandidate({ id: "c2", campaignId: "camp-b" }),
      mockCandidate({ id: "c3", campaignId: "camp-c" }),
    ]
    mockDbSelect(candidates)

    const result = await manualAdProvider.fetchAds(baseRequest({ count: 2 }))
    expect(result).toHaveLength(2)
  })

  it("returns payload with url empty string when ctaUrl is null", async () => {
    mockDbSelect([mockCandidate({ ctaUrl: null })])
    const result = await manualAdProvider.fetchAds(baseRequest())
    expect(result[0]?.url).toBe("")
  })

  it("includes beacon URLs when creative has them", async () => {
    mockDbSelect([
      mockCandidate({
        impressionBeaconUrl: "https://track.example.com/impression",
        clickTrackingUrl: "https://track.example.com/click",
      }),
    ])
    const result = await manualAdProvider.fetchAds(baseRequest())
    expect(result[0]?.impressionBeaconUrl).toBe("https://track.example.com/impression")
    expect(result[0]?.clickTrackingUrl).toBe("https://track.example.com/click")
  })

  it("omits beacon URLs when creative has none", async () => {
    mockDbSelect([mockCandidate()])
    const result = await manualAdProvider.fetchAds(baseRequest())
    expect(result[0]?.impressionBeaconUrl).toBeUndefined()
    expect(result[0]?.clickTrackingUrl).toBeUndefined()
  })
})

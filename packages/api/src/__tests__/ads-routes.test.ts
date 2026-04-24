import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { MAX_AD_DURATION_MS, AdSurface } from "@devdrip/shared"
import type { ServedAdPayload } from "@devdrip/shared"

// set JWT_SECRET before any imports that access env
process.env["JWT_SECRET"] = "test-secret-that-is-long-enough-for-hs256-signing-purposes"
process.env["ALLOWED_ORIGINS"] = "http://localhost:3000"

// mock DB — mockSelectFrom returns the chained query object per table
const mockSelectFrom = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue([]),
})
vi.mock("../db/index.js", () => ({
  getDb: vi.fn(() => ({
    select: () => ({
      from: (table: unknown) => mockSelectFrom(table),
    }),
  })),
}))

// mock ad delivery service
const mockFetchServedAds = vi.fn().mockResolvedValue([])
vi.mock("../services/ad-delivery.service.js", () => ({
  fetchServedAds: (...args: unknown[]) => mockFetchServedAds(...args),
}))

// mock Redis (rate limiter uses it)
vi.mock("../lib/redis.js", () => ({
  getRedis: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    pipeline: () => ({
      get: vi.fn(),
      exec: vi.fn().mockResolvedValue([null, null]),
    }),
  })),
}))

// mock rate limiter to pass through
vi.mock("../middleware/rate-limit.js", () => {
  const passThrough = (_req: unknown, _res: unknown, next: () => void) => next()
  return {
    globalLimiter: passThrough,
    userLimiter: passThrough,
    adminLimiter: passThrough,
    publicLimiter: passThrough,
    authLimiter: passThrough,
    refreshLimiter: passThrough,
    sensitiveLimiter: passThrough,
    machineLimiter: passThrough,
  }
})

import request from "supertest"
import { app } from "../app.js"
import { signAccessToken } from "../lib/jwt.js"
import { devices } from "../db/schema/devices.js"
import { preferences } from "../db/schema/preferences.js"

const TEST_USER_ID = "00000000-1111-2222-3333-444444444444"
const TEST_DEVICE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

let validToken: string

function fakeServedAd(id: string): ServedAdPayload {
  return {
    id,
    campaignId: "camp-1",
    format: "text",
    headline: "Test Headline",
    body: "Test body",
    url: "https://example.com",
    displayTimeMs: MAX_AD_DURATION_MS,
    cpmRate: 5,
    deliveryToken: "jwt-token-123",
    impressionBeaconUrl: "https://track.example.com/impression",
    clickTrackingUrl: "https://track.example.com/click",
  }
}

// mock device + prefs lookup
function mockDeviceAndPrefs(opts: { deviceExists?: boolean; owned?: boolean } = {}) {
  const { deviceExists = true, owned = true } = opts
  mockSelectFrom.mockImplementation((table: unknown) => {
    if (table === devices) {
      return {
        where: vi.fn().mockResolvedValue(
          deviceExists
            ? [
                {
                  id: TEST_DEVICE_ID,
                  userId: owned ? TEST_USER_ID : "other-user",
                  os: "darwin",
                  ideType: "terminal",
                },
              ]
            : []
        ),
      }
    }
    if (table === preferences) {
      return { where: vi.fn().mockResolvedValue([]) }
    }
    return { where: vi.fn().mockResolvedValue([]) }
  })
}

describe("ads route handlers", () => {
  beforeAll(async () => {
    validToken = await signAccessToken(
      { sub: TEST_USER_ID, github_login: "testuser" },
      process.env["JWT_SECRET"] as string
    )
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchServedAds.mockResolvedValue([])
  })

  // ── GET /ads/next ─────────────────────────────────────────────────────────

  describe("GET /ads/next", () => {
    it("returns 204 when no ads available", async () => {
      mockDeviceAndPrefs()
      mockFetchServedAds.mockResolvedValue([])

      const res = await request(app)
        .get("/ads/next")
        .query({ deviceId: TEST_DEVICE_ID, surface: "terminal-tv" })
        .set("Authorization", `Bearer ${validToken}`)

      expect(res.status).toBe(204)
      expect(res.body).toEqual({})
      expect(res.headers["cache-control"]).toBe("private, no-store")
    })

    it("returns 200 with snake_case single ad", async () => {
      mockDeviceAndPrefs()
      mockFetchServedAds.mockResolvedValue([fakeServedAd("ad-1")])

      const res = await request(app)
        .get("/ads/next")
        .query({ deviceId: TEST_DEVICE_ID, surface: "terminal-tv" })
        .set("Authorization", `Bearer ${validToken}`)

      expect(res.status).toBe(200)
      expect(res.body.ad).toBeDefined()
      expect(res.body.ad.id).toBe("ad-1")
      expect(res.body.ad.campaign_id).toBe("camp-1")
      expect(res.body.ad.display_time_ms).toBe(MAX_AD_DURATION_MS)
      expect(res.body.ad.delivery_token).toBe("jwt-token-123")
      expect(res.body.ad.impression_beacon_url).toBe("https://track.example.com/impression")
      expect(res.body.ad.click_tracking_url).toBe("https://track.example.com/click")
      expect(res.headers["cache-control"]).toBe("private, no-store")
    })

    it("returns 400 for missing deviceId", async () => {
      const res = await request(app)
        .get("/ads/next")
        .query({ surface: "terminal-tv" })
        .set("Authorization", `Bearer ${validToken}`)

      expect(res.status).toBe(400)
    })

    it("returns 400 for invalid surface", async () => {
      const res = await request(app)
        .get("/ads/next")
        .query({ deviceId: TEST_DEVICE_ID, surface: "invalid" })
        .set("Authorization", `Bearer ${validToken}`)

      expect(res.status).toBe(400)
    })

    it("returns 404 when device not found", async () => {
      mockDeviceAndPrefs({ deviceExists: false })

      const res = await request(app)
        .get("/ads/next")
        .query({ deviceId: TEST_DEVICE_ID, surface: "terminal-tv" })
        .set("Authorization", `Bearer ${validToken}`)

      expect(res.status).toBe(404)
    })

    it("returns 403 when device not owned", async () => {
      mockDeviceAndPrefs({ owned: false })

      const res = await request(app)
        .get("/ads/next")
        .query({ deviceId: TEST_DEVICE_ID, surface: "terminal-tv" })
        .set("Authorization", `Bearer ${validToken}`)

      expect(res.status).toBe(403)
    })

    it("serves ad when enabledSurfaces is empty array (treats empty as all-enabled)", async () => {
      // empty array must not block serving — semantically identical to no prefs row
      mockSelectFrom.mockImplementation((table: unknown) => {
        if (table === devices) {
          return {
            where: vi
              .fn()
              .mockResolvedValue([
                { id: TEST_DEVICE_ID, userId: TEST_USER_ID, os: "darwin", ideType: "terminal" },
              ]),
          }
        }
        if (table === preferences) {
          return {
            where: vi.fn().mockResolvedValue([
              {
                blockedCategories: [],
                enabledSurfaces: [],
                maxPerHour: 8,
                maxPerDay: 60,
                quietHoursStart: null,
                quietHoursEnd: null,
                tzOffsetMinutes: 0,
              },
            ]),
          }
        }
        return { where: vi.fn().mockResolvedValue([]) }
      })
      mockFetchServedAds.mockResolvedValue([fakeServedAd("ad-empty-surfaces")])

      const res = await request(app)
        .get("/ads/next")
        .query({ deviceId: TEST_DEVICE_ID, surface: "terminal-tv" })
        .set("Authorization", `Bearer ${validToken}`)

      expect(mockFetchServedAds).toHaveBeenCalledOnce()
      const passedRequest = mockFetchServedAds.mock.calls[0]?.[0]
      expect(passedRequest?.enabledSurfaces).toEqual(Object.values(AdSurface))
      expect(res.status).toBe(200)
      expect(res.body.ad.id).toBe("ad-empty-surfaces")
    })
  })

  // ── GET /ads/batch ────────────────────────────────────────────────────────

  describe("GET /ads/batch", () => {
    it("returns 204 when no ads available", async () => {
      mockDeviceAndPrefs()

      const res = await request(app)
        .get("/ads/batch")
        .query({ deviceId: TEST_DEVICE_ID, surface: "terminal-tv" })
        .set("Authorization", `Bearer ${validToken}`)

      expect(res.status).toBe(204)
      expect(res.headers["cache-control"]).toBe("private, no-store")
    })

    it("returns 200 with snake_case ads array", async () => {
      mockDeviceAndPrefs()
      mockFetchServedAds.mockResolvedValue([fakeServedAd("ad-1"), fakeServedAd("ad-2")])

      const res = await request(app)
        .get("/ads/batch")
        .query({ deviceId: TEST_DEVICE_ID, surface: "terminal-tv", count: 2 })
        .set("Authorization", `Bearer ${validToken}`)

      expect(res.status).toBe(200)
      expect(res.body.ads).toHaveLength(2)
      expect(res.body.ads[0].campaign_id).toBe("camp-1")
      expect(res.body.ads[0].impression_beacon_url).toBe("https://track.example.com/impression")
    })

    it("returns 400 for invalid count", async () => {
      const res = await request(app)
        .get("/ads/batch")
        .query({ deviceId: TEST_DEVICE_ID, surface: "terminal-tv", count: "abc" })
        .set("Authorization", `Bearer ${validToken}`)

      expect(res.status).toBe(400)
    })

    it("clamps count to 10", async () => {
      mockDeviceAndPrefs()
      mockFetchServedAds.mockResolvedValue([])

      await request(app)
        .get("/ads/batch")
        .query({ deviceId: TEST_DEVICE_ID, surface: "terminal-tv", count: 50 })
        .set("Authorization", `Bearer ${validToken}`)

      const passedRequest = mockFetchServedAds.mock.calls[0]?.[0]
      expect(passedRequest?.count).toBeLessThanOrEqual(10)
    })
  })

  // ── POST /ads/next (backward compat) ──────────────────────────────────────

  describe("POST /ads/next (backward compat)", () => {
    it("returns 200 with { ads: [] } when empty (not 204)", async () => {
      mockDeviceAndPrefs()
      mockFetchServedAds.mockResolvedValue([])

      const res = await request(app)
        .post("/ads/next")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ deviceId: TEST_DEVICE_ID, surface: "terminal-tv" })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ ads: [] })
    })

    it("returns camelCase fields (not snake_case)", async () => {
      mockDeviceAndPrefs()
      mockFetchServedAds.mockResolvedValue([fakeServedAd("ad-1")])

      const res = await request(app)
        .post("/ads/next")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ deviceId: TEST_DEVICE_ID, surface: "terminal-tv" })

      expect(res.status).toBe(200)
      expect(res.body.ads).toHaveLength(1)
      // camelCase — NOT snake_case
      expect(res.body.ads[0].campaignId).toBe("camp-1")
      expect(res.body.ads[0].displayTimeMs).toBe(MAX_AD_DURATION_MS)
      expect(res.body.ads[0].deliveryToken).toBe("jwt-token-123")
      // beacon URLs present as camelCase
      expect(res.body.ads[0].impressionBeaconUrl).toBe("https://track.example.com/impression")
      expect(res.body.ads[0].clickTrackingUrl).toBe("https://track.example.com/click")
    })

    it("accepts count up to 10", async () => {
      mockDeviceAndPrefs()
      mockFetchServedAds.mockResolvedValue([])

      const res = await request(app)
        .post("/ads/next")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ deviceId: TEST_DEVICE_ID, surface: "terminal-tv", count: 10 })

      expect(res.status).toBe(200)
      const passedRequest = mockFetchServedAds.mock.calls[0]?.[0]
      expect(passedRequest?.count).toBe(10)
    })
  })
})

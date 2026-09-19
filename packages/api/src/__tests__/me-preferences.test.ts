import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

process.env["JWT_SECRET"] = "test-secret-that-is-long-enough-for-hs256-signing-purposes"
process.env["ALLOWED_ORIGINS"] = "http://localhost:3000"

const mockInsertReturning = vi.fn().mockResolvedValue([])
const mockValues = vi.fn().mockReturnValue({
  onConflictDoUpdate: vi.fn().mockReturnValue({
    returning: mockInsertReturning,
  }),
})
const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

vi.mock("../db/index.js", () => ({
  getDb: vi.fn(() => ({
    insert: mockInsert,
  })),
}))

vi.mock("../lib/redis.js", () => ({
  getRedis: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    pipeline: () => ({ get: vi.fn(), exec: vi.fn().mockResolvedValue([null, null]) }),
  })),
}))

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

const TEST_USER_ID = "00000000-1111-2222-3333-444444444444"
let token: string

beforeAll(async () => {
  token = await signAccessToken(
    { sub: TEST_USER_ID, github_login: "testuser" },
    process.env["JWT_SECRET"] as string
  )
})

beforeEach(() => {
  vi.clearAllMocks()
  mockInsertReturning.mockResolvedValue([])
})

describe("PUT /me/preferences", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).put("/me/preferences").send({ blockedCategories: [] })
    expect(res.status).toBe(401)
  })

  it("upserts blockedCategories and returns the full row", async () => {
    mockInsertReturning.mockResolvedValueOnce([
      {
        blockedCategories: ["developer-recruiting"],
        enabledSurfaces: ["terminal-tv"],
        maxPerHour: 8,
        maxPerDay: 60,
        quietHoursStart: null,
        quietHoursEnd: null,
        tzOffsetMinutes: 0,
        idleSensitivityMs: 10000,
      },
    ])

    const res = await request(app)
      .put("/me/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ blockedCategories: ["developer-recruiting"] })

    expect(res.status).toBe(200)
    expect(res.body.preferences.blockedCategories).toEqual(["developer-recruiting"])
    expect(res.body.preferences.maxPerHour).toBe(8)
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ blockedCategories: ["developer-recruiting"] })
    )
  })

  it("rejects an unknown category value", async () => {
    const res = await request(app)
      .put("/me/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ blockedCategories: ["not-a-real-category"] })

    expect(res.status).toBe(400)
  })

  it("rejects unknown top-level fields", async () => {
    const res = await request(app)
      .put("/me/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ blockedCategories: [], somethingElse: true })

    expect(res.status).toBe(400)
  })

  it("accepts valid tzOffsetMinutes", async () => {
    mockInsertReturning.mockResolvedValueOnce([
      {
        blockedCategories: [],
        enabledSurfaces: [],
        maxPerHour: 8,
        maxPerDay: 60,
        quietHoursStart: null,
        quietHoursEnd: null,
        tzOffsetMinutes: -330,
        idleSensitivityMs: 10000,
      },
    ])

    const res = await request(app)
      .put("/me/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ tzOffsetMinutes: -330 })

    expect(res.status).toBe(200)
    expect(res.body.preferences.tzOffsetMinutes).toBe(-330)
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ tzOffsetMinutes: -330 }))
  })

  it("rejects out-of-range tzOffsetMinutes", async () => {
    const res = await request(app)
      .put("/me/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ tzOffsetMinutes: 9999 })

    expect(res.status).toBe(400)
  })

  it("returns 500 when the upsert returns no row", async () => {
    const res = await request(app)
      .put("/me/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ blockedCategories: [] })

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: "internal_error" })
  })
})

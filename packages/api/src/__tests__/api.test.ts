import { describe, it, expect } from "vitest"
import request from "supertest"
import { app } from "../app.js"

describe("GET /health", () => {
  it("returns health response with components", async () => {
    const res = await request(app).get("/health")
    expect([200, 503]).toContain(res.status)
    expect(res.body).toHaveProperty("status")
    expect(res.body).toHaveProperty("uptime")
    expect(res.body).toHaveProperty("components")
  })

  it("is not behind the global rate limiter", async () => {
    const res = await request(app).get("/health")
    expect(res.headers).not.toHaveProperty("x-ratelimit-limit")
  })
})

describe("security headers (helmet)", () => {
  it("sets X-Content-Type-Options", async () => {
    const res = await request(app).get("/health")
    expect(res.headers["x-content-type-options"]).toBe("nosniff")
  })

  it("sets X-Frame-Options", async () => {
    const res = await request(app).get("/health")
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN")
  })

  it("sets Content-Security-Policy", async () => {
    const res = await request(app).get("/health")
    expect(res.headers["content-security-policy"]).toBeDefined()
  })

  it("sets Strict-Transport-Security", async () => {
    const res = await request(app).get("/health")
    expect(res.headers["strict-transport-security"]).toBeDefined()
  })
})

describe("CORS", () => {
  it("allows requests from configured origins", async () => {
    const res = await request(app)
      .options("/health")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET")
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000")
    expect(res.headers["access-control-allow-credentials"]).toBe("true")
  })

  it("blocks requests from unconfigured origins", async () => {
    const res = await request(app).get("/health").set("Origin", "https://evil.com")
    expect(res.headers["access-control-allow-origin"]).toBeUndefined()
  })
})

describe("GET /me", () => {
  it("returns 401 without auth token", async () => {
    const res = await request(app).get("/me")
    expect(res.status).toBe(401)
    expect(res.body.error).toBe("missing_token")
  })

  it("returns 401 with invalid token", async () => {
    const res = await request(app).get("/me").set("Authorization", "Bearer invalid-token")
    expect(res.status).toBe(401)
    expect(res.body.error).toBe("invalid_token")
  })
})

describe("POST /auth/exchange", () => {
  it("returns 400 without code", async () => {
    const res = await request(app).post("/auth/exchange").send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("missing_code")
  })

  it("returns 401 with invalid code", async () => {
    const res = await request(app).post("/auth/exchange").send({ code: "nonexistent" })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe("invalid_or_expired_code")
  })
})

describe("POST /auth/refresh", () => {
  it("returns 401 without refresh token", async () => {
    const res = await request(app).post("/auth/refresh").send({})
    expect(res.status).toBe(401)
    expect(res.body.error).toBe("missing_refresh_token")
  })
})

// ── ad serving endpoints ────────────────────────────────────────────────────

describe("GET /ads/next", () => {
  it("returns 401 without auth token", async () => {
    const res = await request(app).get("/ads/next")
    expect(res.status).toBe(401)
    expect(res.body.error).toBe("missing_token")
  })

  it("returns 401 with invalid token", async () => {
    const res = await request(app)
      .get("/ads/next")
      .query({ deviceId: "00000000-0000-0000-0000-000000000000", surface: "terminal-tv" })
      .set("Authorization", "Bearer invalid-token")
    expect(res.status).toBe(401)
  })
})

describe("GET /ads/batch", () => {
  it("returns 401 without auth token", async () => {
    const res = await request(app).get("/ads/batch")
    expect(res.status).toBe(401)
    expect(res.body.error).toBe("missing_token")
  })

  it("returns 401 with invalid token", async () => {
    const res = await request(app)
      .get("/ads/batch")
      .query({ deviceId: "00000000-0000-0000-0000-000000000000", surface: "terminal-tv", count: 3 })
      .set("Authorization", "Bearer invalid-token")
    expect(res.status).toBe(401)
  })
})

describe("POST /ads/next", () => {
  it("returns 401 without auth token", async () => {
    const res = await request(app).post("/ads/next").send({})
    expect(res.status).toBe(401)
    expect(res.body.error).toBe("missing_token")
  })

  it("returns 401 with invalid token", async () => {
    const res = await request(app)
      .post("/ads/next")
      .set("Authorization", "Bearer invalid-token")
      .send({ deviceId: "00000000-0000-0000-0000-000000000000", surface: "terminal-tv" })
    expect(res.status).toBe(401)
  })
})

describe("POST /impressions", () => {
  it("returns 401 without auth token", async () => {
    const res = await request(app).post("/impressions").send({})
    expect(res.status).toBe(401)
    expect(res.body.error).toBe("missing_token")
  })

  it("returns 401 with invalid token", async () => {
    const res = await request(app)
      .post("/impressions")
      .set("Authorization", "Bearer invalid-token")
      .send({ deliveryToken: "jwt" })
    expect(res.status).toBe(401)
  })
})

describe("POST /clicks", () => {
  it("returns 401 without auth token", async () => {
    const res = await request(app).post("/clicks").send({})
    expect(res.status).toBe(401)
    expect(res.body.error).toBe("missing_token")
  })

  it("returns 401 with invalid token", async () => {
    const res = await request(app)
      .post("/clicks")
      .set("Authorization", "Bearer invalid-token")
      .send({ impressionId: "00000000-0000-0000-0000-000000000000" })
    expect(res.status).toBe(401)
  })
})

import { describe, it, expect } from "vitest"
import request from "supertest"
import { app } from "../app.js"
import { getRedis } from "../lib/redis.js"

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

function extractState(setCookie: string | string[] | undefined): string {
  const first = Array.isArray(setCookie) ? setCookie[0] : setCookie
  const cookie = first ?? ""
  const m = /gh_oauth_state=([a-f0-9]{32})/.exec(cookie)
  if (!m?.[1]) throw new Error(`state cookie missing from: ${cookie}`)
  return m[1]
}

describe("GET /auth/github/redirect (cli_port)", () => {
  it("stores cli_port keyed by state when in range", async () => {
    const res = await request(app).get("/auth/github/redirect?cli_port=54321")
    expect(res.status).toBe(302)
    expect(res.headers["location"]).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize\?/)

    const state = extractState(res.headers["set-cookie"])
    const raw = await getRedis().get<string>(`auth:state:${state}`)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw as string)).toEqual({ cliPort: 54321 })

    await getRedis().del(`auth:state:${state}`)
  })

  it("ignores cli_port below range", async () => {
    const res = await request(app).get("/auth/github/redirect?cli_port=54320")
    const state = extractState(res.headers["set-cookie"])
    const raw = await getRedis().get<string>(`auth:state:${state}`)
    expect(raw).toBeNull()
  })

  it("ignores cli_port above range", async () => {
    const res = await request(app).get("/auth/github/redirect?cli_port=54331")
    const state = extractState(res.headers["set-cookie"])
    const raw = await getRedis().get<string>(`auth:state:${state}`)
    expect(raw).toBeNull()
  })

  it("ignores non-numeric cli_port", async () => {
    const res = await request(app).get("/auth/github/redirect?cli_port=../../evil")
    const state = extractState(res.headers["set-cookie"])
    const raw = await getRedis().get<string>(`auth:state:${state}`)
    expect(raw).toBeNull()
  })
})

describe("GET /auth/github/callback (cli redirect)", () => {
  it("forwards access_denied to localhost:cli_port when state is known", async () => {
    // seed a valid state with cli_port
    const state = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    await getRedis().set(`auth:state:${state}`, JSON.stringify({ cliPort: 54322 }), { ex: 60 })

    const res = await request(app)
      .get(`/auth/github/callback?state=${state}&error=access_denied`)
      .set("Cookie", [`gh_oauth_state=${state}`])

    expect(res.status).toBe(302)
    expect(res.headers["location"]).toBe("http://localhost:54322/callback?error=access_denied")

    // state entry should be consumed
    const raw = await getRedis().get<string>(`auth:state:${state}`)
    expect(raw).toBeNull()
  })

  it("falls back to CLIENT_REDIRECT_URL when no cli_port in state", async () => {
    const state = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    // no redis entry for this state — i.e. regular web flow
    const res = await request(app)
      .get(`/auth/github/callback?state=${state}&error=access_denied`)
      .set("Cookie", [`gh_oauth_state=${state}`])

    expect(res.status).toBe(302)
    // should NOT be localhost
    expect(res.headers["location"]).not.toMatch(/^http:\/\/localhost:\d+\/callback/)
    expect(res.headers["location"]).toContain("error=access_denied")
  })

  it("returns invalid_state via web redirect when state doesn't match cookie", async () => {
    const res = await request(app).get("/auth/github/callback?state=abc&error=access_denied")
    expect(res.status).toBe(302)
    expect(res.headers["location"]).toContain("error=invalid_state")
    // invalid state is rejected before we look up cli_port, so we never redirect
    // to a CLI port — only to CLIENT_REDIRECT_URL (whatever host that is)
    expect(res.headers["location"]).not.toContain(":54321/callback")
    expect(res.headers["location"]).not.toContain(":54322/callback")
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

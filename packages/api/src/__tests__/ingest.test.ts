import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../db/index.js", () => ({ getDb: vi.fn() }))
vi.mock("../lib/redis.js", () => ({ getRedis: vi.fn() }))
vi.mock("../lib/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock("../config/env.js", () => ({
  env: { jwtSecret: "test-secret", allowedOrigins: ["*"] },
}))

import { SignJWT } from "jose"
import {
  peekDeliveryToken,
  verifyDeliveryTokenForIngest,
  verifyDeliveryTokenForClick,
} from "../lib/ad-delivery.js"
import { getRedis } from "../lib/redis.js"

function makeToken(opts: {
  userId: string
  deviceId: string
  creativeId: string
  surface?: string
  jti: string
  issuedAtSecondsAgo?: number
  expSeconds?: number
}): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000) - (opts.issuedAtSecondsAgo ?? 0)
  const exp = issuedAt + (opts.expSeconds ?? 600)
  return new SignJWT({
    device_id: opts.deviceId,
    creative_id: opts.creativeId,
    surface: opts.surface ?? "terminal-tv",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(opts.userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(exp)
    .setIssuer("devdrip")
    .setAudience("devdrip:ad-delivery")
    .setJti(opts.jti)
    .sign(new TextEncoder().encode("test-secret"))
}

describe("verifyDeliveryTokenForIngest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("succeeds with fresh token + nonce present (graceAccept=false)", async () => {
    ;(getRedis as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      getdel: vi.fn().mockResolvedValue("1"),
    })
    const token = await makeToken({
      userId: "u1",
      deviceId: "d1",
      creativeId: "c1",
      jti: "jti-1",
    })
    const res = await verifyDeliveryTokenForIngest(token, "u1")
    expect(res.graceAccept).toBe(false)
    expect(res.claims.jti).toBe("jti-1")
  })

  it("grace-accepts 1h-expired token with nonce missing", async () => {
    ;(getRedis as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      getdel: vi.fn().mockResolvedValue(null),
    })
    const token = await makeToken({
      userId: "u1",
      deviceId: "d1",
      creativeId: "c1",
      jti: "jti-2",
      issuedAtSecondsAgo: 3600,
      expSeconds: 600, // exp was 600s from iat → expired
    })
    const res = await verifyDeliveryTokenForIngest(token, "u1")
    expect(res.graceAccept).toBe(true)
  })

  it("rejects tokens older than 24h", async () => {
    ;(getRedis as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      getdel: vi.fn().mockResolvedValue(null),
    })
    const token = await makeToken({
      userId: "u1",
      deviceId: "d1",
      creativeId: "c1",
      jti: "jti-3",
      issuedAtSecondsAgo: 25 * 3600,
      expSeconds: 600,
    })
    await expect(verifyDeliveryTokenForIngest(token, "u1")).rejects.toThrow(
      /delivery_token_too_old/
    )
  })

  it("rejects when userId doesn't match", async () => {
    ;(getRedis as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      getdel: vi.fn().mockResolvedValue("1"),
    })
    const token = await makeToken({
      userId: "u1",
      deviceId: "d1",
      creativeId: "c1",
      jti: "jti-4",
    })
    await expect(verifyDeliveryTokenForIngest(token, "OTHER")).rejects.toThrow(/delivery_not_owned/)
  })
})

describe("peekDeliveryToken", () => {
  it("returns claims without touching redis", async () => {
    const token = await makeToken({
      userId: "u1",
      deviceId: "d1",
      creativeId: "c1",
      jti: "jti-5",
      issuedAtSecondsAgo: 0,
    })
    const claims = await peekDeliveryToken(token)
    expect(claims.deviceId).toBe("d1")
    expect(claims.jti).toBe("jti-5")
    expect((getRedis as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0)
  })
})

describe("verifyDeliveryTokenForClick", () => {
  it("accepts without consuming nonce", async () => {
    ;(getRedis as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      getdel: vi.fn(),
    })
    const token = await makeToken({
      userId: "u1",
      deviceId: "d1",
      creativeId: "c1",
      jti: "jti-6",
    })
    const claims = await verifyDeliveryTokenForClick(token, "u1")
    expect(claims.jti).toBe("jti-6")
    expect((getRedis as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0)
  })
})

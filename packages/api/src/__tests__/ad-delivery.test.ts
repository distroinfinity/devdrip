import { beforeEach, describe, expect, it, vi } from "vitest"
import { AdSurface } from "@devdrip/shared"

vi.mock("../lib/redis.js", () => ({
  getRedis: vi.fn(),
}))

import { getRedis } from "../lib/redis.js"
import { consumeDeliveryToken, issueDeliveryToken } from "../lib/ad-delivery.js"

describe("ad delivery tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("issues and consumes a delivery token once", async () => {
    const store = new Map<string, string>()

    vi.mocked(getRedis).mockReturnValue({
      set: vi.fn(async (key: string, value: string) => {
        if (store.has(key)) return null
        store.set(key, value)
        return "OK"
      }),
      getdel: vi.fn(async (key: string) => {
        const value = store.get(key) ?? null
        store.delete(key)
        return value
      }),
    } as unknown as ReturnType<typeof getRedis>)

    const token = await issueDeliveryToken({
      userId: "user-1",
      deviceId: "device-1",
      creativeId: "creative-1",
      surface: AdSurface.TerminalTv,
    })

    const claims = await consumeDeliveryToken(token)
    expect(claims).toMatchObject({
      userId: "user-1",
      deviceId: "device-1",
      creativeId: "creative-1",
      surface: AdSurface.TerminalTv,
    })

    await expect(consumeDeliveryToken(token)).rejects.toThrow("invalid_or_expired_delivery_token")
  })

  it("does not consume the token when the wrong user presents it", async () => {
    const store = new Map<string, string>()

    vi.mocked(getRedis).mockReturnValue({
      set: vi.fn(async (key: string, value: string) => {
        if (store.has(key)) return null
        store.set(key, value)
        return "OK"
      }),
      getdel: vi.fn(async (key: string) => {
        const value = store.get(key) ?? null
        store.delete(key)
        return value
      }),
    } as unknown as ReturnType<typeof getRedis>)

    const token = await issueDeliveryToken({
      userId: "user-1",
      deviceId: "device-1",
      creativeId: "creative-1",
      surface: AdSurface.TerminalTv,
    })

    await expect(consumeDeliveryToken(token, "user-2")).rejects.toThrow("delivery_not_owned")

    const claims = await consumeDeliveryToken(token, "user-1")
    expect(claims.userId).toBe("user-1")
  })
})

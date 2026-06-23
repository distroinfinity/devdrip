import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const execute = vi.fn()
vi.mock("../../db/index.js", () => ({ getDb: () => ({ execute }) }))
vi.mock("../redis.js", () => ({ getRedis: () => ({ ping: vi.fn().mockResolvedValue("PONG") }) }))

describe("probeDb caching", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-23T00:00:00Z"))
    execute.mockReset()
    execute.mockResolvedValue([{ ok: 1 }])
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it("caches a successful probe within the TTL", async () => {
    vi.resetModules()
    const { probeDb } = await import("../probes.js")
    await probeDb()
    await probeDb()
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it("re-probes after the TTL expires", async () => {
    vi.resetModules()
    const { probeDb } = await import("../probes.js")
    await probeDb()
    vi.setSystemTime(new Date("2026-06-23T00:00:11Z"))
    await probeDb()
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it("does not cache a failed probe", async () => {
    vi.resetModules()
    const { probeDb } = await import("../probes.js")
    execute.mockRejectedValueOnce(new Error("db down"))
    await expect(probeDb()).rejects.toThrow()
    await probeDb()
    expect(execute).toHaveBeenCalledTimes(2)
  })
})

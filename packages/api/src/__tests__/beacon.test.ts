import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// mock logger
vi.mock("../lib/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { fireBeacon } from "../lib/beacon.js"
import { logger } from "../lib/logger.js"

describe("fireBeacon", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("fires a GET request to the given URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = mockFetch

    await fireBeacon("https://srv.carbonads.net/ads/viewable/x/abc123")

    expect(mockFetch).toHaveBeenCalledWith(
      "https://srv.carbonads.net/ads/viewable/x/abc123",
      expect.objectContaining({ method: "GET" })
    )
  })

  it("does not throw on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down"))

    await expect(fireBeacon("https://example.com/beacon")).resolves.toBeUndefined()
    expect(vi.mocked(logger.warn)).toHaveBeenCalled()
  })

  it("logs warning on non-OK response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })

    await expect(fireBeacon("https://example.com/beacon")).resolves.toBeUndefined()
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500 }),
      "beacon returned non-OK status"
    )
  })
})

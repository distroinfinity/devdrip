import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

let tempHome: string
let warnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "devdrip-ad-cache-test-"))
  process.env["HOME"] = tempHome
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true })
  warnSpy.mockRestore()
})

function batchAd(id: string) {
  return {
    id,
    campaign_id: `camp-${id}`,
    format: "text" as const,
    headline: `Headline ${id}`,
    body: `Body ${id}`,
    url: `https://example.com/${id}`,
    display_time_ms: 4000,
    delivery_token: `tok-${id}`,
    impression_beacon_url: null,
    click_tracking_url: null,
  }
}

function makeApiFetch(ads: ReturnType<typeof batchAd>[]) {
  return vi.fn(async () => ({ ads }))
}

describe("ad-cache", () => {
  it("populates from /ads/batch on refresh", async () => {
    const fetchMock = makeApiFetch([batchAd("a"), batchAd("b"), batchAd("c")])
    const { openAdCache, adCachePath } = await import("../ad-cache.js")
    const c = openAdCache({ apiFetch: fetchMock as never, deviceId: "dev", surface: "terminal-tv" })
    await c.refreshNow()

    expect(fetchMock).toHaveBeenCalledWith(
      "/ads/batch",
      expect.objectContaining({ query: { deviceId: "dev", surface: "terminal-tv", count: 10 } })
    )
    expect(c.count()).toBe(3)
    const ad = c.next()
    expect(ad?.id).toBe("a")
    expect(ad?.cacheSource).toBe("api")

    const persisted = JSON.parse(readFileSync(adCachePath(), "utf8"))
    expect(persisted.version).toBe(1)
    expect(persisted.ads.length).toBe(2) // one consumed
  })

  it("falls back to demo ads when the backend is unreachable and no prior cache", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network unreachable")
    })
    const { openAdCache } = await import("../ad-cache.js")
    const c = openAdCache({ apiFetch: fetchMock as never, deviceId: "dev", surface: "terminal-tv" })
    await c.refreshNow()

    expect(c.count()).toBeGreaterThan(0)
    const ad = c.next()
    expect(ad?.cacheSource).toBe("demo")
    expect(warnSpy).toHaveBeenCalled()
  })

  it("keeps prior cache on 204-empty response", async () => {
    const fetchMock = vi.fn(async () => ({})) // no `ads` key = treated as empty
    const { openAdCache } = await import("../ad-cache.js")
    const c = openAdCache({ apiFetch: fetchMock as never, deviceId: "dev", surface: "terminal-tv" })
    await c.refreshNow() // first call: fills with demos since prior was empty
    expect(c.count()).toBeGreaterThan(0)
    const firstCount = c.count()

    // second refresh (still empty) — shouldn't blow away the demo cache
    await c.refreshNow()
    expect(c.count()).toBe(firstCount - 0) // no change, demos still served
  })

  it("triggers background refresh when ads drop below REFRESH_THRESHOLD", async () => {
    const fetchMock = makeApiFetch([batchAd("a"), batchAd("b"), batchAd("c"), batchAd("d")])
    const { openAdCache } = await import("../ad-cache.js")
    const c = openAdCache({ apiFetch: fetchMock as never, deviceId: "dev", surface: "terminal-tv" })
    await c.refreshNow()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // consume two — now 2 left, below threshold of 3 → next() schedules refresh
    c.next()
    c.next()
    // wait for the scheduled refresh microtask chain to settle
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("single-flight: concurrent refreshNow calls share one network request", async () => {
    let resolve!: (v: { ads: ReturnType<typeof batchAd>[] }) => void
    const gate = new Promise<{ ads: ReturnType<typeof batchAd>[] }>((r) => {
      resolve = r
    })
    const fetchMock = vi.fn(async () => gate)

    const { openAdCache } = await import("../ad-cache.js")
    const c = openAdCache({ apiFetch: fetchMock as never, deviceId: "dev", surface: "terminal-tv" })

    // warm-up triggered one fetch already from constructor; ignore it by
    // waiting for it to settle via the same gate (it will share the promise).
    const p1 = c.refreshNow()
    const p2 = c.refreshNow()
    expect(fetchMock).toHaveBeenCalledTimes(1) // still only one fetch
    resolve({ ads: [batchAd("a")] })
    await Promise.all([p1, p2])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("treats expired cache as empty and triggers refresh", async () => {
    let mockNow = 1_000_000
    const fetchMock = makeApiFetch([batchAd("a")])
    const { openAdCache } = await import("../ad-cache.js")
    const c = openAdCache({
      apiFetch: fetchMock as never,
      deviceId: "dev",
      surface: "terminal-tv",
      now: () => mockNow,
    })
    await c.refreshNow()
    expect(c.count()).toBe(1)

    // advance 10 minutes — cache TTL is 8m
    mockNow += 10 * 60 * 1000
    expect(c.count()).toBe(0)
    const ad = c.next()
    expect(ad).toBeNull()
  })

  it("survives a partial/corrupt cache file on open", async () => {
    // seed a garbage cache file
    const { adCachePath } = await import("../ad-cache.js")
    const { writeFileSync, mkdirSync } = await import("node:fs")
    const { configDir } = await import("../config.js")
    mkdirSync(configDir(), { recursive: true, mode: 0o700 })
    writeFileSync(adCachePath(), "{ this is not json")

    const fetchMock = makeApiFetch([batchAd("a")])
    const { openAdCache } = await import("../ad-cache.js")
    const c = openAdCache({ apiFetch: fetchMock as never, deviceId: "dev", surface: "terminal-tv" })
    await c.refreshNow()
    expect(c.count()).toBe(1)
    expect(existsSync(adCachePath())).toBe(true)
  })
})

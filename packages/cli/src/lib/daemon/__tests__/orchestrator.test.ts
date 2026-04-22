import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { defaultDevdripPreferences, type DevdripPreferences } from "@devdrip/shared"
import type { CachedAd } from "../../ad-cache.js"
import type { LocalImpression } from "../../ledger.js"
import type { Orchestrator } from "../orchestrator.js"

// tests exercise pure state-machine behavior — disable warmup / quiet hours
// so they don't interfere. suppression is covered by a dedicated test file.
function testPreferences(): DevdripPreferences {
  return { ...defaultDevdripPreferences(), sessionWarmupMs: 0, nightMode: false }
}

const ad: CachedAd = {
  id: "ad-1",
  campaignId: "camp-1",
  format: "text",
  headline: "H",
  body: "B",
  url: "https://x",
  displayTimeMs: 8000,
  deliveryToken: "tok",
  impressionBeaconUrl: undefined,
  clickTrackingUrl: undefined,
  cacheSource: "api",
}

const demo: CachedAd = { ...ad, id: "demo-1", cacheSource: "demo" }

function makeDeps() {
  const ledgerWrites: LocalImpression[] = []
  const displayCalls: { tty: string | null; adId: string }[] = []
  const vanishCalls: number[] = []
  const logs: { level: string; msg: string }[] = []

  let queued: CachedAd | null = ad
  const adCache = {
    next: vi.fn(() => {
      const r = queued
      queued = null
      return r
    }),
    count: vi.fn(() => (queued ? 1 : 0)),
    refreshNow: vi.fn(async () => {}),
    close: vi.fn(),
    queue: (a: CachedAd | null) => {
      queued = a
    },
  }
  const ledger = {
    record: vi.fn((imp: LocalImpression) => {
      ledgerWrites.push(imp)
    }),
    listUnsynced: vi.fn(() => []),
    markSynced: vi.fn(),
    unsyncedCount: vi.fn(() => 0),
    close: vi.fn(),
  }
  const display = {
    show: vi.fn((tty: string | null, a: CachedAd, _ctx: unknown) => {
      displayCalls.push({ tty, adId: a.id })
      return {
        vanish: () => {
          vanishCalls.push(Date.now())
          return { latencyMs: 0 }
        },
      }
    }),
  }
  const keyCaptureCalls: Array<{ method: "start" | "stop"; tty?: string }> = []
  const keyCapture = {
    start: vi.fn((tty: string) => {
      keyCaptureCalls.push({ method: "start", tty })
    }),
    stop: vi.fn(() => {
      keyCaptureCalls.push({ method: "stop" })
    }),
  }
  const openedUrls: string[] = []
  const openUrl = vi.fn((u: string) => {
    openedUrls.push(u)
  })
  const firedBeacons: string[] = []
  const fireBeacon = vi.fn((u: string) => {
    firedBeacons.push(u)
  })
  const log = {
    info: (msg: string) => logs.push({ level: "info", msg }),
    warn: (msg: string) => logs.push({ level: "warn", msg }),
    error: (msg: string) => logs.push({ level: "error", msg }),
    debug: (msg: string) => logs.push({ level: "debug", msg }),
  }

  return {
    adCache,
    ledger,
    display,
    keyCapture,
    openUrl,
    fireBeacon,
    log,
    ledgerWrites,
    displayCalls,
    vanishCalls,
    keyCaptureCalls,
    openedUrls,
    firedBeacons,
    logs,
  }
}

async function createOrch(
  d: ReturnType<typeof makeDeps>,
  prefs: DevdripPreferences = testPreferences()
): Promise<Orchestrator> {
  const { createOrchestrator } = await import("../orchestrator.js")
  return createOrchestrator({
    adCache: d.adCache as never,
    ledger: d.ledger as never,
    display: d.display as never,
    keyCapture: d.keyCapture as never,
    openUrl: d.openUrl,
    fireBeacon: d.fireBeacon,
    log: d.log,
    deviceId: "dev-1",
    preferences: prefs,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe("orchestrator", () => {
  it("enters SHOWING 3s after idle-start and writes completed impression on vanish", async () => {
    const d = makeDeps()
    const orch = await createOrch(d)

    orch.dispatch({ kind: "idle-start", tty: "/dev/ttys003", now: 0 })
    expect(d.displayCalls).toHaveLength(0)

    // advance past the 3s grace timer → display fires
    await vi.advanceTimersByTimeAsync(3000)
    expect(d.displayCalls).toEqual([{ tty: "/dev/ttys003", adId: "ad-1" }])

    // advance past the 8s vanish timer → ledger write
    await vi.advanceTimersByTimeAsync(8000)
    expect(d.vanishCalls).toHaveLength(1)
    expect(d.ledgerWrites).toHaveLength(1)
    expect(d.ledgerWrites[0]?.result).toBe("completed")
    expect(d.ledgerWrites[0]?.source).toBe("api")
  })

  it("cancels the grace timer when idle-end arrives during GRACE", async () => {
    const d = makeDeps()
    const orch = await createOrch(d)

    orch.dispatch({ kind: "idle-start", tty: "/dev/ttys003", now: 0 })
    await vi.advanceTimersByTimeAsync(1500)
    orch.dispatch({ kind: "idle-end", now: 1500 })
    await vi.advanceTimersByTimeAsync(5000)

    expect(d.displayCalls).toHaveLength(0)
    expect(d.ledgerWrites).toHaveLength(0)
  })

  it("records interrupted when Stop hook fires mid-ad", async () => {
    const d = makeDeps()
    const orch = await createOrch(d)

    orch.dispatch({ kind: "idle-start", tty: "/dev/ttys003", now: 0 })
    await vi.advanceTimersByTimeAsync(3000)
    await vi.advanceTimersByTimeAsync(2000) // ad showing for 2s
    orch.dispatch({ kind: "idle-end", now: 5000 })

    expect(d.vanishCalls).toHaveLength(1)
    expect(d.ledgerWrites).toHaveLength(1)
    expect(d.ledgerWrites[0]?.result).toBe("interrupted")
  })

  it("skips ledger write for demo ads", async () => {
    const d = makeDeps()
    d.adCache.queue(demo)
    const orch = await createOrch(d)

    orch.dispatch({ kind: "idle-start", tty: "/dev/ttys003", now: 0 })
    await vi.advanceTimersByTimeAsync(3000)
    await vi.advanceTimersByTimeAsync(8000)

    expect(d.displayCalls).toHaveLength(1) // demo still rendered
    expect(d.ledgerWrites).toHaveLength(0) // but no ledger row
    expect(d.logs.some((l) => l.msg.includes("demo"))).toBe(true)
  })

  it("returns to IDLE when the cache is empty at grace-elapsed", async () => {
    const d = makeDeps()
    d.adCache.queue(null)
    const orch = await createOrch(d)

    orch.dispatch({ kind: "idle-start", tty: "/dev/ttys003", now: 0 })
    await vi.advanceTimersByTimeAsync(3000)

    expect(d.displayCalls).toHaveLength(0)
    expect(d.ledgerWrites).toHaveLength(0)
  })

  it("recovers from display errors via a synthesized dismiss", async () => {
    const d = makeDeps()
    d.display.show = vi.fn(() => {
      throw new Error("tty gone")
    }) as never

    const orch = await createOrch(d)

    orch.dispatch({ kind: "idle-start", tty: "/dev/ttys003", now: 0 })
    await vi.advanceTimersByTimeAsync(3000)

    // display threw → orchestrator logs warn, synthesizes dismiss, returns to IDLE
    expect(d.logs.some((l) => l.level === "warn")).toBe(true)
    expect(orch.currentState().kind).toBe("IDLE")
  })

  it("adsShown counter increments on each vanish", async () => {
    const d = makeDeps()
    d.adCache.queue(ad)
    const orch = await createOrch(d)

    orch.dispatch({ kind: "idle-start", tty: "/dev/ttys003", now: 0 })
    await vi.advanceTimersByTimeAsync(3000)
    await vi.advanceTimersByTimeAsync(8000)

    expect(orch.adsShown()).toBe(1)
  })

  it("hooksReceived counts only socket-originated events (not internal timers)", async () => {
    const d = makeDeps()
    const orch = await createOrch(d)

    orch.dispatch({ kind: "idle-start", tty: "/dev/ttys003", now: 0 })
    orch.dispatch({ kind: "idle-end", now: 100 })
    orch.dispatch({ kind: "dismiss", now: 200 })
    // timer-fed events should NOT bump the counter
    orch.dispatch({ kind: "grace-elapsed", ad: null, now: 3000 })
    orch.dispatch({ kind: "vanish-elapsed", now: 9000 })

    expect(orch.hooksReceived()).toBe(3)
  })

  it("adsShown stays at 0 when tty is null (no ad actually rendered)", async () => {
    const d = makeDeps()
    const orch = await createOrch(d)

    orch.dispatch({ kind: "idle-start", tty: null, now: 0 })
    await vi.advanceTimersByTimeAsync(3000)
    // synthesized dismiss runs on the next microtask
    await Promise.resolve()

    expect(d.displayCalls).toHaveLength(0)
    expect(orch.adsShown()).toBe(0)
    expect(orch.currentState().kind).toBe("IDLE")
  })
})

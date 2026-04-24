import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { defaultDevdripPreferences, type DevdripPreferences } from "@devdrip/shared"
import type { CachedAd } from "../../ad-cache.js"
import type { LocalImpression } from "../../ledger.js"

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

function makeDeps() {
  const ledgerWrites: LocalImpression[] = []
  const displayCalls: { tty: string | null; adId: string }[] = []
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
      return { vanish: () => ({ latencyMs: 0 }), onResize: vi.fn(), flash: vi.fn() }
    }),
  }
  const keyCapture = {
    start: vi.fn(),
    stop: vi.fn(),
  }
  const openUrl = vi.fn()
  const fireBeacon = vi.fn()
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
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
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe("orchestrator preferences gating", () => {
  it("suppresses ads inside the configured quiet window", async () => {
    const d = makeDeps()
    const { createOrchestrator } = await import("../orchestrator.js")
    const prefs: DevdripPreferences = {
      ...defaultDevdripPreferences(),
      sessionWarmupMs: 0,
      quietHoursStart: 0,
      quietHoursEnd: 23, // cover 23 hours so any wall-clock hour is inside
      tzOffsetMinutes: 0,
    }
    const orch = createOrchestrator({
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

    orch.dispatch({ kind: "idle-start", tty: "/dev/ttys003", now: 0 })
    await vi.advanceTimersByTimeAsync(3100)
    expect(d.displayCalls).toHaveLength(0)
    expect(d.adCache.next).not.toHaveBeenCalled()
  })

  it("suppresses ads during the session warmup period", async () => {
    const d = makeDeps()
    const { createOrchestrator } = await import("../orchestrator.js")
    const prefs: DevdripPreferences = {
      ...defaultDevdripPreferences(),
      sessionWarmupMs: 60_000,
      nightMode: false,
      quietHoursStart: null,
      quietHoursEnd: null,
    }
    const orch = createOrchestrator({
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

    orch.dispatch({ kind: "idle-start", tty: "/dev/ttys003", now: 0 })
    // grace fires at 3s, still inside the 60s warmup → suppressed
    await vi.advanceTimersByTimeAsync(3100)
    expect(d.displayCalls).toHaveLength(0)
  })

  it("updatePreferences swaps the gate in place (warmup disabled after reload)", async () => {
    const d = makeDeps()
    const { createOrchestrator } = await import("../orchestrator.js")
    const prefs: DevdripPreferences = {
      ...defaultDevdripPreferences(),
      sessionWarmupMs: 60_000,
      nightMode: false,
      quietHoursStart: null,
      quietHoursEnd: null,
    }
    const orch = createOrchestrator({
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

    // disable warmup before the grace timer fires
    orch.updatePreferences({ ...prefs, sessionWarmupMs: 0 })

    orch.dispatch({ kind: "idle-start", tty: "/dev/ttys003", now: 0 })
    await vi.advanceTimersByTimeAsync(3100)
    expect(d.displayCalls).toEqual([{ tty: "/dev/ttys003", adId: "ad-1" }])
  })
})

import { describe, it, expect } from "vitest"
import { step, type State } from "../state-machine.js"
import type { CachedAd } from "../../ad-cache.js"

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

const demoAd: CachedAd = { ...ad, id: "demo-1", cacheSource: "demo" }

const CTX = { deviceId: "dev-1" }
const idle: State = { kind: "IDLE" }
const graceAt = (enteredAt: number): State => ({ kind: "GRACE", tty: "/dev/ttys003", enteredAt })
const showingAt = (shownAt: number, a = ad): State => ({
  kind: "SHOWING",
  tty: "/dev/ttys003",
  ad: a,
  shownAt,
})

describe("state-machine: IDLE transitions", () => {
  it("IDLE + idle-start → GRACE with startGraceTimer effect", () => {
    const r = step(idle, { kind: "idle-start", tty: "/dev/ttys003", now: 100 }, CTX)
    expect(r.state).toEqual({ kind: "GRACE", tty: "/dev/ttys003", enteredAt: 100 })
    expect(r.effects).toEqual([{ kind: "startGraceTimer", ms: 3000 }])
  })

  it("IDLE + idle-end → IDLE, no effects", () => {
    expect(step(idle, { kind: "idle-end", now: 1 }, CTX)).toEqual({ state: idle, effects: [] })
  })

  it("IDLE + dismiss → IDLE, no effects", () => {
    expect(step(idle, { kind: "dismiss", now: 1 }, CTX)).toEqual({ state: idle, effects: [] })
  })

  it("IDLE + grace-elapsed → IDLE (stale timer)", () => {
    expect(step(idle, { kind: "grace-elapsed", ad: null, now: 1 }, CTX)).toEqual({
      state: idle,
      effects: [],
    })
  })

  it("IDLE + vanish-elapsed → IDLE (stale timer)", () => {
    expect(step(idle, { kind: "vanish-elapsed", now: 1 }, CTX)).toEqual({
      state: idle,
      effects: [],
    })
  })
})

describe("state-machine: GRACE transitions", () => {
  it("GRACE + idle-start → GRACE (timer not restarted)", () => {
    const s = graceAt(100)
    const r = step(s, { kind: "idle-start", tty: "/dev/ttys003", now: 150 }, CTX)
    expect(r.state).toEqual(s)
    expect(r.effects).toEqual([])
  })

  it("GRACE + idle-end → IDLE with cancelGraceTimer effect", () => {
    const r = step(graceAt(100), { kind: "idle-end", now: 200 }, CTX)
    expect(r.state).toEqual(idle)
    expect(r.effects).toEqual([{ kind: "cancelGraceTimer" }])
  })

  it("GRACE + dismiss → IDLE with cancelGraceTimer effect", () => {
    const r = step(graceAt(100), { kind: "dismiss", now: 200 }, CTX)
    expect(r.state).toEqual(idle)
    expect(r.effects).toEqual([{ kind: "cancelGraceTimer" }])
  })

  it("GRACE + grace-elapsed with ad=null → IDLE, no effects", () => {
    const r = step(graceAt(100), { kind: "grace-elapsed", ad: null, now: 3100 }, CTX)
    expect(r.state).toEqual(idle)
    expect(r.effects).toEqual([])
  })

  it("GRACE + grace-elapsed with ad → SHOWING + displayAd + startVanishTimer", () => {
    const r = step(graceAt(100), { kind: "grace-elapsed", ad, now: 3100 }, CTX)
    expect(r.state).toEqual({ kind: "SHOWING", tty: "/dev/ttys003", ad, shownAt: 3100 })
    expect(r.effects).toEqual([
      { kind: "displayAd", tty: "/dev/ttys003", ad },
      { kind: "startVanishTimer", ms: 8000 },
    ])
  })

  it("clamps vanish timer to MAX_AD_DURATION_MS even when ad overrides higher", () => {
    const longAd: CachedAd = { ...ad, displayTimeMs: 20_000 }
    const r = step(graceAt(100), { kind: "grace-elapsed", ad: longAd, now: 3100 }, CTX)
    const vanishEffect = r.effects.find((e) => e.kind === "startVanishTimer")
    expect(vanishEffect).toEqual({ kind: "startVanishTimer", ms: 8000 })
  })

  it("uses the ad's shorter displayTimeMs when it's below the cap", () => {
    const shortAd: CachedAd = { ...ad, displayTimeMs: 4000 }
    const r = step(graceAt(100), { kind: "grace-elapsed", ad: shortAd, now: 3100 }, CTX)
    const vanishEffect = r.effects.find((e) => e.kind === "startVanishTimer")
    expect(vanishEffect).toEqual({ kind: "startVanishTimer", ms: 4000 })
  })

  it("GRACE + vanish-elapsed → GRACE (stale)", () => {
    const s = graceAt(100)
    expect(step(s, { kind: "vanish-elapsed", now: 1 }, CTX)).toEqual({ state: s, effects: [] })
  })
})

describe("state-machine: SHOWING transitions", () => {
  it("SHOWING + idle-start → SHOWING (same turn, different tool call)", () => {
    const s = showingAt(1000)
    const r = step(s, { kind: "idle-start", tty: "/dev/ttys003", now: 2000 }, CTX)
    expect(r.state).toEqual(s)
    expect(r.effects).toEqual([])
  })

  it("SHOWING + idle-end → IDLE with vanish + cancelVanishTimer + recordImpression(interrupted)", () => {
    const r = step(showingAt(1000), { kind: "idle-end", now: 2500 }, CTX)
    expect(r.state).toEqual(idle)
    expect(r.effects).toHaveLength(3)
    expect(r.effects[0]).toEqual({ kind: "vanishDisplay" })
    expect(r.effects[1]).toEqual({ kind: "cancelVanishTimer" })
    expect(r.effects[2]).toMatchObject({
      kind: "recordImpression",
      impression: expect.objectContaining({
        adId: "ad-1",
        campaignId: "camp-1",
        result: "interrupted",
        durationMs: 1500,
        surface: "terminal-tv",
        source: "api",
        startedAt: 1000,
        deviceId: "dev-1",
      }),
    })
  })

  it("SHOWING + dismiss under MIN_COMPLETED_DURATION_MS → skipped", () => {
    const r = step(showingAt(1000), { kind: "dismiss", now: 1900 }, CTX)
    const imp = r.effects.find((e) => e.kind === "recordImpression")
    expect(imp).toMatchObject({ impression: expect.objectContaining({ result: "skipped" }) })
  })

  it("SHOWING + dismiss at exactly MIN_COMPLETED_DURATION_MS → completed", () => {
    const r = step(showingAt(1000), { kind: "dismiss", now: 2000 }, CTX)
    const imp = r.effects.find((e) => e.kind === "recordImpression")
    expect(imp).toMatchObject({ impression: expect.objectContaining({ result: "completed" }) })
  })

  it("SHOWING + vanish-elapsed → IDLE + recordImpression(completed)", () => {
    const r = step(showingAt(1000), { kind: "vanish-elapsed", now: 9000 }, CTX)
    expect(r.state).toEqual(idle)
    expect(r.effects).toContainEqual({ kind: "vanishDisplay" })
    const imp = r.effects.find((e) => e.kind === "recordImpression")
    expect(imp).toMatchObject({
      impression: expect.objectContaining({ result: "completed", durationMs: 8000 }),
    })
  })

  it("SHOWING + grace-elapsed → SHOWING (stale)", () => {
    const s = showingAt(1000)
    expect(step(s, { kind: "grace-elapsed", ad: null, now: 1 }, CTX)).toEqual({
      state: s,
      effects: [],
    })
  })

  it("SHOWING of demo ad still emits recordImpression (orchestrator skips write)", () => {
    const s = showingAt(1000, demoAd)
    const r = step(s, { kind: "vanish-elapsed", now: 9000 }, CTX)
    const imp = r.effects.find((e) => e.kind === "recordImpression")
    expect(imp).toMatchObject({ impression: expect.objectContaining({ source: "demo" }) })
  })

  it("durationMs is clamped to [0, MAX_AD_DURATION_MS]", () => {
    // clock skew: event "now" is before shownAt → clamp to 0
    const r = step(showingAt(1000), { kind: "idle-end", now: 500 }, CTX)
    const imp = r.effects.find((e) => e.kind === "recordImpression")
    expect(imp).toMatchObject({ impression: expect.objectContaining({ durationMs: 0 }) })
  })
})

describe("state-machine: impression id", () => {
  it("generates a uuid per recordImpression effect", () => {
    const r1 = step(showingAt(1000), { kind: "vanish-elapsed", now: 9000 }, CTX)
    const r2 = step(showingAt(1000), { kind: "vanish-elapsed", now: 9000 }, CTX)
    const imp1 = r1.effects.find((e) => e.kind === "recordImpression")
    const imp2 = r2.effects.find((e) => e.kind === "recordImpression")
    const id1 = (imp1 as { impression: { id: string } }).impression.id
    const id2 = (imp2 as { impression: { id: string } }).impression.id
    expect(id1).not.toBe(id2)
    expect(id1).toMatch(/^[0-9a-f-]{36}$/)
  })
})

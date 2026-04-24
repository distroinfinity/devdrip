import { describe, it, expect } from "vitest"
import { step, type State } from "../state-machine.js"
import type { CachedAd } from "../../ad-cache.js"

const fixtureAd: CachedAd = {
  id: "ad-test",
  campaignId: "camp-test",
  format: "text",
  headline: "H",
  body: "B",
  url: "https://x.test",
  displayTimeMs: 8000,
  deliveryToken: "tok",
  cacheSource: "api",
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
    expect(r.effects).toEqual([{ kind: "startGraceTimer", ms: 1500 }])
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

  it("GRACE + kill-key → IDLE with cancelGraceTimer + setSessionKilled", () => {
    const r = step(graceAt(100), { kind: "kill-key", now: 200 }, CTX)
    expect(r.state).toEqual({ kind: "IDLE" })
    expect(r.effects).toEqual([{ kind: "cancelGraceTimer" }, { kind: "setSessionKilled" }])
  })

  it("GRACE + mute-key → IDLE with cancelGraceTimer + writeMuteUntil", () => {
    const r = step(graceAt(100), { kind: "mute-key", now: 200 }, CTX)
    expect(r.state).toEqual({ kind: "IDLE" })
    const muteEffect = r.effects.find((e) => e.kind === "writeMuteUntil")
    expect(muteEffect).toBeDefined()
    if (muteEffect && muteEffect.kind === "writeMuteUntil") {
      expect(muteEffect.muteUntil).toBeGreaterThan(200)
    }
    expect(r.effects[0]).toEqual({ kind: "cancelGraceTimer" })
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

  it("SHOWING + vanish-elapsed → INTER_AD + recordImpression(completed)", () => {
    const r = step(showingAt(1000), { kind: "vanish-elapsed", now: 9000 }, CTX)
    expect(r.state.kind).toBe("INTER_AD")
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

describe("state-machine — rotation", () => {
  it("vanish-elapsed from SHOWING goes to INTER_AD with startInterAdTimer", () => {
    const state: State = {
      kind: "SHOWING",
      tty: "/dev/ttys003",
      ad: fixtureAd,
      shownAt: 0,
    }
    const result = step(state, { kind: "vanish-elapsed", now: 8000 }, { deviceId: "d1" })
    expect(result.state.kind).toBe("INTER_AD")
    expect(result.effects.some((e) => e.kind === "startInterAdTimer")).toBe(true)
    expect(result.effects.some((e) => e.kind === "vanishDisplay")).toBe(true)
    expect(result.effects.some((e) => e.kind === "recordImpression")).toBe(true)
  })

  it("inter-ad-elapsed with an ad returns to SHOWING", () => {
    const nextAd: CachedAd = { ...fixtureAd, id: "ad-next" }
    const state: State = { kind: "INTER_AD", tty: "/dev/ttys003", enteredAt: 0 }
    const result = step(
      state,
      { kind: "inter-ad-elapsed", ad: nextAd, now: 500 },
      { deviceId: "d1" }
    )
    expect(result.state.kind).toBe("SHOWING")
    expect(result.effects.some((e) => e.kind === "displayAd")).toBe(true)
  })

  it("inter-ad-elapsed with null ad returns to IDLE", () => {
    const state: State = { kind: "INTER_AD", tty: "/dev/ttys003", enteredAt: 0 }
    const result = step(state, { kind: "inter-ad-elapsed", ad: null, now: 500 }, { deviceId: "d1" })
    expect(result.state.kind).toBe("IDLE")
    expect(result.effects).toEqual([])
  })

  it("kill-key from SHOWING emits setSessionKilled", () => {
    const state: State = {
      kind: "SHOWING",
      tty: "/dev/ttys003",
      ad: fixtureAd,
      shownAt: 0,
    }
    const result = step(state, { kind: "kill-key", now: 4000 }, { deviceId: "d1" })
    expect(result.effects.some((e) => e.kind === "setSessionKilled")).toBe(true)
    expect(result.state.kind).toBe("IDLE")
  })

  it("mute-key emits writeMuteUntil", () => {
    const state: State = {
      kind: "SHOWING",
      tty: "/dev/ttys003",
      ad: fixtureAd,
      shownAt: 0,
    }
    const result = step(state, { kind: "mute-key", now: 4000 }, { deviceId: "d1" })
    const effect = result.effects.find((e) => e.kind === "writeMuteUntil") as
      | { kind: "writeMuteUntil"; muteUntil: number }
      | undefined
    expect(effect?.muteUntil).toBe(4000 + 1_800_000)
  })

  it("discover-key emits openDiscover with the ad AND rotates to INTER_AD", () => {
    const adX: CachedAd = { ...fixtureAd, id: "ad-x" }
    const state: State = { kind: "SHOWING", tty: "/dev/ttys003", ad: adX, shownAt: 0 }
    const result = step(state, { kind: "discover-key", now: 4000 }, { deviceId: "d1" })
    const effect = result.effects.find((e) => e.kind === "openDiscover")
    expect(effect).toBeDefined()
    expect((effect as { ad: CachedAd }).ad.id).toBe("ad-x")
    // rotation continues after discover — state goes to INTER_AD with timer
    expect(result.state.kind).toBe("INTER_AD")
    expect(result.effects.some((e) => e.kind === "startInterAdTimer")).toBe(true)
  })

  it("session-start from any state clears session state and returns IDLE", () => {
    const state: State = {
      kind: "SHOWING",
      tty: "/dev/ttys003",
      ad: fixtureAd,
      shownAt: 0,
    }
    const result = step(state, { kind: "session-start", now: 5000 }, { deviceId: "d1" })
    expect(result.state.kind).toBe("IDLE")
    expect(result.effects.some((e) => e.kind === "clearSessionState")).toBe(true)
  })

  it("INTER_AD + idle-end → IDLE with only cancelInterAdTimer", () => {
    const state: State = { kind: "INTER_AD", tty: "/dev/ttys003", enteredAt: 0 }
    const result = step(state, { kind: "idle-end", now: 200 }, { deviceId: "d1" })
    expect(result.state).toEqual({ kind: "IDLE" })
    expect(result.effects).toEqual([{ kind: "cancelInterAdTimer" }])
  })

  it("INTER_AD + dismiss → IDLE with only cancelInterAdTimer", () => {
    const state: State = { kind: "INTER_AD", tty: "/dev/ttys003", enteredAt: 0 }
    const result = step(state, { kind: "dismiss", now: 200 }, { deviceId: "d1" })
    expect(result.state).toEqual({ kind: "IDLE" })
    expect(result.effects).toEqual([{ kind: "cancelInterAdTimer" }])
  })

  it("INTER_AD + kill-key → IDLE with cancelInterAdTimer + setSessionKilled", () => {
    const state: State = { kind: "INTER_AD", tty: "/dev/ttys003", enteredAt: 0 }
    const result = step(state, { kind: "kill-key", now: 200 }, { deviceId: "d1" })
    expect(result.state).toEqual({ kind: "IDLE" })
    expect(result.effects).toEqual([{ kind: "cancelInterAdTimer" }, { kind: "setSessionKilled" }])
  })

  it("INTER_AD + mute-key → IDLE with cancelInterAdTimer + writeMuteUntil with correct timestamp", () => {
    const state: State = { kind: "INTER_AD", tty: "/dev/ttys003", enteredAt: 0 }
    const result = step(state, { kind: "mute-key", now: 4000 }, { deviceId: "d1" })
    expect(result.state).toEqual({ kind: "IDLE" })
    expect(result.effects.some((e) => e.kind === "cancelInterAdTimer")).toBe(true)
    const mute = result.effects.find((e) => e.kind === "writeMuteUntil") as
      | { kind: "writeMuteUntil"; muteUntil: number }
      | undefined
    expect(mute?.muteUntil).toBe(4000 + 1_800_000)
    const cancelIdx = result.effects.findIndex((e) => e.kind === "cancelInterAdTimer")
    const muteIdx = result.effects.findIndex((e) => e.kind === "writeMuteUntil")
    expect(cancelIdx).toBeLessThan(muteIdx)
  })

  it("INTER_AD + session-start → IDLE with cancelInterAdTimer + clearSessionState", () => {
    const state: State = { kind: "INTER_AD", tty: "/dev/ttys003", enteredAt: 0 }
    const result = step(state, { kind: "session-start", now: 200 }, { deviceId: "d1" })
    expect(result.state).toEqual({ kind: "IDLE" })
    expect(result.effects).toEqual([{ kind: "cancelInterAdTimer" }, { kind: "clearSessionState" }])
  })

  it("INTER_AD + stale events leave state unchanged and emit no effects", () => {
    const state: State = { kind: "INTER_AD", tty: "/dev/ttys003", enteredAt: 0 }
    const staleEvents: Array<Parameters<typeof step>[1]> = [
      { kind: "skip-key", now: 100 },
      { kind: "discover-key", now: 100 },
      { kind: "vanish-elapsed", now: 100 },
      { kind: "idle-start", tty: "/dev/ttys003", now: 100 },
      { kind: "grace-elapsed", ad: null, now: 100 },
    ]
    for (const event of staleEvents) {
      const result = step(state, event, { deviceId: "d1" })
      expect(result.state).toEqual(state)
      expect(result.effects).toEqual([])
    }
  })

  it("GRACE + session-start → IDLE with cancelGraceTimer + clearSessionState", () => {
    const state: State = { kind: "GRACE", tty: "/dev/ttys003", enteredAt: 100 }
    const result = step(state, { kind: "session-start", now: 200 }, { deviceId: "d1" })
    expect(result.state).toEqual({ kind: "IDLE" })
    expect(result.effects).toEqual([{ kind: "cancelGraceTimer" }, { kind: "clearSessionState" }])
  })

  it("IDLE + session-start → IDLE with clearSessionState", () => {
    const state: State = { kind: "IDLE" }
    const result = step(state, { kind: "session-start", now: 200 }, { deviceId: "d1" })
    expect(result.state).toEqual({ kind: "IDLE" })
    expect(result.effects).toEqual([{ kind: "clearSessionState" }])
  })

  it("SHOWING + discover-key emits openDiscover BEFORE vanishDisplay", () => {
    const state: State = {
      kind: "SHOWING",
      tty: "/dev/ttys003",
      ad: fixtureAd,
      shownAt: 0,
    }
    const result = step(state, { kind: "discover-key", now: 4000 }, { deviceId: "d1" })
    const discoverIdx = result.effects.findIndex((e) => e.kind === "openDiscover")
    const vanishIdx = result.effects.findIndex((e) => e.kind === "vanishDisplay")
    expect(discoverIdx).toBeGreaterThanOrEqual(0)
    expect(vanishIdx).toBeGreaterThanOrEqual(0)
    expect(discoverIdx).toBeLessThan(vanishIdx)
  })

  it("SHOWING + kill-key produces recordImpression with result=interrupted", () => {
    const state: State = {
      kind: "SHOWING",
      tty: "/dev/ttys003",
      ad: fixtureAd,
      shownAt: 1000,
    }
    const result = step(state, { kind: "kill-key", now: 4000 }, { deviceId: "d1" })
    const imp = result.effects.find((e) => e.kind === "recordImpression")
    expect(imp).toMatchObject({
      impression: expect.objectContaining({ result: "interrupted" }),
    })
  })
})

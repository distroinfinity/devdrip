import { randomUUID } from "node:crypto"
import { GRACE_PERIOD_MS, MAX_AD_DURATION_MS, MIN_COMPLETED_DURATION_MS } from "@devdrip/shared"
import type { CachedAd } from "../ad-cache.js"
import type { ImpressionResult, LocalImpression } from "../ledger.js"

export type State =
  | { kind: "IDLE" }
  | { kind: "GRACE"; tty: string | null; enteredAt: number }
  | { kind: "SHOWING"; tty: string | null; ad: CachedAd; shownAt: number }

export type Event =
  | { kind: "idle-start"; tty: string | null; now: number }
  | { kind: "idle-end"; now: number }
  | { kind: "dismiss"; now: number }
  | { kind: "grace-elapsed"; ad: CachedAd | null; now: number }
  | { kind: "vanish-elapsed"; now: number }

export type Effect =
  | { kind: "startGraceTimer"; ms: number }
  | { kind: "cancelGraceTimer" }
  | { kind: "displayAd"; tty: string | null; ad: CachedAd }
  | { kind: "startVanishTimer"; ms: number }
  | { kind: "cancelVanishTimer" }
  | { kind: "vanishDisplay" }
  | { kind: "recordImpression"; impression: LocalImpression }

export interface Ctx {
  deviceId: string
}

export interface StepResult {
  state: State
  effects: Effect[]
}

export function step(state: State, event: Event, ctx: Ctx): StepResult {
  switch (state.kind) {
    case "IDLE":
      return stepIdle(event)
    case "GRACE":
      return stepGrace(state, event)
    case "SHOWING":
      return stepShowing(state, event, ctx)
  }
}

function stepIdle(event: Event): StepResult {
  if (event.kind === "idle-start") {
    return {
      state: { kind: "GRACE", tty: event.tty, enteredAt: event.now },
      effects: [{ kind: "startGraceTimer", ms: GRACE_PERIOD_MS }],
    }
  }
  return { state: { kind: "IDLE" }, effects: [] }
}

function stepGrace(state: Extract<State, { kind: "GRACE" }>, event: Event): StepResult {
  if (event.kind === "idle-start") return { state, effects: [] }
  if (event.kind === "idle-end" || event.kind === "dismiss") {
    return { state: { kind: "IDLE" }, effects: [{ kind: "cancelGraceTimer" }] }
  }
  if (event.kind === "grace-elapsed") {
    if (!event.ad) return { state: { kind: "IDLE" }, effects: [] }
    const ms = Math.min(event.ad.displayTimeMs, MAX_AD_DURATION_MS)
    return {
      state: { kind: "SHOWING", tty: state.tty, ad: event.ad, shownAt: event.now },
      effects: [
        { kind: "displayAd", tty: state.tty, ad: event.ad },
        { kind: "startVanishTimer", ms },
      ],
    }
  }
  // vanish-elapsed is stale in GRACE — orchestrator logs and drops
  return { state, effects: [] }
}

function stepShowing(
  state: Extract<State, { kind: "SHOWING" }>,
  event: Event,
  ctx: Ctx
): StepResult {
  if (event.kind === "idle-start" || event.kind === "grace-elapsed") {
    return { state, effects: [] }
  }
  if (event.kind === "idle-end") {
    return endShowing(state, event.now, ctx, "interrupted")
  }
  if (event.kind === "dismiss") {
    const elapsed = Math.max(0, event.now - state.shownAt)
    const result: ImpressionResult = elapsed < MIN_COMPLETED_DURATION_MS ? "skipped" : "completed"
    return endShowing(state, event.now, ctx, result)
  }
  // vanish-elapsed
  return endShowing(state, event.now, ctx, "completed")
}

function endShowing(
  state: Extract<State, { kind: "SHOWING" }>,
  now: number,
  ctx: Ctx,
  result: ImpressionResult
): StepResult {
  const durationMs = Math.max(0, Math.min(now - state.shownAt, MAX_AD_DURATION_MS))
  const impression: LocalImpression = {
    id: randomUUID(),
    adId: state.ad.id,
    campaignId: state.ad.campaignId,
    surface: "terminal-tv",
    source: state.ad.cacheSource,
    deliveryToken: state.ad.deliveryToken,
    startedAt: state.shownAt,
    durationMs,
    result,
    deviceId: ctx.deviceId,
    cpmRate: null,
  }
  return {
    state: { kind: "IDLE" },
    effects: [
      { kind: "vanishDisplay" },
      { kind: "cancelVanishTimer" },
      { kind: "recordImpression", impression },
    ],
  }
}

import { randomUUID } from "node:crypto"
import {
  GRACE_PERIOD_MS,
  INTER_AD_GAP_MS,
  MAX_AD_DURATION_MS,
  MIN_COMPLETED_DURATION_MS,
  MUTE_DURATION_MS,
} from "@devdrip/shared"
import type { CachedAd } from "../ad-cache.js"
import type { ImpressionResult, LocalImpression } from "../ledger.js"

export type State =
  | { kind: "IDLE" }
  | { kind: "GRACE"; tty: string | null; enteredAt: number }
  | { kind: "SHOWING"; tty: string | null; ad: CachedAd; shownAt: number }
  | { kind: "INTER_AD"; tty: string | null; enteredAt: number }

export type Event =
  | { kind: "idle-start"; tty: string | null; now: number }
  | { kind: "idle-end"; now: number }
  | { kind: "dismiss"; now: number }
  | { kind: "grace-elapsed"; ad: CachedAd | null; now: number }
  | { kind: "vanish-elapsed"; now: number }
  | { kind: "skip-key"; now: number }
  | { kind: "kill-key"; now: number }
  | { kind: "mute-key"; now: number }
  | { kind: "discover-key"; now: number }
  | { kind: "inter-ad-elapsed"; ad: CachedAd | null; now: number }
  | { kind: "session-start"; now: number }

export type Effect =
  | { kind: "startGraceTimer"; ms: number }
  | { kind: "cancelGraceTimer" }
  | { kind: "displayAd"; tty: string | null; ad: CachedAd }
  | { kind: "startVanishTimer"; ms: number }
  | { kind: "cancelVanishTimer" }
  | { kind: "startInterAdTimer"; ms: number }
  | { kind: "cancelInterAdTimer" }
  | { kind: "vanishDisplay" }
  | { kind: "recordImpression"; impression: LocalImpression; ad: CachedAd }
  | { kind: "setSessionKilled" }
  | { kind: "clearSessionState" }
  | { kind: "writeMuteUntil"; muteUntil: number }
  | { kind: "openDiscover"; ad: CachedAd }

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
    case "INTER_AD":
      return stepInterAd(state, event)
  }
}

function stepIdle(event: Event): StepResult {
  if (event.kind === "idle-start") {
    return {
      state: { kind: "GRACE", tty: event.tty, enteredAt: event.now },
      effects: [{ kind: "startGraceTimer", ms: GRACE_PERIOD_MS }],
    }
  }
  if (event.kind === "session-start") {
    return { state: { kind: "IDLE" }, effects: [{ kind: "clearSessionState" }] }
  }
  return { state: { kind: "IDLE" }, effects: [] }
}

function stepGrace(state: Extract<State, { kind: "GRACE" }>, event: Event): StepResult {
  if (event.kind === "session-start") {
    return {
      state: { kind: "IDLE" },
      effects: [{ kind: "cancelGraceTimer" }, { kind: "clearSessionState" }],
    }
  }
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
  // vanish-elapsed, skip-key, kill-key, mute-key, discover-key, inter-ad-elapsed
  // are stale in GRACE — orchestrator logs and drops
  return { state, effects: [] }
}

function stepShowing(
  state: Extract<State, { kind: "SHOWING" }>,
  event: Event,
  ctx: Ctx
): StepResult {
  if (
    event.kind === "idle-start" ||
    event.kind === "grace-elapsed" ||
    event.kind === "inter-ad-elapsed"
  ) {
    return { state, effects: [] }
  }
  if (event.kind === "idle-end") {
    return endShowing(state, event.now, ctx, "interrupted", /*goToInterAd*/ false)
  }
  if (event.kind === "dismiss") {
    const elapsed = Math.max(0, event.now - state.shownAt)
    const result: ImpressionResult = elapsed < MIN_COMPLETED_DURATION_MS ? "skipped" : "completed"
    return endShowing(state, event.now, ctx, result, false)
  }
  if (event.kind === "skip-key") {
    const elapsed = Math.max(0, event.now - state.shownAt)
    const result: ImpressionResult = elapsed < MIN_COMPLETED_DURATION_MS ? "skipped" : "completed"
    return endShowing(state, event.now, ctx, result, /*goToInterAd*/ true)
  }
  if (event.kind === "kill-key") {
    const base = endShowing(state, event.now, ctx, "interrupted", false)
    return { state: base.state, effects: [...base.effects, { kind: "setSessionKilled" }] }
  }
  if (event.kind === "mute-key") {
    const muteUntil = event.now + MUTE_DURATION_MS
    const base = endShowing(state, event.now, ctx, "interrupted", false)
    return {
      state: base.state,
      effects: [...base.effects, { kind: "writeMuteUntil", muteUntil }],
    }
  }
  if (event.kind === "discover-key") {
    // discover opens the advertiser URL in the browser AND keeps rotation
    // going so the user doesn't lose the ad stream while Claude is still busy.
    const base = endShowing(state, event.now, ctx, "completed", /*goToInterAd*/ true)
    return {
      state: base.state,
      effects: [{ kind: "openDiscover", ad: state.ad }, ...base.effects],
    }
  }
  if (event.kind === "session-start") {
    const base = endShowing(state, event.now, ctx, "interrupted", false)
    return { state: base.state, effects: [...base.effects, { kind: "clearSessionState" }] }
  }
  // vanish-elapsed
  return endShowing(state, event.now, ctx, "completed", /*goToInterAd*/ true)
}

function stepInterAd(state: Extract<State, { kind: "INTER_AD" }>, event: Event): StepResult {
  if (event.kind === "idle-start" || event.kind === "grace-elapsed") {
    return { state, effects: [] }
  }
  if (
    event.kind === "idle-end" ||
    event.kind === "dismiss" ||
    event.kind === "kill-key" ||
    event.kind === "session-start"
  ) {
    const extra: Effect[] =
      event.kind === "kill-key"
        ? [{ kind: "setSessionKilled" }]
        : event.kind === "session-start"
          ? [{ kind: "clearSessionState" }]
          : []
    return {
      state: { kind: "IDLE" },
      effects: [{ kind: "cancelInterAdTimer" }, ...extra],
    }
  }
  if (event.kind === "mute-key") {
    return {
      state: { kind: "IDLE" },
      effects: [
        { kind: "cancelInterAdTimer" },
        { kind: "writeMuteUntil", muteUntil: event.now + MUTE_DURATION_MS },
      ],
    }
  }
  if (event.kind === "inter-ad-elapsed") {
    if (!event.ad) {
      return { state: { kind: "IDLE" }, effects: [] }
    }
    const ms = Math.min(event.ad.displayTimeMs, MAX_AD_DURATION_MS)
    return {
      state: { kind: "SHOWING", tty: state.tty, ad: event.ad, shownAt: event.now },
      effects: [
        { kind: "displayAd", tty: state.tty, ad: event.ad },
        { kind: "startVanishTimer", ms },
      ],
    }
  }
  // skip-key / discover-key / vanish-elapsed — stale in INTER_AD, ignore
  return { state, effects: [] }
}

function endShowing(
  state: Extract<State, { kind: "SHOWING" }>,
  now: number,
  ctx: Ctx,
  result: ImpressionResult,
  goToInterAd: boolean
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
  const baseEffects: Effect[] = [
    { kind: "vanishDisplay" },
    { kind: "cancelVanishTimer" },
    { kind: "recordImpression", impression, ad: state.ad },
  ]
  if (goToInterAd) {
    return {
      state: { kind: "INTER_AD", tty: state.tty, enteredAt: now },
      effects: [...baseEffects, { kind: "startInterAdTimer", ms: INTER_AD_GAP_MS }],
    }
  }
  return { state: { kind: "IDLE" }, effects: baseEffects }
}

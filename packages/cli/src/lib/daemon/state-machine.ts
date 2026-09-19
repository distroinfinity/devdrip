import { randomUUID } from "node:crypto"
import {
  GRACE_PERIOD_MS,
  INTER_AD_GAP_MS,
  MAX_AD_DURATION_MS,
  MIN_COMPLETED_DURATION_MS,
  MUTE_DURATION_MS,
} from "@devdrip/shared"
import type { CachedSlot } from "../slot-cache.js"
import type { ImpressionResult, LocalImpression, LocalNewsImpression } from "../ledger.js"

export type State =
  | { kind: "IDLE" }
  | { kind: "GRACE"; tty: string | null; enteredAt: number }
  | { kind: "SHOWING"; tty: string | null; ad: CachedSlot; shownAt: number }
  | { kind: "INTER_AD"; tty: string | null; enteredAt: number }

// S3-14: events that target a specific session carry an optional `tty` field
// for orchestrator-level routing. `step()` itself ignores tty; the orchestrator
// uses it to pick which per-tty session's state to step. When omitted the
// orchestrator falls back to the single active session (preserves
// single-terminal behavior and keeps existing tests as-is).
export type Event =
  | { kind: "idle-start"; tty: string | null; now: number }
  | { kind: "idle-end"; now: number; tty?: string | null }
  | { kind: "dismiss"; now: number; tty?: string | null }
  | { kind: "grace-elapsed"; ad: CachedSlot | null; now: number; tty?: string | null }
  | { kind: "vanish-elapsed"; now: number; tty?: string | null }
  | { kind: "skip-key"; now: number; tty?: string | null }
  | { kind: "kill-key"; now: number; tty?: string | null }
  | { kind: "mute-key"; now: number; tty?: string | null }
  | { kind: "discover-key"; now: number; tty?: string | null }
  | { kind: "inter-ad-elapsed"; ad: CachedSlot | null; now: number; tty?: string | null }
  | { kind: "session-start"; now: number; tty?: string | null }
  | { kind: "save-key"; now: number; tty?: string | null }

export type Effect =
  | { kind: "startGraceTimer"; ms: number }
  | { kind: "cancelGraceTimer" }
  | { kind: "displayAd"; tty: string | null; ad: CachedSlot }
  | { kind: "startVanishTimer"; ms: number }
  | { kind: "cancelVanishTimer" }
  | { kind: "startInterAdTimer"; ms: number }
  | { kind: "cancelInterAdTimer" }
  | { kind: "vanishDisplay" }
  | { kind: "recordImpression"; impression: LocalImpression; ad: CachedSlot }
  | { kind: "recordNewsImpression"; impression: LocalNewsImpression; ad: CachedSlot }
  | { kind: "setSessionKilled" }
  | { kind: "clearSessionState" }
  | { kind: "writeMuteUntil"; muteUntil: number }
  | { kind: "openDiscover"; ad: CachedSlot; deliveryToken: string }
  // S3-04: drive the progress bar while the ad is on screen. orchestrator
  // runs a 500ms interval keyed on `shownAt` and pushes the tick to display.
  // The same tick drives the S3-05 earnings popup animation (in-box, top-
  // right) so both live in one render loop. The ad is carried here so the
  // tick can compute cpm-based popup decisions without re-reading state.
  | { kind: "startProgressTimer"; shownAt: number; displayTimeMs: number; ad: CachedSlot }
  | { kind: "cancelProgressTimer" }
  // S3-04: on completed/stop, snap to 100% and hold briefly before the box
  // vanishes so the jump reads as a deliberate finish, not a cold cut.
  | { kind: "snapProgressToComplete" }

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
  // mute/kill during GRACE: the previous ad's footer was visible until
  // ~GRACE_PERIOD_MS ago, so a key press here is the user's intent. Cancel
  // the pending ad and apply the action; no impression to record (no ad ran).
  if (event.kind === "kill-key") {
    return {
      state: { kind: "IDLE" },
      effects: [{ kind: "cancelGraceTimer" }, { kind: "setSessionKilled" }],
    }
  }
  if (event.kind === "mute-key") {
    return {
      state: { kind: "IDLE" },
      effects: [
        { kind: "cancelGraceTimer" },
        { kind: "writeMuteUntil", muteUntil: event.now + MUTE_DURATION_MS },
      ],
    }
  }
  if (event.kind === "grace-elapsed") {
    if (!event.ad) return { state: { kind: "IDLE" }, effects: [] }
    const displayTimeMs = event.ad.kind === "ad" ? event.ad.payload.displayTimeMs : 4000
    const ms = Math.min(displayTimeMs, MAX_AD_DURATION_MS)
    return {
      state: { kind: "SHOWING", tty: state.tty, ad: event.ad, shownAt: event.now },
      effects: [
        { kind: "displayAd", tty: state.tty, ad: event.ad },
        { kind: "startVanishTimer", ms },
        { kind: "startProgressTimer", shownAt: event.now, displayTimeMs: ms, ad: event.ad },
      ],
    }
  }
  if (event.kind === "save-key") return { state, effects: [] }
  // vanish-elapsed, skip-key, discover-key, inter-ad-elapsed
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
    event.kind === "inter-ad-elapsed" ||
    event.kind === "save-key"
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
    const deliveryToken = state.ad.kind === "ad" ? state.ad.payload.deliveryToken : ""
    return {
      state: base.state,
      effects: [{ kind: "openDiscover", ad: state.ad, deliveryToken }, ...base.effects],
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
    const displayTimeMs = event.ad.kind === "ad" ? event.ad.payload.displayTimeMs : 4000
    const ms = Math.min(displayTimeMs, MAX_AD_DURATION_MS)
    return {
      state: { kind: "SHOWING", tty: state.tty, ad: event.ad, shownAt: event.now },
      effects: [
        { kind: "displayAd", tty: state.tty, ad: event.ad },
        { kind: "startVanishTimer", ms },
        { kind: "startProgressTimer", shownAt: event.now, displayTimeMs: ms, ad: event.ad },
      ],
    }
  }
  // skip-key / discover-key / vanish-elapsed / save-key — stale in INTER_AD, ignore
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
  const slot = state.ad

  // effect order matters. the orchestrator interprets `snapProgressToComplete`
  // as "flush a 100% frame, then pause PROGRESS_SNAP_HOLD_MS before running
  // the tail" — everything after it runs on the deferred timeline so the
  // user sees a full bar before the box clears.
  const cleanup: Effect[] = [
    { kind: "cancelProgressTimer" },
    { kind: "snapProgressToComplete" },
    { kind: "vanishDisplay" },
    { kind: "cancelVanishTimer" },
  ]
  // only emit recordImpression for ad slots — news slots have no ledger row
  if (slot.kind === "ad") {
    const adPayload = slot.payload
    const impression: LocalImpression = {
      id: randomUUID(),
      adId: adPayload.id,
      campaignId: adPayload.campaignId,
      surface: "terminal-tv",
      source: slot.cacheSource,
      deliveryToken: adPayload.deliveryToken,
      startedAt: state.shownAt,
      durationMs,
      result,
      deviceId: ctx.deviceId,
      // carry the server-advertised CPM into the ledger row so today's running
      // total stays accurate without an API round-trip. backend recomputes
      // authoritative earnings at sync time.
      cpmRate: slot.cacheSource === "api" ? (adPayload.cpmRate ?? 0) : null,
    }
    cleanup.push({ kind: "recordImpression", impression, ad: slot })
  }
  if (slot.kind === "news") {
    const newsImpression: LocalNewsImpression = {
      id: randomUUID(),
      newsId: slot.payload.id,
      source: slot.payload.source,
      deviceId: ctx.deviceId,
      durationMs,
      result,
      // openedUrl left false here — orchestrator overrides from its per-session flag
      openedUrl: false,
      // saved is denormalized analytics; reading_pending tracks the actual save intent
      saved: false,
      createdAt: now,
    }
    cleanup.push({ kind: "recordNewsImpression", impression: newsImpression, ad: slot })
  }

  if (goToInterAd) {
    return {
      state: { kind: "INTER_AD", tty: state.tty, enteredAt: now },
      effects: [...cleanup, { kind: "startInterAdTimer", ms: INTER_AD_GAP_MS }],
    }
  }
  return { state: { kind: "IDLE" }, effects: cleanup }
}

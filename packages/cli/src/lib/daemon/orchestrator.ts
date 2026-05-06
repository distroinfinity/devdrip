// M1: ad slots ripped. M3 extends news; M4 adds "ticker" branch.
import { randomUUID } from "node:crypto"
import {
  MAX_ADS_PER_CONTINUOUS_SESSION,
  NIGHT_MODE_DEFAULT_START_HOUR,
  NIGHT_MODE_DEFAULT_END_HOUR,
  PROGRESS_CAP,
  PROGRESS_SNAP_HOLD_MS,
  PROGRESS_TICK_MS,
  type DevdripPreferences,
} from "@distrotv/shared"
import type { SlotCache, CachedSlot } from "../slot-cache.js"
import type { Ledger, LocalNewsImpression } from "../ledger.js"
import type { KeyCapture } from "./input.js"
import { step, type Effect, type Event, type State } from "./state-machine.js"

export interface DisplayHandleApi {
  vanish: () => { latencyMs: number }
  onResize: (cb: () => void) => void
  flash: () => void
  updateProgress: (progress: number, elapsedMs: number) => void
}

export interface DisplayApi {
  show(
    ttyPath: string,
    slot: CachedSlot,
    ctx: { source?: string; width?: number }
  ): DisplayHandleApi
}

export interface LoggerApi {
  debug(msg: string, fields?: Record<string, unknown>): void
  info(msg: string, fields?: Record<string, unknown>): void
  warn(msg: string, fields?: Record<string, unknown>): void
  error(msg: string, fields?: Record<string, unknown>): void
}

export type OpenUrl = (url: string) => void

export interface OrchestratorDeps {
  slotCache: SlotCache
  ledger: Ledger
  display: DisplayApi
  keyCapture: KeyCapture
  openUrl: OpenUrl
  log: LoggerApi
  deviceId: string
  preferences: DevdripPreferences
  writePreferences?: (next: DevdripPreferences) => Promise<void>
  now?: () => number
}

export interface Orchestrator {
  dispatch(event: Event): void
  currentState(): State
  adsShown(): number
  hooksReceived(): number
  updatePreferences(next: DevdripPreferences): void
  shutdown(): Promise<void>
}

// Returns the local-hour (0-23) at the given timestamp for a user with
// `tzOffsetMinutes` offset from UTC (positive east of UTC, e.g. IST=+330).
function localHour(nowMs: number, tzOffsetMinutes: number): number {
  const offsetMs = tzOffsetMinutes * 60_000
  const shifted = new Date(nowMs + offsetMs)
  // getUTCHours on a shifted UTC Date gives the local hour.
  return shifted.getUTCHours()
}

function localDayKey(nowMs: number, tzOffsetMinutes: number): string {
  const offsetMs = tzOffsetMinutes * 60_000
  const shifted = new Date(nowMs + offsetMs)
  return `${shifted.getUTCFullYear()}-${shifted.getUTCMonth()}-${shifted.getUTCDate()}`
}

// Supports a wraparound window (start=22, end=7 → hours 22,23,0..6).
function isInQuietWindow(hour: number, start: number, end: number): boolean {
  if (start === end) return false
  if (start < end) return hour >= start && hour < end
  return hour >= start || hour < end
}

function resolveQuietWindow(prefs: DevdripPreferences): { start: number; end: number } | null {
  if (prefs.quietHoursStart !== null && prefs.quietHoursEnd !== null) {
    return { start: prefs.quietHoursStart, end: prefs.quietHoursEnd }
  }
  if (prefs.nightMode) {
    return { start: NIGHT_MODE_DEFAULT_START_HOUR, end: NIGHT_MODE_DEFAULT_END_HOUR }
  }
  return null
}

// Sigmoid curve: smoothly accelerates away from 0, then asymptotes toward the
// cap. `k` controls steepness — k=8 gives ~5% at start, ~50% at midpoint,
// ~85% near end, asymptotic to PROGRESS_CAP. Feels closer to how a dev
// experiences Claude's tool-call latency (slow start, mid-task plateau).
function sigmoidProgress(elapsedMs: number, displayTimeMs: number): number {
  if (displayTimeMs <= 0) return PROGRESS_CAP
  const x = elapsedMs / displayTimeMs
  const k = 8
  const s = 1 / (1 + Math.exp(-k * (x - 0.5)))
  return Math.min(PROGRESS_CAP, s * PROGRESS_CAP)
}

// S3-14: sentinel key used when an event arrives without a tty (piped/CI
// contexts, or single-terminal legacy clients). All such events route to one
// dedicated session so behavior stays identical to the single-tty daemon.
const NO_TTY_KEY = "__no_tty__"

function ttyKey(tty: string | null): string {
  return tty ?? NO_TTY_KEY
}

interface Session {
  // identity
  readonly key: string
  readonly tty: string | null
  // state-machine slice
  state: State
  // timers scoped to this session's ad rotation
  graceTimer: NodeJS.Timeout | null
  vanishTimer: NodeJS.Timeout | null
  interAdTimer: NodeJS.Timeout | null
  progressTimer: NodeJS.Timeout | null
  // the display handle for whatever ad is currently on THIS session's tty
  currentDisplay: DisplayHandleApi | null
  // kind of the slot currently showing, or null when idle
  currentSlotKind: string | null
  // per-session suppression bits
  sessionKilled: boolean
  adsInCurrentBusyWindow: number
  // re-anchored on every clearSessionState so sessionWarmupMs applies per
  // Claude Code invocation, not per daemon lifetime.
  sessionStartAt: number
  // set true when discover-key fires while a news slot is showing; carried
  // into the recordNewsImpression effect so openedUrl is accurate (the state
  // machine can't know this — it doesn't own key-intercept logic).
  openedNewsUrl: boolean
  // set true when save-key successfully writes a reading_pending row for the
  // active news slot; carried into recordNewsImpression so saved is accurate.
  savedNews: boolean
}

export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  const now = deps.now ?? (() => Date.now())

  // per-tty sessions (S3-14). Created lazily on first event for a given tty.
  const sessions = new Map<string, Session>()
  // brief delay between a key/CLI action arriving and the state transition
  // firing, so the user sees the flash before the ad vanishes.
  const KEY_FLASH_DELAY_MS = 150

  // ── globals (per user, shared across all tty sessions) ────────────────
  let preferences: DevdripPreferences = deps.preferences
  let adsShownCount = 0
  let hooksReceivedCount = 0
  // rate-limit counters are per-user, not per-tty: two terminals must NOT
  // double the ads a user sees in an hour/day.
  const hourlyTimestamps: number[] = []
  const dailyTimestamps: number[] = []

  function getOrCreateSession(key: string, tty: string | null): Session {
    let s = sessions.get(key)
    if (s) return s
    s = {
      key,
      tty,
      state: { kind: "IDLE" },
      graceTimer: null,
      vanishTimer: null,
      interAdTimer: null,
      progressTimer: null,
      currentDisplay: null,
      currentSlotKind: null,
      sessionKilled: false,
      adsInCurrentBusyWindow: 0,
      sessionStartAt: now(),
      openedNewsUrl: false,
      savedNews: false,
    }
    sessions.set(key, s)
    return s
  }

  // Resolve which session an event targets. For `idle-start`, always use the
  // event's explicit tty (creates the session if needed). For everything else
  // we prefer event.tty; if it's omitted we fall back to the single active
  // session (the common single-terminal case, also what every test exercises).
  function resolveSession(event: Event): Session | null {
    if (event.kind === "idle-start") {
      return getOrCreateSession(ttyKey(event.tty), event.tty)
    }
    const ttyVal = "tty" in event ? event.tty : undefined
    if (ttyVal !== undefined) {
      return getOrCreateSession(ttyKey(ttyVal), ttyVal)
    }
    // infer: single active (non-IDLE) session takes the event; otherwise the
    // single session overall; otherwise create/use the null-tty sentinel so
    // pre-S3-14 single-terminal clients (session-start before any idle-start,
    // hook clients that don't send tty) still hit a real session instead of
    // silently dropping the event.
    const active: Session[] = []
    for (const s of sessions.values()) {
      if (s.state.kind !== "IDLE") active.push(s)
    }
    if (active.length === 1) return active[0] ?? null
    if (active.length === 0) {
      if (sessions.size === 1) {
        const first = sessions.values().next().value as Session | undefined
        return first ?? null
      }
      // no sessions at all, or every session is IDLE with no clear owner —
      // fall through to the null-tty sentinel.
      return getOrCreateSession(NO_TTY_KEY, null)
    }
    // multi-active with no tty hint — e.g. old-client idle-end: pick the most
    // recently-entered session so at least one progresses. Logged so the
    // operator sees it in the daemon log if this ever fires in prod.
    active.sort((a, b) => sessionEnteredAt(b) - sessionEnteredAt(a))
    deps.log.warn("event without tty hint, multiple active sessions — routing to most recent", {
      eventKind: event.kind,
      sessionCount: active.length,
    })
    return active[0] ?? null
  }

  function sessionEnteredAt(s: Session): number {
    switch (s.state.kind) {
      case "GRACE":
      case "INTER_AD":
        return s.state.enteredAt
      case "SHOWING":
        return s.state.shownAt
      case "IDLE":
        return 0
    }
  }

  function applyStep(session: Session, event: Event): void {
    const result = step(session.state, event, { deviceId: deps.deviceId })
    session.state = result.state
    runEffects(session, result.effects)
  }

  // effects normally run synchronously, but `snapProgressToComplete` is a
  // "pause point": it forces the box to redraw at 100% and then defers every
  // following effect by PROGRESS_SNAP_HOLD_MS so the user actually sees the
  // full bar before vanish clears it.
  function runEffects(session: Session, effects: Effect[]): void {
    for (let i = 0; i < effects.length; i++) {
      const eff = effects[i]
      if (!eff) continue
      if (eff.kind === "snapProgressToComplete") {
        if (session.currentDisplay) {
          try {
            session.currentDisplay.updateProgress(1.0, 0)
          } catch (err) {
            deps.log.warn("progress snap failed", { error: (err as Error).message })
          }
        }
        const tail = effects.slice(i + 1)
        setTimeout(() => runEffects(session, tail), PROGRESS_SNAP_HOLD_MS)
        return
      }
      runEffect(session, eff)
    }
  }

  function dispatch(event: Event): void {
    // count only socket-originated events (hooks), not internal timer callbacks.
    // this lets `distro daemon status` answer "are hooks reaching the daemon?".
    if (event.kind === "idle-start" || event.kind === "idle-end" || event.kind === "dismiss") {
      hooksReceivedCount += 1
    }

    const session = resolveSession(event)
    if (!session) {
      deps.log.debug("dispatch skipped — no matching session", { eventKind: event.kind })
      return
    }

    if (event.kind === "idle-end" || event.kind === "dismiss") {
      session.adsInCurrentBusyWindow = 0
    }

    // intercept save-key before normal flow — no state transition, only a ledger write + flash
    if (event.kind === "save-key") {
      const showing = session.state.kind === "SHOWING" ? session.state : null
      const slot = showing?.ad ?? null
      if (slot && slot.kind === "news") {
        try {
          deps.ledger.recordReadingPending({
            id: randomUUID(),
            newsId: slot.id,
            source: slot.source,
            headline: slot.headline,
            url: slot.url,
            score: slot.score,
            savedAt: now(),
          })
          session.savedNews = true
          deps.log.info("news saved", { newsId: slot.id })
          if (session.currentDisplay) {
            try {
              session.currentDisplay.flash()
            } catch {
              /* non-fatal */
            }
          }
        } catch (err) {
          deps.log.warn("reading save failed", { error: (err as Error).message })
        }
      } else {
        deps.log.debug("save key ignored — no active news slot")
      }
      return
    }

    // track whether the user opened the URL on a news slot — state machine
    // doesn't see this; we record it here so recordNewsImpression can set it.
    if (event.kind === "discover-key") {
      if (session.state.kind === "SHOWING" && session.state.ad.kind === "news") {
        session.openedNewsUrl = true
      }
      // fall through to normal flash + applyStep handling
    }

    const isUserKey =
      event.kind === "discover-key" ||
      event.kind === "skip-key" ||
      event.kind === "kill-key" ||
      event.kind === "mute-key"
    if (isUserKey && session.currentDisplay) {
      // flash the ad box and wait briefly before transitioning, so the user
      // sees a green glow confirming their keystroke/CLI action was captured.
      try {
        session.currentDisplay.flash()
      } catch (err) {
        deps.log.warn("flash failed", { error: (err as Error).message })
      }
      setTimeout(() => applyStep(session, event), KEY_FLASH_DELAY_MS)
      return
    }
    applyStep(session, event)
  }

  function runEffect(session: Session, effect: Effect): void {
    switch (effect.kind) {
      case "startGraceTimer":
        if (session.graceTimer) clearTimeout(session.graceTimer)
        session.graceTimer = setTimeout(() => {
          session.graceTimer = null
          const firedAt = now()
          const ad = pickNextSlot(session, firedAt, "grace")
          dispatch({ kind: "grace-elapsed", ad, now: firedAt, tty: session.tty })
        }, effect.ms)
        return
      case "cancelGraceTimer":
        if (session.graceTimer) {
          clearTimeout(session.graceTimer)
          session.graceTimer = null
        }
        return
      case "startInterAdTimer":
        if (session.interAdTimer) clearTimeout(session.interAdTimer)
        session.interAdTimer = setTimeout(() => {
          session.interAdTimer = null
          const firedAt = now()
          const ad = pickNextSlot(session, firedAt, "inter-ad")
          dispatch({ kind: "inter-ad-elapsed", ad, now: firedAt, tty: session.tty })
        }, effect.ms)
        return
      case "cancelInterAdTimer":
        if (session.interAdTimer) {
          clearTimeout(session.interAdTimer)
          session.interAdTimer = null
        }
        return
      case "displayAd": {
        const payloadId = effect.ad.kind === "news" ? effect.ad.id : effect.ad.symbol
        if (!effect.tty) {
          deps.log.warn("display skipped: no tty path", { payloadId })
          queueMicrotask(() => dispatch({ kind: "dismiss", now: now(), tty: session.tty }))
          return
        }
        try {
          const source = effect.ad.cacheSource === "demo" ? "DEMO" : undefined
          session.currentDisplay = deps.display.show(effect.tty, effect.ad, { source })
          session.currentSlotKind = effect.ad.kind
          // on terminal resize, proactively dismiss the current ad — the
          // display has already reset its scroll region to prevent content
          // loss, and the next rotation tick will re-anchor with fresh rows.
          session.currentDisplay.onResize(() => {
            deps.log.info("resize detected — dismissing slot to re-anchor", {
              payloadId,
              tty: session.tty,
            })
            dispatch({ kind: "dismiss", now: now(), tty: session.tty })
          })
          deps.keyCapture.start(effect.tty)
          const displayTimeMs = effect.ad.kind === "news" ? effect.ad.displayTimeMs : 0
          deps.log.info("showing slot", {
            payloadId,
            kind: effect.ad.kind,
            source: effect.ad.cacheSource,
            displayTimeMs,
            tty: session.tty,
          })
        } catch (err) {
          deps.log.warn("display failed", {
            payloadId,
            error: (err as Error).message,
            tty: session.tty,
          })
          session.currentDisplay = null
          session.currentSlotKind = null
          if (session.tty) deps.keyCapture.stop(session.tty)
          queueMicrotask(() => dispatch({ kind: "dismiss", now: now(), tty: session.tty }))
        }
        return
      }
      case "startProgressTimer": {
        if (session.progressTimer) clearInterval(session.progressTimer)
        const shownAt = effect.shownAt
        const displayTimeMs = effect.displayTimeMs
        session.progressTimer = setInterval(() => {
          if (!session.currentDisplay) return
          const elapsed = Math.max(0, now() - shownAt)
          const p = sigmoidProgress(elapsed, displayTimeMs)
          try {
            session.currentDisplay.updateProgress(p, elapsed)
          } catch (err) {
            deps.log.warn("progress tick failed", { error: (err as Error).message })
          }
        }, PROGRESS_TICK_MS)
        // unref so a lingering progress timer never holds the daemon open.
        session.progressTimer.unref?.()
        return
      }
      case "cancelProgressTimer":
        if (session.progressTimer) {
          clearInterval(session.progressTimer)
          session.progressTimer = null
        }
        return
      case "snapProgressToComplete":
        // handled in runEffects — reaching here means no ad display was
        // active (e.g. null-tty path) so there's nothing to snap.
        return
      case "startVanishTimer":
        if (session.vanishTimer) clearTimeout(session.vanishTimer)
        session.vanishTimer = setTimeout(() => {
          session.vanishTimer = null
          dispatch({ kind: "vanish-elapsed", now: now(), tty: session.tty })
        }, effect.ms)
        return
      case "cancelVanishTimer":
        if (session.vanishTimer) {
          clearTimeout(session.vanishTimer)
          session.vanishTimer = null
        }
        return
      case "vanishDisplay":
        // only stop THIS session's key capture — other ttys may still be
        // showing their own ads. falls back to stop() (all) when no tty is
        // known, which only happens on the null-tty sentinel session.
        if (session.tty) deps.keyCapture.stop(session.tty)
        else deps.keyCapture.stop()
        // defensive cleanup — state machine always pairs vanish with an
        // explicit cancelProgressTimer, but clearing here too avoids a runaway
        // tick if a test dispatches vanishDisplay in isolation.
        if (session.progressTimer) {
          clearInterval(session.progressTimer)
          session.progressTimer = null
        }
        if (session.currentDisplay) {
          try {
            const { latencyMs } = session.currentDisplay.vanish()
            deps.log.info("vanish latency", { latencyMs, tty: session.tty })
          } catch (err) {
            deps.log.warn("vanish failed", { error: (err as Error).message })
          }
          adsShownCount += 1
          session.currentDisplay = null
          session.currentSlotKind = null
        }
        return
      case "recordImpression":
        handleRecord(effect.impression, effect.ad)
        return
      case "recordNewsImpression": {
        const finalImpression: LocalNewsImpression = {
          ...effect.impression,
          openedUrl: session.openedNewsUrl,
          saved: session.savedNews,
        }
        try {
          deps.ledger.recordNewsImpression(finalImpression)
          deps.log.info("news impression recorded", {
            newsId: effect.impression.newsId,
            result: effect.impression.result,
            durationMs: effect.impression.durationMs,
            openedUrl: finalImpression.openedUrl,
            saved: finalImpression.saved,
          })
        } catch (err) {
          deps.log.warn("news impression ledger write failed", { error: (err as Error).message })
        }
        session.openedNewsUrl = false
        session.savedNews = false
        return
      }
      case "setSessionKilled":
        session.sessionKilled = true
        deps.log.info("session ads killed by user", { tty: session.tty })
        return
      case "clearSessionState":
        session.sessionKilled = false
        session.adsInCurrentBusyWindow = 0
        session.currentSlotKind = null
        session.sessionStartAt = now()
        session.openedNewsUrl = false
        session.savedNews = false
        deps.log.info("session state cleared", { tty: session.tty })
        return
      case "writeMuteUntil":
        // mute is a user-level preference (shared across all their ttys), not
        // a per-session flag — persist it to config and let the reload path
        // propagate to all sessions via updatePreferences.
        preferences = { ...preferences, muteUntil: effect.muteUntil }
        deps.writePreferences?.(preferences).catch((err: Error) => {
          deps.log.warn("mute persistence failed", { error: err.message })
        })
        deps.log.info("ads muted", { muteUntilMs: effect.muteUntil })
        return
      case "openDiscover": {
        try {
          if (effect.ad.kind === "news") deps.openUrl(effect.ad.url)
        } catch (err) {
          deps.log.warn("openUrl failed", { error: (err as Error).message })
        }
        // news clicks recorded server-side via openedUrl flag on news impression
        return
      }
    }
  }

  function handleRecord(_imp: unknown, slot: CachedSlot): void {
    if (slot.kind === "news") {
      // news impressions are ledgered separately via recordNewsImpression
      deps.log.debug("skipping ad-ledger write for news slot", { newsId: slot.id })
      return
    }
  }

  type Reason =
    | "warmup"
    | "quiet-hours"
    | "muted"
    | "killed"
    | "session-cap"
    | "hourly-cap"
    | "daily-cap"

  function pruneCounters(nowMs: number): void {
    const hourAgo = nowMs - 3_600_000
    while (hourlyTimestamps.length > 0) {
      const head = hourlyTimestamps[0]
      if (head === undefined || head >= hourAgo) break
      hourlyTimestamps.shift()
    }
    // daily: bucket by local day
    const today = localDayKey(nowMs, preferences.tzOffsetMinutes)
    let i = 0
    while (i < dailyTimestamps.length) {
      const ts = dailyTimestamps[i]
      if (ts === undefined) break
      if (localDayKey(ts, preferences.tzOffsetMinutes) === today) break
      i++
    }
    if (i > 0) dailyTimestamps.splice(0, i)
  }

  function suppressionReason(session: Session, nowMs: number): Reason | null {
    if (nowMs - session.sessionStartAt < preferences.sessionWarmupMs) return "warmup"
    const window = resolveQuietWindow(preferences)
    if (window) {
      const hour = localHour(nowMs, preferences.tzOffsetMinutes)
      if (isInQuietWindow(hour, window.start, window.end)) return "quiet-hours"
    }
    if (preferences.muteUntil && nowMs < preferences.muteUntil) return "muted"
    if (session.sessionKilled) return "killed"
    pruneCounters(nowMs)
    if (session.adsInCurrentBusyWindow >= MAX_ADS_PER_CONTINUOUS_SESSION) return "session-cap"
    if (hourlyTimestamps.length >= preferences.maxPerHour) return "hourly-cap"
    if (dailyTimestamps.length >= preferences.maxPerDay) return "daily-cap"
    return null
  }

  // silently picks the next slot to show, or returns null if any cap is hit.
  // context: "grace" | "inter-ad" is used only for log correlation.
  function pickNextSlot(
    session: Session,
    firedAt: number,
    context: "grace" | "inter-ad"
  ): CachedSlot | null {
    const reason = suppressionReason(session, firedAt)
    if (reason) {
      deps.log.debug("slot suppressed", { context, reason, tty: session.tty })
      return null
    }
    const slot = deps.slotCache.next()
    if (!slot) {
      deps.log.debug("cache empty", { context })
      return null
    }
    return slot
  }

  function updatePreferences(next: DevdripPreferences): void {
    preferences = next
    deps.log.info("preferences reloaded", {
      blockedCategories: next.blockedCategories.length,
      maxPerHour: next.maxPerHour,
      maxPerDay: next.maxPerDay,
      sessionWarmupMs: next.sessionWarmupMs,
      quietHoursStart: next.quietHoursStart,
      quietHoursEnd: next.quietHoursEnd,
      nightMode: next.nightMode,
    })
  }

  async function shutdown(): Promise<void> {
    for (const session of sessions.values()) {
      if (session.graceTimer) clearTimeout(session.graceTimer)
      if (session.vanishTimer) clearTimeout(session.vanishTimer)
      if (session.interAdTimer) clearTimeout(session.interAdTimer)
      if (session.progressTimer) clearInterval(session.progressTimer)
    }
    deps.keyCapture.stop()
    // dispatch dismiss to every session still mid-ad, so their impressions
    // land in the ledger before we exit.
    for (const session of sessions.values()) {
      if (session.state.kind === "SHOWING" || session.state.kind === "INTER_AD") {
        dispatch({ kind: "dismiss", now: now(), tty: session.tty })
      }
    }
  }

  // currentState() preserves the pre-S3-14 single-tty contract for tests +
  // introspection: returns the most-recently-touched session's state, or IDLE
  // if none exist. Multi-tty consumers should iterate `sessions` directly
  // (exposed via the internal surface below if ever needed).
  function currentState(): State {
    if (sessions.size === 0) return { kind: "IDLE" }
    if (sessions.size === 1) {
      const first = sessions.values().next().value as Session | undefined
      return first?.state ?? { kind: "IDLE" }
    }
    let best: Session | null = null
    let bestTs = -1
    for (const s of sessions.values()) {
      const ts = sessionEnteredAt(s)
      if (ts >= bestTs) {
        bestTs = ts
        best = s
      }
    }
    return best?.state ?? { kind: "IDLE" }
  }

  return {
    dispatch,
    currentState,
    adsShown: () => adsShownCount,
    hooksReceived: () => hooksReceivedCount,
    updatePreferences,
    shutdown,
  }
}

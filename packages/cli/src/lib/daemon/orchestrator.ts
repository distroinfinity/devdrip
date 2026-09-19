import { randomUUID } from "node:crypto"
import {
  MAX_ADS_PER_CONTINUOUS_SESSION,
  NIGHT_MODE_DEFAULT_START_HOUR,
  NIGHT_MODE_DEFAULT_END_HOUR,
  PROGRESS_CAP,
  PROGRESS_SNAP_HOLD_MS,
  PROGRESS_TICK_MS,
  REVENUE_SHARE_DEVELOPER,
  TOAST_HOLD_MS,
  VALID_IMPRESSION_FOR_TOAST_MS,
  type DevdripPreferences,
} from "@devdrip/shared"
import type { AdCache, CachedAd } from "../ad-cache.js"
import type { Ledger, LocalImpression } from "../ledger.js"
import type { KeyCapture } from "./input.js"
import type { EarningsPopup, PopupPhase } from "../render-box.js"
import { step, type Effect, type Event, type State } from "./state-machine.js"

export interface DisplayHandleApi {
  vanish: () => { latencyMs: number }
  onResize: (cb: () => void) => void
  flash: () => void
  updateProgress: (progress: number, elapsedMs: number, popup: EarningsPopup | null) => void
}

export interface DisplayApi {
  show(
    ttyPath: string,
    ad: CachedAd,
    ctx: { earningsUsdc?: number; source?: string; width?: number }
  ): DisplayHandleApi
}

export interface LoggerApi {
  debug(msg: string, fields?: Record<string, unknown>): void
  info(msg: string, fields?: Record<string, unknown>): void
  warn(msg: string, fields?: Record<string, unknown>): void
  error(msg: string, fields?: Record<string, unknown>): void
}

export type OpenUrl = (url: string) => void
export type FireBeacon = (url: string) => void

export interface OrchestratorDeps {
  adCache: AdCache
  ledger: Ledger
  display: DisplayApi
  keyCapture: KeyCapture
  openUrl: OpenUrl
  fireBeacon: FireBeacon
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

// S3-05: earnings popup lives inside the TV box at the top-right and
// pop-then-fades over TOAST_HOLD_MS. phase keys off how long since the popup
// started showing (elapsedMs - VALID_IMPRESSION_FOR_TOAST_MS):
//   [0, 500):        enter — bright + bold, reads as "pop"
//   [500, hold-500): hold  — bright green
//   [hold-500, hold): exit — dim, fading out
//   after hold:      null  — gone, row goes back to blank padding
function computePopup(elapsedMs: number, cpmRate: number, isApi: boolean): EarningsPopup | null {
  if (!isApi || cpmRate <= 0) return null
  if (elapsedMs < VALID_IMPRESSION_FOR_TOAST_MS) return null
  const popupElapsed = elapsedMs - VALID_IMPRESSION_FOR_TOAST_MS
  if (popupElapsed >= TOAST_HOLD_MS) return null
  const deltaUsdc = (cpmRate / 1000) * REVENUE_SHARE_DEVELOPER
  let phase: PopupPhase
  if (popupElapsed < 500) phase = "enter"
  else if (popupElapsed >= TOAST_HOLD_MS - 500) phase = "exit"
  else phase = "hold"
  return { deltaUsdc, phase }
}

export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  let state: State = { kind: "IDLE" }
  let graceTimer: NodeJS.Timeout | null = null
  let vanishTimer: NodeJS.Timeout | null = null
  let interAdTimer: NodeJS.Timeout | null = null
  let progressTimer: NodeJS.Timeout | null = null
  let currentDisplay: DisplayHandleApi | null = null
  let adsShownCount = 0
  let hooksReceivedCount = 0
  let preferences: DevdripPreferences = deps.preferences
  const now = deps.now ?? (() => Date.now())
  // re-anchored on every `clearSessionState` (i.e., each new Claude session)
  // so `sessionWarmupMs` actually applies per-session, not per daemon lifetime.
  let sessionStartAt = now()
  let sessionKilled = false
  let adsInCurrentBusyWindow = 0
  const hourlyTimestamps: number[] = []
  const dailyTimestamps: number[] = []

  // brief delay between a key/CLI action arriving and the state transition
  // firing, so the user sees the flash before the ad vanishes.
  const KEY_FLASH_DELAY_MS = 150

  function applyStep(event: Event): void {
    const result = step(state, event, { deviceId: deps.deviceId })
    state = result.state
    runEffects(result.effects)
  }

  // effects normally run synchronously, but `snapProgressToComplete` is a
  // "pause point": it forces the box to redraw at 100% and then defers every
  // following effect by PROGRESS_SNAP_HOLD_MS so the user actually sees the
  // full bar before vanish clears it.
  function runEffects(effects: Effect[]): void {
    for (let i = 0; i < effects.length; i++) {
      const eff = effects[i]
      if (!eff) continue
      if (eff.kind === "snapProgressToComplete") {
        if (currentDisplay) {
          try {
            // elapsedMs value doesn't matter here — progress=1 pins to 100%;
            // popup=null so the 100% frame is clean of any mid-animation state.
            currentDisplay.updateProgress(1.0, 0, null)
          } catch (err) {
            deps.log.warn("progress snap failed", { error: (err as Error).message })
          }
        }
        const tail = effects.slice(i + 1)
        setTimeout(() => runEffects(tail), PROGRESS_SNAP_HOLD_MS)
        return
      }
      runEffect(eff)
    }
  }

  function dispatch(event: Event): void {
    // count only socket-originated events (hooks), not internal timer callbacks.
    // this lets `devdrip daemon status` answer "are hooks reaching the daemon?".
    if (event.kind === "idle-start" || event.kind === "idle-end" || event.kind === "dismiss") {
      hooksReceivedCount += 1
    }
    if (event.kind === "idle-end" || event.kind === "dismiss") {
      adsInCurrentBusyWindow = 0
    }
    const isUserKey =
      event.kind === "discover-key" ||
      event.kind === "skip-key" ||
      event.kind === "kill-key" ||
      event.kind === "mute-key"
    if (isUserKey && currentDisplay) {
      // flash the ad box and wait briefly before transitioning, so the user
      // sees a green glow confirming their keystroke/CLI action was captured.
      try {
        currentDisplay.flash()
      } catch (err) {
        deps.log.warn("flash failed", { error: (err as Error).message })
      }
      setTimeout(() => applyStep(event), KEY_FLASH_DELAY_MS)
      return
    }
    applyStep(event)
  }

  function runEffect(effect: Effect): void {
    switch (effect.kind) {
      case "startGraceTimer":
        if (graceTimer) clearTimeout(graceTimer)
        graceTimer = setTimeout(() => {
          graceTimer = null
          const firedAt = now()
          const reason = suppressionReason(firedAt)
          if (reason) {
            deps.log.debug("ad suppressed by preferences", { reason })
            dispatch({ kind: "grace-elapsed", ad: null, now: firedAt })
            return
          }
          const ad = deps.adCache.next()
          if (!ad) deps.log.debug("grace elapsed with empty cache")
          dispatch({ kind: "grace-elapsed", ad, now: firedAt })
        }, effect.ms)
        return
      case "cancelGraceTimer":
        if (graceTimer) {
          clearTimeout(graceTimer)
          graceTimer = null
        }
        return
      case "startInterAdTimer":
        if (interAdTimer) clearTimeout(interAdTimer)
        interAdTimer = setTimeout(() => {
          interAdTimer = null
          const firedAt = now()
          const reason = suppressionReason(firedAt)
          if (reason) {
            deps.log.debug("inter-ad suppressed", { reason })
            dispatch({ kind: "inter-ad-elapsed", ad: null, now: firedAt })
            return
          }
          const ad = deps.adCache.next()
          dispatch({ kind: "inter-ad-elapsed", ad, now: firedAt })
        }, effect.ms)
        return
      case "cancelInterAdTimer":
        if (interAdTimer) {
          clearTimeout(interAdTimer)
          interAdTimer = null
        }
        return
      case "displayAd":
        if (!effect.tty) {
          deps.log.warn("display skipped: no tty path", { adId: effect.ad.id })
          queueMicrotask(() => dispatch({ kind: "dismiss", now: now() }))
          return
        }
        try {
          const source = effect.ad.cacheSource === "demo" ? "DEMO" : undefined
          currentDisplay = deps.display.show(effect.tty, effect.ad, { source })
          // on terminal resize, proactively dismiss the current ad — the
          // display has already reset its scroll region to prevent content
          // loss, and the next rotation tick will re-anchor with fresh rows.
          currentDisplay.onResize(() => {
            deps.log.info("resize detected — dismissing ad to re-anchor", {
              adId: effect.ad.id,
            })
            dispatch({ kind: "dismiss", now: now() })
          })
          deps.keyCapture.start(effect.tty)
          adsInCurrentBusyWindow += 1
          const nowMs = now()
          hourlyTimestamps.push(nowMs)
          dailyTimestamps.push(nowMs)
          deps.log.info("showing ad", {
            adId: effect.ad.id,
            source: effect.ad.cacheSource,
            displayTimeMs: effect.ad.displayTimeMs,
          })
        } catch (err) {
          deps.log.warn("display failed", {
            adId: effect.ad.id,
            error: (err as Error).message,
          })
          currentDisplay = null
          deps.keyCapture.stop()
          queueMicrotask(() => dispatch({ kind: "dismiss", now: now() }))
        }
        return
      case "startProgressTimer": {
        if (progressTimer) clearInterval(progressTimer)
        const shownAt = effect.shownAt
        const displayTimeMs = effect.displayTimeMs
        // snapshot ad identity fields for the tick closure so the popup
        // decision doesn't depend on state-machine state that may shift.
        const tickAdCpm = effect.ad?.cpmRate ?? 0
        const tickAdIsApi = (effect.ad?.cacheSource ?? "demo") === "api"
        progressTimer = setInterval(() => {
          if (!currentDisplay) return
          const elapsed = Math.max(0, now() - shownAt)
          const p = sigmoidProgress(elapsed, displayTimeMs)
          const popup = computePopup(elapsed, tickAdCpm, tickAdIsApi)
          try {
            currentDisplay.updateProgress(p, elapsed, popup)
          } catch (err) {
            deps.log.warn("progress tick failed", { error: (err as Error).message })
          }
        }, PROGRESS_TICK_MS)
        // unref so a lingering progress timer never holds the daemon open.
        progressTimer.unref?.()
        return
      }
      case "cancelProgressTimer":
        if (progressTimer) {
          clearInterval(progressTimer)
          progressTimer = null
        }
        return
      case "snapProgressToComplete":
        // handled in runEffects — reaching here means no ad display was
        // active (e.g. null-tty path) so there's nothing to snap.
        return
      case "startVanishTimer":
        if (vanishTimer) clearTimeout(vanishTimer)
        vanishTimer = setTimeout(() => {
          vanishTimer = null
          dispatch({ kind: "vanish-elapsed", now: now() })
        }, effect.ms)
        return
      case "cancelVanishTimer":
        if (vanishTimer) {
          clearTimeout(vanishTimer)
          vanishTimer = null
        }
        return
      case "vanishDisplay":
        deps.keyCapture.stop()
        // defensive cleanup — state machine always pairs vanish with an
        // explicit cancelProgressTimer, but clearing here too avoids a runaway
        // tick if a test dispatches vanishDisplay in isolation.
        if (progressTimer) {
          clearInterval(progressTimer)
          progressTimer = null
        }
        if (currentDisplay) {
          try {
            const { latencyMs } = currentDisplay.vanish()
            deps.log.info("vanish latency", { latencyMs })
          } catch (err) {
            deps.log.warn("vanish failed", { error: (err as Error).message })
          }
          currentDisplay = null
          // only count ads that were actually rendered; null-tty paths
          // synthesize a dismiss → vanishDisplay but nothing hit the screen.
          adsShownCount += 1
        }
        return
      case "recordImpression":
        handleRecord(effect.impression, effect.ad)
        return
      case "setSessionKilled":
        sessionKilled = true
        deps.log.info("session ads killed by user")
        return
      case "clearSessionState":
        sessionKilled = false
        adsInCurrentBusyWindow = 0
        sessionStartAt = now()
        deps.log.info("session state cleared")
        return
      case "writeMuteUntil":
        preferences = { ...preferences, muteUntil: effect.muteUntil }
        deps.writePreferences?.(preferences).catch((err: Error) => {
          deps.log.warn("mute persistence failed", { error: err.message })
        })
        deps.log.info("ads muted", { muteUntilMs: effect.muteUntil })
        return
      case "openDiscover": {
        try {
          deps.ledger.recordClick({
            id: randomUUID(),
            deliveryToken: effect.deliveryToken,
            createdAt: now(),
          })
        } catch (err) {
          deps.log.warn("click ledger write failed", { error: (err as Error).message })
        }
        if (effect.ad.clickTrackingUrl) deps.fireBeacon(effect.ad.clickTrackingUrl)
        try {
          deps.openUrl(effect.ad.url)
        } catch (err) {
          deps.log.warn("openUrl failed", { error: (err as Error).message })
        }
        return
      }
    }
  }

  function handleRecord(imp: LocalImpression, ad: CachedAd): void {
    if (imp.source === "demo") {
      deps.log.debug("skipping ledger write for demo ad", { adId: imp.adId })
      return
    }
    try {
      deps.ledger.record(imp)
      deps.log.info("vanished ad", {
        adId: imp.adId,
        result: imp.result,
        durationMs: imp.durationMs,
      })
    } catch (err) {
      deps.log.warn("ledger write failed", {
        adId: imp.adId,
        error: (err as Error).message,
      })
    }
    // Viewable-impression beacon: MRC desktop-display rule (≥1s on screen).
    if (imp.result !== "skipped" && imp.durationMs >= 1_000 && ad.impressionBeaconUrl) {
      deps.fireBeacon(ad.impressionBeaconUrl)
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

  function suppressionReason(nowMs: number): Reason | null {
    if (nowMs - sessionStartAt < preferences.sessionWarmupMs) return "warmup"
    const window = resolveQuietWindow(preferences)
    if (window) {
      const hour = localHour(nowMs, preferences.tzOffsetMinutes)
      if (isInQuietWindow(hour, window.start, window.end)) return "quiet-hours"
    }
    if (preferences.muteUntil && nowMs < preferences.muteUntil) return "muted"
    if (sessionKilled) return "killed"
    pruneCounters(nowMs)
    if (adsInCurrentBusyWindow >= MAX_ADS_PER_CONTINUOUS_SESSION) return "session-cap"
    if (hourlyTimestamps.length >= preferences.maxPerHour) return "hourly-cap"
    if (dailyTimestamps.length >= preferences.maxPerDay) return "daily-cap"
    return null
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
    if (graceTimer) clearTimeout(graceTimer)
    if (vanishTimer) clearTimeout(vanishTimer)
    if (interAdTimer) clearTimeout(interAdTimer)
    if (progressTimer) clearInterval(progressTimer)
    deps.keyCapture.stop()
    if (state.kind === "SHOWING" || state.kind === "INTER_AD") {
      dispatch({ kind: "dismiss", now: now() })
    }
  }

  return {
    dispatch,
    currentState: () => state,
    adsShown: () => adsShownCount,
    hooksReceived: () => hooksReceivedCount,
    updatePreferences,
    shutdown,
  }
}

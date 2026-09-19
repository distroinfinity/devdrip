import {
  NIGHT_MODE_DEFAULT_START_HOUR,
  NIGHT_MODE_DEFAULT_END_HOUR,
  type DevdripPreferences,
} from "@devdrip/shared"
import type { AdCache, CachedAd } from "../ad-cache.js"
import type { Ledger, LocalImpression } from "../ledger.js"
import { step, type Effect, type Event, type State } from "./state-machine.js"

export interface DisplayApi {
  show(ttyPath: string, ad: CachedAd): { vanish: () => void }
}

export interface LoggerApi {
  debug(msg: string, fields?: Record<string, unknown>): void
  info(msg: string, fields?: Record<string, unknown>): void
  warn(msg: string, fields?: Record<string, unknown>): void
  error(msg: string, fields?: Record<string, unknown>): void
}

export interface OrchestratorDeps {
  adCache: AdCache
  ledger: Ledger
  display: DisplayApi
  log: LoggerApi
  deviceId: string
  preferences: DevdripPreferences
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

export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  let state: State = { kind: "IDLE" }
  let graceTimer: NodeJS.Timeout | null = null
  let vanishTimer: NodeJS.Timeout | null = null
  let currentDisplay: { vanish: () => void } | null = null
  let adsShownCount = 0
  let hooksReceivedCount = 0
  let preferences: DevdripPreferences = deps.preferences
  const now = deps.now ?? (() => Date.now())
  const sessionStartAt = now()

  function dispatch(event: Event): void {
    // count only socket-originated events (hooks), not internal timer callbacks.
    // this lets `devdrip daemon status` answer "are hooks reaching the daemon?".
    if (event.kind === "idle-start" || event.kind === "idle-end" || event.kind === "dismiss") {
      hooksReceivedCount += 1
    }
    const result = step(state, event, { deviceId: deps.deviceId })
    state = result.state
    for (const effect of result.effects) runEffect(effect)
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
      case "displayAd":
        if (!effect.tty) {
          deps.log.warn("display skipped: no tty path", { adId: effect.ad.id })
          queueMicrotask(() => dispatch({ kind: "dismiss", now: Date.now() }))
          return
        }
        try {
          currentDisplay = deps.display.show(effect.tty, effect.ad)
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
          queueMicrotask(() => dispatch({ kind: "dismiss", now: Date.now() }))
        }
        return
      case "startVanishTimer":
        if (vanishTimer) clearTimeout(vanishTimer)
        vanishTimer = setTimeout(() => {
          vanishTimer = null
          dispatch({ kind: "vanish-elapsed", now: Date.now() })
        }, effect.ms)
        return
      case "cancelVanishTimer":
        if (vanishTimer) {
          clearTimeout(vanishTimer)
          vanishTimer = null
        }
        return
      case "vanishDisplay":
        if (currentDisplay) {
          try {
            currentDisplay.vanish()
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
        handleRecord(effect.impression)
        return
    }
  }

  function handleRecord(imp: LocalImpression): void {
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
  }

  function suppressionReason(nowMs: number): "warmup" | "quiet-hours" | null {
    if (nowMs - sessionStartAt < preferences.sessionWarmupMs) return "warmup"
    const window = resolveQuietWindow(preferences)
    if (window) {
      const hour = localHour(nowMs, preferences.tzOffsetMinutes)
      if (isInQuietWindow(hour, window.start, window.end)) return "quiet-hours"
    }
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
    if (state.kind === "SHOWING") {
      dispatch({ kind: "dismiss", now: Date.now() })
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

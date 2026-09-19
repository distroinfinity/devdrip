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
}

export interface Orchestrator {
  dispatch(event: Event): void
  currentState(): State
  adsShown(): number
  hooksReceived(): number
  shutdown(): Promise<void>
}

export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  let state: State = { kind: "IDLE" }
  let graceTimer: NodeJS.Timeout | null = null
  let vanishTimer: NodeJS.Timeout | null = null
  let currentDisplay: { vanish: () => void } | null = null
  let adsShownCount = 0
  let hooksReceivedCount = 0

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
          const ad = deps.adCache.next()
          if (!ad) deps.log.debug("grace elapsed with empty cache")
          dispatch({ kind: "grace-elapsed", ad, now: Date.now() })
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
    shutdown,
  }
}

import type { Ledger, LocalImpression, LocalClick } from "../ledger.js"
import { ApiError, postIngest, type IngestResponse } from "../api-client.js"

export interface SyncLogger {
  debug(msg: string, fields?: Record<string, unknown>): void
  info(msg: string, fields?: Record<string, unknown>): void
  warn(msg: string, fields?: Record<string, unknown>): void
  error(msg: string, fields?: Record<string, unknown>): void
}

export interface SyncResult {
  impressionsSynced: number
  clicksSynced: number
  errors: number
  terminal: number
}

export interface SyncLoop {
  start(): void
  stop(): Promise<void>
  forceSync(): Promise<SyncResult>
}

export interface SyncLoopDeps {
  ledger: Ledger
  log: SyncLogger
  intervalMs?: number
  post?: typeof postIngest
  now?: () => number
}

const DEFAULT_INTERVAL_MS = 5 * 60_000
const MAX_BACKOFF_MS = 20 * 60_000
const IMPRESSION_BATCH_CAP = 250
const CLICK_BATCH_CAP = 250
const CLICK_STALE_MS = 24 * 3600 * 1000

const TERMINAL_IMPRESSION_ERRORS = new Set([
  "invalid_or_expired_delivery_token",
  "delivery_token_too_old",
  "delivery_not_owned",
  "impression_already_recorded",
])

const TERMINAL_CLICK_ERRORS = new Set([
  "invalid_or_expired_delivery_token",
  "delivery_token_too_old",
  "delivery_not_owned",
  "click_already_recorded",
])

export function createSyncLoop(deps: SyncLoopDeps): SyncLoop {
  const intervalMs = deps.intervalMs ?? DEFAULT_INTERVAL_MS
  const post = deps.post ?? postIngest
  const now = deps.now ?? (() => Date.now())

  let timer: NodeJS.Timeout | null = null
  let inFlight: Promise<SyncResult> | null = null
  let backoffMs = 0

  async function runOnce(): Promise<SyncResult> {
    if (inFlight) {
      deps.log.debug("sync skipped: already in flight")
      return { impressionsSynced: 0, clicksSynced: 0, errors: 0, terminal: 0 }
    }
    const current = doRunOnce()
    inFlight = current
    try {
      return await current
    } finally {
      if (inFlight === current) inFlight = null
    }
  }

  async function doRunOnce(): Promise<SyncResult> {
    const impressions = deps.ledger.listUnsynced(IMPRESSION_BATCH_CAP)
    const clicks = deps.ledger.listUnsyncedClicks(CLICK_BATCH_CAP)
    if (impressions.length === 0 && clicks.length === 0) {
      backoffMs = 0
      return { impressionsSynced: 0, clicksSynced: 0, errors: 0, terminal: 0 }
    }

    let res: IngestResponse
    try {
      res = await post({
        impressions: impressions.map((i) => ({ deliveryToken: i.deliveryToken })),
        clicks: clicks.map((c) => ({ deliveryToken: c.deliveryToken })),
      })
    } catch (err) {
      backoffMs = nextBackoff(backoffMs)
      deps.log.warn("sync post failed", {
        error: (err as Error).message,
        backoffMs,
        status: err instanceof ApiError ? err.status : undefined,
      })
      throw err
    }

    return applyResults(impressions, clicks, res)
  }

  function applyResults(
    impressions: LocalImpression[],
    clicks: LocalClick[],
    res: IngestResponse
  ): SyncResult {
    const nowMs = now()
    const okImpressions: string[] = []
    const terminalImpressions: string[] = []
    const okClicks: string[] = []
    const terminalClicks: string[] = []
    let errors = 0

    for (let i = 0; i < impressions.length; i += 1) {
      const row = impressions[i]
      if (!row) continue
      const result = res.impressions[i]
      if (result?.ok) {
        okImpressions.push(row.id)
      } else if (result && TERMINAL_IMPRESSION_ERRORS.has(result.error ?? "")) {
        terminalImpressions.push(row.id)
        errors += 1
      } else {
        errors += 1
      }
    }

    for (let i = 0; i < clicks.length; i += 1) {
      const row = clicks[i]
      if (!row) continue
      const result = res.clicks[i]
      if (result?.ok) {
        okClicks.push(row.id)
      } else if (result && TERMINAL_CLICK_ERRORS.has(result.error ?? "")) {
        terminalClicks.push(row.id)
        errors += 1
      } else {
        // `impression_not_synced` stays transient until the click is 24h old,
        // then tombstone it rather than retry forever.
        if (result?.error === "impression_not_synced" && nowMs - row.createdAt > CLICK_STALE_MS) {
          terminalClicks.push(row.id)
        }
        errors += 1
      }
    }

    if (okImpressions.length) deps.ledger.markSynced(okImpressions, nowMs)
    if (terminalImpressions.length) deps.ledger.markImpressionsTerminal(terminalImpressions)
    if (okClicks.length) deps.ledger.markClicksSynced(okClicks, nowMs)
    if (terminalClicks.length) deps.ledger.markClicksTerminal(terminalClicks)

    backoffMs = 0
    deps.log.info("sync cycle complete", {
      impressions: okImpressions.length,
      clicks: okClicks.length,
      errors,
      terminalImpressions: terminalImpressions.length,
      terminalClicks: terminalClicks.length,
    })
    return {
      impressionsSynced: okImpressions.length,
      clicksSynced: okClicks.length,
      errors,
      terminal: terminalImpressions.length + terminalClicks.length,
    }
  }

  function nextBackoff(current: number): number {
    if (current === 0) return 5 * 60_000
    return Math.min(current * 2, MAX_BACKOFF_MS)
  }

  function scheduleNext(): void {
    const ms = backoffMs > 0 ? backoffMs : intervalMs
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      runOnce()
        .catch(() => {})
        .finally(scheduleNext)
    }, ms)
    timer.unref?.()
  }

  return {
    start(): void {
      // eager first sync on boot — ledger likely has a queue.
      runOnce()
        .catch(() => {})
        .finally(scheduleNext)
    },
    async stop(): Promise<void> {
      if (timer) clearTimeout(timer)
      timer = null
      const pending = inFlight
      if (pending) {
        try {
          await pending
        } catch {
          // swallow — sync failures already logged inside runOnce
        }
      }
    },
    forceSync(): Promise<SyncResult> {
      return runOnce()
    },
  }
}

import type { Ledger, LocalImpression, LocalClick, LocalNewsImpression } from "../ledger.js"
import { ApiError, postIngest, postReadingSave, type IngestResponse } from "../api-client.js"
import { syncPreferencesOnce } from "./prefs-sync.js"

export interface SyncLogger {
  debug(msg: string, fields?: Record<string, unknown>): void
  info(msg: string, fields?: Record<string, unknown>): void
  warn(msg: string, fields?: Record<string, unknown>): void
  error(msg: string, fields?: Record<string, unknown>): void
}

export interface SyncResult {
  impressionsSynced: number
  clicksSynced: number
  newsImpressionsSynced: number
  readingSavesSynced: number
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
  prefsIntervalMs?: number
  post?: typeof postIngest
  syncPreferences?: typeof syncPreferencesOnce
  now?: () => number
}

const DEFAULT_INTERVAL_MS = 5 * 60_000
// Per ticket S4-06: prefs round-trip every 30 min. Piggybacks on the ingest
// tick so we don't need a second timer; the loop checks `now - lastPrefsAt`.
const DEFAULT_PREFS_INTERVAL_MS = 30 * 60_000
const MAX_BACKOFF_MS = 20 * 60_000
const IMPRESSION_BATCH_CAP = 250
const CLICK_BATCH_CAP = 250
const CLICK_STALE_MS = 24 * 3600 * 1000
const NEWS_IMPRESSION_BATCH_CAP = 250
const READING_BATCH_CAP = 50

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
  const prefsIntervalMs = deps.prefsIntervalMs ?? DEFAULT_PREFS_INTERVAL_MS
  const post = deps.post ?? postIngest
  const syncPrefs = deps.syncPreferences ?? syncPreferencesOnce
  const now = deps.now ?? (() => Date.now())

  let timer: NodeJS.Timeout | null = null
  let inFlight: Promise<SyncResult> | null = null
  let backoffMs = 0
  let lastPrefsAt = 0

  async function runOnce(): Promise<SyncResult> {
    if (inFlight) {
      deps.log.debug("sync skipped: already in flight")
      return {
        impressionsSynced: 0,
        clicksSynced: 0,
        newsImpressionsSynced: 0,
        readingSavesSynced: 0,
        errors: 0,
        terminal: 0,
      }
    }
    const current = doRunOnce()
    inFlight = current
    try {
      let result: SyncResult
      try {
        result = await current
      } finally {
        // Prefs sync runs even when ingest fails so a flaky ingest path
        // doesn't starve prefs reconciliation. Errors are swallowed; the
        // helper logs and the next tick retries.
        if (now() - lastPrefsAt >= prefsIntervalMs) {
          lastPrefsAt = now()
          try {
            await syncPrefs(deps.log)
          } catch (err) {
            deps.log.warn("prefs sync threw", { error: (err as Error).message })
          }
        }
      }
      return result
    } finally {
      if (inFlight === current) inFlight = null
    }
  }

  async function doRunOnce(): Promise<SyncResult> {
    // post-pivot: ad impressions/clicks are gone. listUnsynced + listUnsyncedClicks
    // will always return [] but we still call them so the ledger stays coherent if
    // a legacy ledger row somehow exists.
    const impressions = deps.ledger.listUnsynced(IMPRESSION_BATCH_CAP)
    const clicks = deps.ledger.listUnsyncedClicks(CLICK_BATCH_CAP)
    const newsImpressions = deps.ledger.listUnsyncedNewsImpressions(NEWS_IMPRESSION_BATCH_CAP)

    let ingestResult: Omit<SyncResult, "readingSavesSynced"> = {
      impressionsSynced: 0,
      clicksSynced: 0,
      newsImpressionsSynced: 0,
      errors: 0,
      terminal: 0,
    }

    if (newsImpressions.length > 0) {
      let res: IngestResponse
      try {
        const body = {
          // M1: only newsImpressions go to the server. impressions/clicks are
          // dead post-pivot; omit them to keep the request body clean.
          impressions: [] as { deliveryToken: string }[],
          clicks: [] as { deliveryToken: string }[],
          newsImpressions: newsImpressions.map((n) => ({
            newsId: n.newsId,
            source: n.source,
            deviceId: n.deviceId,
            durationMs: n.durationMs,
            result: n.result,
            openedUrl: n.openedUrl,
            saved: n.saved,
          })),
        }
        res = await post(body)
      } catch (err) {
        backoffMs = nextBackoff(backoffMs)
        deps.log.warn("sync post failed", {
          error: (err as Error).message,
          backoffMs,
          status: err instanceof ApiError ? err.status : undefined,
        })
        throw err
      }
      ingestResult = applyResults(impressions, clicks, newsImpressions, res)
    } else {
      backoffMs = 0
    }

    // reading saves wait for the next tick if /ingest threw — saves are less urgent
    // than impressions and the server is idempotent on retry.
    const readingSavesSynced = await flushReadingSaves().catch(() => 0)
    return { ...ingestResult, readingSavesSynced }
  }

  async function flushReadingSaves(): Promise<number> {
    const pending = deps.ledger.listPendingReadingItems(READING_BATCH_CAP)
    let synced = 0
    for (const item of pending) {
      try {
        await postReadingSave({
          newsId: item.newsId,
          source: item.source,
          headline: item.headline,
          url: item.url,
          score: item.score,
        })
        deps.ledger.markReadingItemsSynced([item.id], now())
        synced += 1
      } catch (err) {
        deps.log.warn("reading save sync failed", {
          id: item.id,
          error: (err as Error).message,
        })
        // don't break — try next item; server is idempotent so retries are safe
      }
    }
    return synced
  }

  function applyResults(
    impressions: LocalImpression[],
    clicks: LocalClick[],
    newsImpressions: LocalNewsImpression[],
    res: IngestResponse
  ): Omit<SyncResult, "readingSavesSynced"> {
    const nowMs = now()
    const okImpressions: string[] = []
    const terminalImpressions: string[] = []
    const okClicks: string[] = []
    const terminalClicks: string[] = []
    const okNewsImpressions: string[] = []
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

    const newsResults = res.newsImpressions ?? []
    for (let i = 0; i < newsImpressions.length; i += 1) {
      const row = newsImpressions[i]
      if (!row) continue
      const result = newsResults[i]
      if (result?.ok) {
        okNewsImpressions.push(row.id)
      } else {
        errors += 1
        // silent retry — no terminal path for news impressions yet
      }
    }

    if (okImpressions.length) deps.ledger.markSynced(okImpressions, nowMs)
    if (terminalImpressions.length) deps.ledger.markImpressionsTerminal(terminalImpressions)
    if (okClicks.length) deps.ledger.markClicksSynced(okClicks, nowMs)
    if (terminalClicks.length) deps.ledger.markClicksTerminal(terminalClicks)
    if (okNewsImpressions.length) deps.ledger.markNewsImpressionsSynced(okNewsImpressions, nowMs)

    backoffMs = 0
    deps.log.info("sync cycle complete", {
      impressions: okImpressions.length,
      clicks: okClicks.length,
      newsImpressions: okNewsImpressions.length,
      errors,
      terminalImpressions: terminalImpressions.length,
      terminalClicks: terminalClicks.length,
    })
    return {
      impressionsSynced: okImpressions.length,
      clicksSynced: okClicks.length,
      newsImpressionsSynced: okNewsImpressions.length,
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

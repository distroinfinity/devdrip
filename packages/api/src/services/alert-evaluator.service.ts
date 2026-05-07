import { eq, and, gt, sql } from "drizzle-orm"
import type { PendingAlert } from "@distrotv/shared"
import { getDb } from "../db/index.js"
import { alerts } from "../db/schema/alerts.js"
import { alertEvents } from "../db/schema/alert_events.js"
import { devices } from "../db/schema/devices.js"
import { tickerQuotes } from "../db/schema/ticker_quotes.js"
import { watchlists } from "../db/schema/watchlists.js"
import { watchlistTickers } from "../db/schema/watchlist_tickers.js"
import { getRedis } from "../lib/redis.js"
import { pendingAlertsKey } from "../lib/alert-keys.js"
import { logger } from "../lib/logger.js"

const PENDING_TTL_SEC = 60 * 60 // 60 minutes — same as the debounce window

const DEFAULT_GLOBAL_THRESHOLD_PCT = 5

interface UserAlertConfig {
  global: number
  byTicker: Map<string, number>
}

interface AlertCandidate {
  userId: string
  symbol: string
  changePct: number
  thresholdPct: number
}

// Runs after each ticker fetch tick. Walks every (user, watched-symbol) pair, applies
// the user's effective threshold, and fires any breach that hasn't fired in the last 60 min
// for the same (device, symbol) pair. Best-effort: failures are logged and do not propagate.
export async function runAlertEvaluation(): Promise<void> {
  const candidates = await loadCandidates()
  if (candidates.length === 0) return

  let firedCount = 0
  for (const c of candidates) {
    if (Math.abs(c.changePct) < c.thresholdPct) continue
    try {
      const fired = await fireForUser(c)
      firedCount += fired
    } catch (err) {
      logger.error(
        { err: String(err), userId: c.userId, symbol: c.symbol },
        "alert.fire failed for candidate — continuing"
      )
    }
  }
  if (firedCount > 0) {
    logger.info({ firedCount, candidates: candidates.length }, "alert evaluator complete")
  }
}

async function loadCandidates(): Promise<AlertCandidate[]> {
  const db = getDb()

  // pull all alert rules across users. small at 100-user scale (≤ 26 rows/user).
  const allAlerts = await db.select().from(alerts)
  const byUser = new Map<string, UserAlertConfig>()
  for (const a of allAlerts) {
    let cfg = byUser.get(a.userId)
    if (!cfg) {
      cfg = { global: DEFAULT_GLOBAL_THRESHOLD_PCT, byTicker: new Map() }
      byUser.set(a.userId, cfg)
    }
    if (a.scope === "global") cfg.global = a.thresholdPct
    else if (a.scope === "per_ticker" && a.symbol) cfg.byTicker.set(a.symbol, a.thresholdPct)
  }

  // join watchlist_tickers ↔ watchlists ↔ ticker_quotes to get (user, symbol, change_pct).
  // skip stale quotes — don't fire on cached/last-known data after a fetch failure.
  const rows = await db
    .select({
      userId: watchlists.userId,
      symbol: watchlistTickers.symbol,
      changePct: tickerQuotes.changePct,
      stale: tickerQuotes.stale,
    })
    .from(watchlistTickers)
    .innerJoin(watchlists, eq(watchlists.id, watchlistTickers.watchlistId))
    .innerJoin(tickerQuotes, eq(tickerQuotes.symbol, watchlistTickers.symbol))

  const out: AlertCandidate[] = []
  for (const r of rows) {
    if (r.stale) continue
    let cfg = byUser.get(r.userId)
    if (!cfg) cfg = { global: DEFAULT_GLOBAL_THRESHOLD_PCT, byTicker: new Map() }
    const threshold = cfg.byTicker.get(r.symbol) ?? cfg.global
    out.push({
      userId: r.userId,
      symbol: r.symbol,
      changePct: r.changePct,
      thresholdPct: threshold,
    })
  }
  return out
}

// returns the count of devices the alert was successfully fanned out to.
async function fireForUser(c: AlertCandidate): Promise<number> {
  const db = getDb()
  const redis = getRedis()
  const userDevices = await db
    .select({ id: devices.id })
    .from(devices)
    .where(eq(devices.userId, c.userId))

  if (userDevices.length === 0) return 0

  let fanned = 0
  for (const d of userDevices) {
    try {
      const recent = await db
        .select({ id: alertEvents.id })
        .from(alertEvents)
        .where(
          and(
            eq(alertEvents.deviceId, d.id),
            eq(alertEvents.symbol, c.symbol),
            gt(alertEvents.firedAt, sql`now() - interval '60 minutes'`)
          )
        )
        .limit(1)
      if (recent.length > 0) continue // 60-min per-(device, symbol) debounce; lenient at boundary (re-fires at 60:00)

      const firedAt = new Date()
      const pending: PendingAlert = {
        symbol: c.symbol,
        changePct: c.changePct,
        thresholdPct: c.thresholdPct,
        firedAt: firedAt.toISOString(),
      }
      // lpush + expire FIRST so a failed redis call does not consume the debounce window.
      // worst case if insert below fails: payload sits in redis for the user (delivered),
      // debounce row missing → next tick may re-fire if condition persists (acceptable).
      // alternative ordering would silently swallow alerts when redis flakes.
      await redis.lpush(pendingAlertsKey(d.id), pending)
      await redis.expire(pendingAlertsKey(d.id), PENDING_TTL_SEC)
      await db.insert(alertEvents).values({
        userId: c.userId,
        deviceId: d.id,
        symbol: c.symbol,
        changePct: c.changePct,
        thresholdPct: c.thresholdPct,
        firedAt,
      })
      fanned++
    } catch (err) {
      logger.error(
        { err: String(err), userId: c.userId, deviceId: d.id, symbol: c.symbol },
        "alert.fire failed for device — continuing"
      )
    }
  }
  if (fanned > 0) {
    logger.info(
      { userId: c.userId, symbol: c.symbol, changePct: c.changePct, devices: fanned },
      "alert.fire"
    )
  }
  return fanned
}

import { eq, sql } from "drizzle-orm"
import type { AlertDto, AlertScope } from "@distrotv/shared"
import { getDb } from "../db/index.js"
import { alerts } from "../db/schema/alerts.js"

const DEFAULT_GLOBAL_THRESHOLD_PCT = 5
const PER_TICKER_OVERRIDES_MAX = 25
const MIN_THRESHOLD = 0.5
const MAX_THRESHOLD = 50

export const ALERT_LIMITS = {
  PER_TICKER_OVERRIDES_MAX,
  MIN_THRESHOLD,
  MAX_THRESHOLD,
}

export async function ensureGlobalAlert(userId: string): Promise<void> {
  const db = getDb()
  // first-time only: if any rule exists for the user, skip. mirrors the m3/m4 ensure-defaults pattern.
  const [existing] = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(eq(alerts.userId, userId))
    .limit(1)
  if (existing) return

  try {
    await db.insert(alerts).values({
      userId,
      symbol: null,
      scope: "global",
      thresholdPct: DEFAULT_GLOBAL_THRESHOLD_PCT,
    })
  } catch (err) {
    // 23505 (unique violation) — race between two concurrent first-GETs. winner wrote, we no-op.
    if (isUniqueViolation(err)) return
    throw err
  }
}

export async function listAlertsForUser(userId: string): Promise<AlertDto[]> {
  const db = getDb()
  await ensureGlobalAlert(userId)
  const rows = await db
    .select()
    .from(alerts)
    .where(eq(alerts.userId, userId))
    .orderBy(sql`${alerts.scope} ASC, ${alerts.symbol} NULLS FIRST, ${alerts.symbol} ASC`)

  return rows.map((r) => ({
    id: r.id,
    scope: r.scope as AlertScope,
    symbol: r.symbol,
    thresholdPct: r.thresholdPct,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
}

export interface AlertReplacement {
  scope: AlertScope
  symbol: string | null
  thresholdPct: number
}

export async function setAlerts(userId: string, replacement: AlertReplacement[]): Promise<void> {
  const globals = replacement.filter((a) => a.scope === "global")
  if (globals.length > 1) throw new Error("setAlerts: at most one global rule per user")
  const perTicker = replacement.filter((a) => a.scope === "per_ticker")
  if (perTicker.length > PER_TICKER_OVERRIDES_MAX) {
    throw new Error(`setAlerts: max ${PER_TICKER_OVERRIDES_MAX} per-ticker overrides`)
  }
  for (const a of replacement) {
    if (a.thresholdPct < MIN_THRESHOLD || a.thresholdPct > MAX_THRESHOLD) {
      throw new Error(`setAlerts: threshold out of range [${MIN_THRESHOLD}, ${MAX_THRESHOLD}]`)
    }
    if (a.scope === "global" && a.symbol !== null) {
      throw new Error("setAlerts: scope=global requires symbol=null")
    }
    if (a.scope === "per_ticker" && (a.symbol === null || a.symbol.length === 0)) {
      throw new Error("setAlerts: scope=per_ticker requires non-empty symbol")
    }
  }

  const db = getDb()
  return db.transaction(async (tx) => {
    // wipe-and-rewrite — full replacement semantics, same as channels/watchlists.
    await tx.delete(alerts).where(eq(alerts.userId, userId))

    if (replacement.length === 0) {
      // an empty replacement re-creates the global default so the user is never alert-free.
      await tx.insert(alerts).values({
        userId,
        symbol: null,
        scope: "global",
        thresholdPct: DEFAULT_GLOBAL_THRESHOLD_PCT,
      })
      return
    }
    await tx.insert(alerts).values(
      replacement.map((a) => ({
        userId,
        symbol: a.symbol,
        scope: a.scope,
        thresholdPct: a.thresholdPct,
        updatedAt: new Date(),
      }))
    )
  })
}

// returns the threshold to apply for (user, symbol). per_ticker override beats global; falls back
// to the in-code DEFAULT if the user has no rules at all (shouldn't happen post-ensureGlobal).
export async function effectiveThreshold(userId: string, symbol: string): Promise<number> {
  const db = getDb()
  const rows = await db.select().from(alerts).where(eq(alerts.userId, userId))

  let global = DEFAULT_GLOBAL_THRESHOLD_PCT
  for (const r of rows) {
    if (r.scope === "per_ticker" && r.symbol === symbol) return r.thresholdPct
    if (r.scope === "global" && r.symbol === null) global = r.thresholdPct
  }
  return global
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false
  const code = (err as { code?: unknown }).code
  if (code === "23505") return true
  const cause = (err as { cause?: unknown }).cause
  if (cause) return isUniqueViolation(cause)
  return false
}

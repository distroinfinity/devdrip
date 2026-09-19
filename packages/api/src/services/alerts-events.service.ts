import { eq, desc } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { alertEvents } from "../db/schema/alert_events.js"

export interface AlertEventRow {
  id: string
  symbol: string
  changePct: number
  thresholdPct: number
  firedAt: string
}

export async function getAlertEvents(userId: string, limit: number): Promise<AlertEventRow[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: alertEvents.id,
      symbol: alertEvents.symbol,
      changePct: alertEvents.changePct,
      thresholdPct: alertEvents.thresholdPct,
      firedAt: alertEvents.firedAt,
    })
    .from(alertEvents)
    .where(eq(alertEvents.userId, userId))
    .orderBy(desc(alertEvents.firedAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    changePct: r.changePct,
    thresholdPct: r.thresholdPct,
    firedAt: r.firedAt.toISOString(),
  }))
}

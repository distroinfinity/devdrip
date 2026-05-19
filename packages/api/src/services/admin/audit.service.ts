import { desc, gte, eq } from "drizzle-orm"
import { getDb } from "../../db/index.js"
import { alertEvents } from "../../db/schema/alert_events.js"
import { users } from "../../db/schema/users.js"

export interface AuditEventDto {
  id: string
  firedAt: string
  userId: string
  email: string | null
  symbol: string
  changePct: number
  thresholdPct: number
  deviceId: string | null
}

export async function getAuditEvents(
  limit: number,
  sinceISO: string | null
): Promise<AuditEventDto[]> {
  const db = getDb()
  const since = sinceISO ? new Date(sinceISO) : null

  const baseSelect = {
    id: alertEvents.id,
    firedAt: alertEvents.firedAt,
    userId: alertEvents.userId,
    email: users.email,
    symbol: alertEvents.symbol,
    changePct: alertEvents.changePct,
    thresholdPct: alertEvents.thresholdPct,
    deviceId: alertEvents.deviceId,
  }

  const rows = since
    ? await db
        .select(baseSelect)
        .from(alertEvents)
        .leftJoin(users, eq(users.id, alertEvents.userId))
        .where(gte(alertEvents.firedAt, since))
        .orderBy(desc(alertEvents.firedAt))
        .limit(limit)
    : await db
        .select(baseSelect)
        .from(alertEvents)
        .leftJoin(users, eq(users.id, alertEvents.userId))
        .orderBy(desc(alertEvents.firedAt))
        .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    firedAt: r.firedAt.toISOString(),
    userId: r.userId,
    email: r.email,
    symbol: r.symbol,
    changePct: r.changePct,
    thresholdPct: r.thresholdPct,
    deviceId: r.deviceId,
  }))
}

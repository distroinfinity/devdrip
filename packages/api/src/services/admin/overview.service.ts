import { sql, desc, gte } from "drizzle-orm"
import { getDb } from "../../db/index.js"
import { users } from "../../db/schema/users.js"
import { slotImpressions } from "../../db/schema/slot_impressions.js"
import { alertEvents } from "../../db/schema/alert_events.js"

export interface OverviewDto {
  counts: { users: number; slots7d: number; alerts7d: number }
  signupsLast7d: {
    byDay: Array<{ day: string; count: number }>
    recent: Array<{ id: string; email: string | null; createdAt: string }>
  }
  modeDistribution: Array<{ mode: string; count: number }>
  recentAlerts: Array<{
    id: string
    userId: string
    symbol: string
    changePct: number
    thresholdPct: number
    firedAt: string
  }>
}

export async function getOverview(): Promise<OverviewDto> {
  const db = getDb()
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  // postgres-js driver rejects Date objects inside raw sql`` templates — pass ISO.
  // drizzle's .where(gte(col, date)) handles serialization itself, so the date
  // object is fine where the query-builder is invoked directly.
  const since7dIso = since7d.toISOString()

  const [usersCountRow] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(users)
  const [slots7dRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(slotImpressions)
    .where(gte(slotImpressions.createdAt, since7d))
  const [alerts7dRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(alertEvents)
    .where(gte(alertEvents.firedAt, since7d))

  const signupsByDayRaw = await db.execute(sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
    FROM users
    WHERE created_at >= ${since7dIso}
    GROUP BY day
    ORDER BY day ASC
  `)
  const recentSignups = await db
    .select({ id: users.id, email: users.email, createdAt: users.createdAt })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(10)

  const modesRaw = await db.execute(sql`
    SELECT channel_mode AS mode, COUNT(*)::int AS count
    FROM preferences
    GROUP BY channel_mode
    ORDER BY count DESC
  `)

  const recentAlerts = await db
    .select({
      id: alertEvents.id,
      userId: alertEvents.userId,
      symbol: alertEvents.symbol,
      changePct: alertEvents.changePct,
      thresholdPct: alertEvents.thresholdPct,
      firedAt: alertEvents.firedAt,
    })
    .from(alertEvents)
    .orderBy(desc(alertEvents.firedAt))
    .limit(25)

  // same row-shape extraction for both Neon HTTP ({ rows: [...] }) and pg (array directly)
  const signupsByDay = ((signupsByDayRaw as unknown as { rows?: unknown[] }).rows ??
    (signupsByDayRaw as unknown as unknown[])) as Array<{ day: string; count: number }>
  const modeDistribution = ((modesRaw as unknown as { rows?: unknown[] }).rows ??
    (modesRaw as unknown as unknown[])) as Array<{ mode: string; count: number }>

  return {
    counts: {
      users: usersCountRow?.count ?? 0,
      slots7d: slots7dRow?.count ?? 0,
      alerts7d: alerts7dRow?.count ?? 0,
    },
    signupsLast7d: {
      byDay: signupsByDay,
      recent: recentSignups.map((r) => ({
        id: r.id,
        email: r.email ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    modeDistribution,
    recentAlerts: recentAlerts.map((a) => ({
      id: a.id,
      userId: a.userId,
      symbol: a.symbol,
      changePct: a.changePct,
      thresholdPct: a.thresholdPct,
      firedAt: a.firedAt.toISOString(),
    })),
  }
}

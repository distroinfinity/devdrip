import { eq, desc, sql } from "drizzle-orm"
import { getDb } from "../../db/index.js"
import { users } from "../../db/schema/users.js"
import { devices } from "../../db/schema/devices.js"
import { preferences } from "../../db/schema/preferences.js"
import { channelSubscriptions } from "../../db/schema/channel_subscriptions.js"
import { watchlists } from "../../db/schema/watchlists.js"
import { watchlistTickers } from "../../db/schema/watchlist_tickers.js"
import { alerts } from "../../db/schema/alerts.js"
import { alertEvents } from "../../db/schema/alert_events.js"
import { slotImpressions } from "../../db/schema/slot_impressions.js"

export async function listUsers(page: number, limit: number) {
  const db = getDb()
  const offset = (page - 1) * limit
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt,
      mode: preferences.channelMode,
      lastActivity: sql<Date | null>`(SELECT MAX(${slotImpressions.createdAt}) FROM ${slotImpressions} WHERE ${slotImpressions.userId} = ${users.id})`,
      channelCount: sql<number>`(SELECT COUNT(*)::int FROM ${channelSubscriptions} WHERE ${channelSubscriptions.userId} = ${users.id})`,
      watchlistSize: sql<number>`(SELECT COUNT(*)::int FROM ${watchlistTickers} JOIN ${watchlists} ON ${watchlists.id} = ${watchlistTickers.watchlistId} WHERE ${watchlists.userId} = ${users.id})`,
      deviceCount: sql<number>`(SELECT COUNT(*)::int FROM ${devices} WHERE ${devices.userId} = ${users.id})`,
      alertsFired7d: sql<number>`(SELECT COUNT(*)::int FROM ${alertEvents} WHERE ${alertEvents.userId} = ${users.id} AND ${alertEvents.firedAt} >= ${since7d})`,
    })
    .from(users)
    .leftJoin(preferences, eq(preferences.userId, users.id))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset)

  const totalRow = await db.select({ count: sql<number>`COUNT(*)::int` }).from(users)
  return { users: rows, total: totalRow[0]?.count ?? 0, page, limit }
}

export async function getUserDrilldown(userId: string) {
  const db = getDb()
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return null

  const [prefs] = await db.select().from(preferences).where(eq(preferences.userId, userId)).limit(1)
  const userDevices = await db.select().from(devices).where(eq(devices.userId, userId))
  const subs = await db
    .select()
    .from(channelSubscriptions)
    .where(eq(channelSubscriptions.userId, userId))
  const [wl] = await db.select().from(watchlists).where(eq(watchlists.userId, userId)).limit(1)
  const tickers = wl
    ? await db.select().from(watchlistTickers).where(eq(watchlistTickers.watchlistId, wl.id))
    : []
  const userAlerts = await db.select().from(alerts).where(eq(alerts.userId, userId))
  const recentAlertEvents = await db
    .select()
    .from(alertEvents)
    .where(eq(alertEvents.userId, userId))
    .orderBy(desc(alertEvents.firedAt))
    .limit(10)
  const recentImpressions = await db
    .select()
    .from(slotImpressions)
    .where(eq(slotImpressions.userId, userId))
    .orderBy(desc(slotImpressions.createdAt))
    .limit(25)

  return {
    user,
    preferences: prefs ?? null,
    devices: userDevices,
    channelSubscriptions: subs,
    watchlistTickers: tickers,
    alerts: userAlerts,
    recentAlertEvents,
    recentImpressions,
  }
}

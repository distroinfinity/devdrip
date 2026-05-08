import { eq, gte, and, desc } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { slotImpressions } from "../db/schema/slot_impressions.js"
import { alertEvents } from "../db/schema/alert_events.js"
import type { ActivitySummaryDto, ActivitySummaryEvent } from "@distrotv/shared"

const KIND_TO_WEIGHT: Record<string, 1 | 2 | 3> = { news: 1, ticker: 2, alert: 3 }

export async function getActivitySummary(
  userId: string,
  windowSec: number
): Promise<ActivitySummaryDto> {
  const db = getDb()
  const since = new Date(Date.now() - windowSec * 1000)

  const [impressions, alerts] = await Promise.all([
    db
      .select({ ts: slotImpressions.createdAt, kind: slotImpressions.kind })
      .from(slotImpressions)
      .where(and(eq(slotImpressions.userId, userId), gte(slotImpressions.createdAt, since)))
      .orderBy(desc(slotImpressions.createdAt)),
    db
      .select({ ts: alertEvents.firedAt })
      .from(alertEvents)
      .where(and(eq(alertEvents.userId, userId), gte(alertEvents.firedAt, since)))
      .orderBy(desc(alertEvents.firedAt)),
  ])

  const events: ActivitySummaryEvent[] = []
  for (const i of impressions) {
    // slot_impressions.kind enum is "news"|"ticker"|"sponsored"|"portfolio" — map to news/ticker for the tape
    const k: "news" | "ticker" = i.kind === "news" ? "news" : "ticker"
    events.push({ ts: i.ts.toISOString(), kind: k, weight: KIND_TO_WEIGHT[k] ?? 1 })
  }
  for (const a of alerts) {
    events.push({ ts: a.ts.toISOString(), kind: "alert", weight: 3 })
  }
  events.sort((a, b) => b.ts.localeCompare(a.ts))

  const totals = {
    news: events.filter((e) => e.kind === "news").length,
    ticker: events.filter((e) => e.kind === "ticker").length,
    alert: events.filter((e) => e.kind === "alert").length,
    uptime_days: 14, // placeholder — adequate for v1
  }

  return { windowSec, events, totals }
}

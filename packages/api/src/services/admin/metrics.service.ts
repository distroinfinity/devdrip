import { sql } from "drizzle-orm"
import { getDb } from "../../db/index.js"

export interface MetricsDto {
  slotsByDay: Array<{ day: string; news: number; ticker: number; alert: number }>
  saveRateByDay: Array<{ day: string; rate: number }>
  modeDistribution: Array<{ mode: string; count: number }>
  newsCtrBySource: Array<{ source: string; impressions: number; opened: number; ctr: number }>
  alertsByDay: Array<{ day: string; count: number }>
}

function extractRows<T>(result: unknown): T[] {
  return ((result as { rows?: unknown[] }).rows ?? (result as unknown[])) as T[]
}

export async function getMetrics(days: number): Promise<MetricsDto> {
  const db = getDb()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const slotsByDayRaw = await db.execute(sql`
    SELECT
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
      COUNT(*) FILTER (WHERE kind = 'news')::int AS news,
      COUNT(*) FILTER (WHERE kind = 'ticker')::int AS ticker
    FROM slot_impressions
    WHERE created_at >= ${since}
    GROUP BY day
    ORDER BY day ASC
  `)
  const alertsByDayRaw = await db.execute(sql`
    SELECT
      to_char(date_trunc('day', fired_at), 'YYYY-MM-DD') AS day,
      COUNT(*)::int AS count
    FROM alert_events
    WHERE fired_at >= ${since}
    GROUP BY day
    ORDER BY day ASC
  `)
  const saveRateByDayRaw = await db.execute(sql`
    SELECT
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
      CASE WHEN COUNT(*) FILTER (WHERE kind = 'news') > 0
        THEN COUNT(*) FILTER (WHERE kind = 'news' AND saved)::float / COUNT(*) FILTER (WHERE kind = 'news')::float
        ELSE 0 END AS rate
    FROM slot_impressions
    WHERE created_at >= ${since}
    GROUP BY day
    ORDER BY day ASC
  `)
  const modeDistributionRaw = await db.execute(sql`
    SELECT channel_mode AS mode, COUNT(*)::int AS count
    FROM preferences
    GROUP BY channel_mode
    ORDER BY count DESC
  `)
  const newsCtrBySourceRaw = await db.execute(sql`
    SELECT source,
      COUNT(*)::int AS impressions,
      COUNT(*) FILTER (WHERE opened_url)::int AS opened,
      CASE WHEN COUNT(*) > 0
        THEN (COUNT(*) FILTER (WHERE opened_url)::float / COUNT(*)::float)
        ELSE 0 END AS ctr
    FROM slot_impressions
    WHERE kind = 'news' AND created_at >= ${since}
    GROUP BY source
    ORDER BY impressions DESC
  `)

  const slotsByDayBase = extractRows<{ day: string; news: number; ticker: number }>(slotsByDayRaw)
  const alertsByDay = extractRows<{ day: string; count: number }>(alertsByDayRaw)
  const alertsByDayMap = new Map<string, number>(alertsByDay.map((r) => [r.day, r.count]))

  const slotsByDay = slotsByDayBase.map((r) => ({
    day: r.day,
    news: r.news,
    ticker: r.ticker,
    alert: alertsByDayMap.get(r.day) ?? 0,
  }))

  return {
    slotsByDay,
    saveRateByDay: extractRows<{ day: string; rate: number }>(saveRateByDayRaw),
    modeDistribution: extractRows<{ mode: string; count: number }>(modeDistributionRaw),
    newsCtrBySource: extractRows<{
      source: string
      impressions: number
      opened: number
      ctr: number
    }>(newsCtrBySourceRaw),
    alertsByDay,
  }
}

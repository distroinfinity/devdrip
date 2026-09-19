import { desc, eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { newsSources } from "../db/schema/news_sources.js"
import { newsItems } from "../db/schema/news_items.js"
import { sendSlackAlert } from "../lib/slack.js"
import { logger } from "../lib/logger.js"

export interface SourceHealth {
  key: string
  kind: string
  healthy: boolean
  lastFetchedAt: string | null
  lastError: string | null
  staleMinutes: number | null
  stale: boolean
}

export interface NewsHealthReport {
  ok: boolean
  checkedAt: string
  newestItemAgeMinutes: number | null
  problems: string[]
  sources: SourceHealth[]
}

// floor so a fast (5-min) source isn't flagged the instant it skips one tick.
const STALE_FLOOR_MIN = 15

export async function getNewsHealth(): Promise<NewsHealthReport> {
  const db = getDb()
  const now = Date.now()

  const rows = await db.select().from(newsSources).where(eq(newsSources.enabled, true))

  const sources: SourceHealth[] = []
  const problems: string[] = []

  for (const s of rows) {
    const last = s.lastFetchedAt ? new Date(s.lastFetchedAt).getTime() : null
    const staleMinutes = last === null ? null : Math.floor((now - last) / 60_000)
    // stale = never fetched, or older than 3× its interval (floored at 15 min).
    const threshold = Math.max(STALE_FLOOR_MIN, s.fetchIntervalMin * 3)
    const stale = last === null || (staleMinutes ?? 0) > threshold

    sources.push({
      key: s.key,
      kind: s.kind,
      healthy: s.healthy,
      lastFetchedAt: last === null ? null : new Date(last).toISOString(),
      lastError: s.lastError,
      staleMinutes,
      stale,
    })

    if (last === null) problems.push(`${s.key}: never fetched`)
    else if (stale) problems.push(`${s.key}: stale ${staleMinutes}m (> ${threshold}m)`)
    if (s.lastError) problems.push(`${s.key}: error — ${s.lastError}`)
  }

  // pipeline-wide silence check — newest item across every source.
  const [newest] = await db
    .select({ publishedAt: newsItems.publishedAt })
    .from(newsItems)
    .orderBy(desc(newsItems.publishedAt))
    .limit(1)
  const newestItemAgeMinutes = newest?.publishedAt
    ? Math.floor((now - new Date(newest.publishedAt).getTime()) / 60_000)
    : null
  if (newestItemAgeMinutes === null) problems.push("no news items in the database at all")

  return {
    ok: problems.length === 0,
    checkedAt: new Date(now).toISOString(),
    newestItemAgeMinutes,
    problems,
    sources,
  }
}

// Scheduled sweep — alerts (deduped) when the pipeline is degraded so a dead
// worker or broken feed is loud instead of silently serving nothing.
export async function runNewsHealthCheck(): Promise<void> {
  const report = await getNewsHealth()
  if (report.ok) {
    logger.info({ sources: report.sources.length }, "news health ok")
    return
  }
  logger.warn({ problems: report.problems }, "news health degraded")
  await sendSlackAlert(
    `news pipeline degraded — ${report.problems.length} issue(s):\n• ${report.problems.join("\n• ")}`,
    { severity: "error", dedupe: "news-health" }
  )
}

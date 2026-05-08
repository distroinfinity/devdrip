import { eq, gte, and, desc, inArray } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { slotImpressions } from "../db/schema/slot_impressions.js"
import { newsItems } from "../db/schema/news_items.js"

export interface RecentNewsItem {
  id: string
  title: string
  url: string
  source: string
  score: number | null
  comments: number | null
  createdAt: string
}

export async function getRecentNews(userId: string, limit: number): Promise<RecentNewsItem[]> {
  const db = getDb()
  const since = new Date(Date.now() - 7 * 86400 * 1000)

  const impressions = await db
    .selectDistinct({ newsId: slotImpressions.newsId })
    .from(slotImpressions)
    .where(
      and(
        eq(slotImpressions.userId, userId),
        eq(slotImpressions.kind, "news"),
        gte(slotImpressions.createdAt, since)
      )
    )
    .orderBy(desc(slotImpressions.createdAt))
    .limit(limit)

  if (impressions.length === 0) return []
  const ids = impressions.map((i) => i.newsId)

  const items = await db
    .select({
      id: newsItems.id,
      headline: newsItems.headline,
      url: newsItems.url,
      score: newsItems.score,
      commentsCount: newsItems.commentsCount,
      createdAt: newsItems.createdAt,
    })
    .from(newsItems)
    .where(inArray(newsItems.id, ids))

  const byId = new Map(items.map((i) => [i.id, i]))
  return ids
    .map((id) => {
      const item = byId.get(id)
      if (!item) return null
      const source = id.startsWith("hn:") ? "HN" : (id.split(":")[0]?.toUpperCase() ?? "unknown")
      return {
        id: item.id,
        title: item.headline,
        url: item.url,
        source,
        score: item.score,
        comments: item.commentsCount,
        createdAt: item.createdAt.toISOString(),
      }
    })
    .filter((x): x is RecentNewsItem => x !== null)
}

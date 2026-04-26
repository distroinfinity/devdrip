import { and, desc, eq, sql } from "drizzle-orm"
import type { NewsSource } from "@devdrip/shared"
import { getDb } from "../db/index.js"
import { readingListItems } from "../db/schema/reading_list_items.js"
import { newsImpressions } from "../db/schema/news_impressions.js"
import { ConflictError, NotFoundError, pgErrorCode } from "../errors/index.js"

export interface SaveReadingItemInput {
  userId: string
  newsId: string
  source: NewsSource
  headline: string
  url: string
  score: number
}

// idempotent: on (user_id, news_id) conflict, return the existing row.
export async function saveReadingItem(input: SaveReadingItemInput) {
  const db = getDb()
  try {
    const [row] = await db
      .insert(readingListItems)
      .values({
        userId: input.userId,
        newsId: input.newsId,
        source: input.source,
        headline: input.headline,
        url: input.url,
        score: input.score,
      })
      .returning()
    if (!row) throw new Error("reading insert returned no rows")
    return { item: row, created: true as const }
  } catch (err) {
    if (pgErrorCode(err) === "23505") {
      const [existing] = await db
        .select()
        .from(readingListItems)
        .where(
          and(eq(readingListItems.userId, input.userId), eq(readingListItems.newsId, input.newsId))
        )
      if (!existing) throw new ConflictError("reading_item_conflict_lost_row")
      return { item: existing, created: false as const }
    }
    throw err
  }
}

export async function listReadingItems(userId: string, limit = 100) {
  const db = getDb()
  // limit + 1 lets us tell the caller hasMore without a count query
  const rows = await db
    .select()
    .from(readingListItems)
    .where(eq(readingListItems.userId, userId))
    .orderBy(desc(readingListItems.savedAt))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore }
}

export async function deleteReadingItem(userId: string, id: string) {
  const db = getDb()
  const result = await db
    .delete(readingListItems)
    .where(and(eq(readingListItems.id, id), eq(readingListItems.userId, userId)))
    .returning()
  if (result.length === 0) throw new NotFoundError("reading_item")
}

// utility: count news impressions in last N days (used by stories-read card)
export async function countNewsImpressionsLastNDays(userId: string, days: number): Promise<number> {
  const db = getDb()
  const [row] = await db
    .select({ count: sql<number>`count(*)::int`.as("count") })
    .from(newsImpressions)
    .where(
      and(
        eq(newsImpressions.userId, userId),
        sql`${newsImpressions.createdAt} >= now() - interval ${sql.raw(`'${days} days'`)}`
      )
    )
  return row?.count ?? 0
}

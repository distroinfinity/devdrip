import { eq, sql } from "drizzle-orm"
import { getDb } from "../../db/index.js"
import { newsSources } from "../../db/schema/news_sources.js"
import { newsItems } from "../../db/schema/news_items.js"
import { getRedis } from "../../lib/redis.js"
import { fetcherLockKey } from "../../lib/news-keys.js"
import { logger } from "../../lib/logger.js"
import type { RawNewsItem, SourceContext, SourceFetcher } from "./types.js"
import { hnFetcher } from "./hn.js"
import { rssFetcher } from "./rss.js"
import { redditFetcher } from "./reddit.js"

const FETCHERS: Record<string, SourceFetcher> = {
  hn: hnFetcher,
  rss: rssFetcher,
  reddit: redditFetcher,
}

const LOCK_TTL_SEC = 90

async function upsertItems(
  items: RawNewsItem[],
  channelId: string,
  sourceId: string
): Promise<number> {
  if (items.length === 0) return 0
  const db = getDb()
  const rows = items.map((it) => ({
    id: it.id,
    channelId,
    sourceId,
    headline: it.headline,
    url: it.url,
    commentsUrl: it.commentsUrl,
    score: it.score,
    commentsCount: it.commentsCount,
    publishedAt: it.publishedAt,
  }))
  await db
    .insert(newsItems)
    .values(rows)
    .onConflictDoUpdate({
      target: newsItems.id,
      set: {
        score: sql`EXCLUDED.score`,
        commentsCount: sql`EXCLUDED.comments_count`,
        headline: sql`EXCLUDED.headline`,
      },
    })
  return rows.length
}

async function runOne(
  source: typeof newsSources.$inferSelect
): Promise<{ inserted: number; error?: string }> {
  const fetcher = FETCHERS[source.kind]
  if (!fetcher) return { inserted: 0, error: `unknown_kind:${source.kind}` }

  const ctx: SourceContext = {
    sourceId: source.id,
    channelId: source.channelId,
    url: source.url,
    sourceKey: source.key,
  }

  try {
    const items = await fetcher(ctx)
    const inserted = await upsertItems(items, ctx.channelId, ctx.sourceId)
    const db = getDb()
    await db
      .update(newsSources)
      .set({ lastFetchedAt: new Date(), lastError: null, healthy: true })
      .where(eq(newsSources.id, source.id))
    return { inserted }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const db = getDb()
    await db
      .update(newsSources)
      .set({ lastFetchedAt: new Date(), lastError: msg, healthy: false })
      .where(eq(newsSources.id, source.id))
    return { inserted: 0, error: msg }
  }
}

async function withLock(sourceId: string, fn: () => Promise<void>): Promise<void> {
  const redis = getRedis()
  const got = await redis.set(fetcherLockKey(sourceId), "1", { nx: true, ex: LOCK_TTL_SEC })
  if (!got) return
  try {
    await fn()
  } finally {
    await redis.del(fetcherLockKey(sourceId))
  }
}

export async function runFetchTick(minuteBucket: number): Promise<void> {
  const db = getDb()
  const all = await db.select().from(newsSources)
  const due = all.filter((s) => minuteBucket % s.fetchIntervalMin === 0)
  logger.info({ due: due.length, total: all.length, minuteBucket }, "news.fetch tick")

  for (const source of due) {
    await withLock(source.id, async () => {
      const result = await runOne(source)
      logger.info(
        { source: source.key, inserted: result.inserted, error: result.error ?? null },
        "news.fetch source"
      )
    })
  }
}

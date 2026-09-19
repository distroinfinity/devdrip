import { inArray, and, gt, eq, desc } from "drizzle-orm"
import { NewsSource } from "@distrotv/shared"
import type { NewsPayload, ChannelKey } from "@distrotv/shared"
import { getDb } from "../db/index.js"
import { channels } from "../db/schema/channels.js"
import { channelSubscriptions } from "../db/schema/channel_subscriptions.js"
import { newsItems } from "../db/schema/news_items.js"
import { newsSources } from "../db/schema/news_sources.js"
import { getRedis } from "../lib/redis.js"
import { servedKey, nextPicksKey, recentlyOfferedKey } from "../lib/news-keys.js"
import { logger } from "../lib/logger.js"
import { ensureDefaultSubscriptions } from "./channel.service.js"

const SERVED_TTL_SEC = 30 * 86400
const NEXTPICKS_TTL_SEC = 5 * 60
// how long an offered item is held back from re-selection. long enough to ride
// out cache churn + the 5-min impression sync, short enough that a fresh cycle
// eventually reconsiders items the device never actually rendered.
const RECENTLY_OFFERED_TTL_SEC = 4 * 3600
const CANDIDATE_LIMIT = 200
const MAX_AGE_HOURS = 72
const NEWS_DISPLAY_TIME_MS = 10_000

const W_RECENCY = 0.45
const W_ENGAGEMENT = 0.2
const W_CHANNEL_PRIORITY = 0.3
const W_FRESHNESS = 0.05

// must include every prefix in news-fetchers/rss.ts SOURCE_BY_KEY_PREFIX, plus hn- and reddit-
// any new source added to rss.ts must also land here, or its payloads serve as NewsSource.Generic
const SOURCE_BY_KEY_PREFIX: Record<string, NewsSource> = {
  "hn-": NewsSource.HackerNews,
  "reddit-": NewsSource.Reddit,
  techcrunch: NewsSource.TechCrunch,
  theverge: NewsSource.TheVerge,
  arstechnica: NewsSource.ArsTechnica,
  bloomberg: NewsSource.Bloomberg,
  reuters: NewsSource.Reuters,
  coindesk: NewsSource.CoinDesk,
  smashing: NewsSource.Smashing,
  polygon: NewsSource.Polygon,
}

function sourceForKey(sourceKey: string): NewsSource {
  for (const prefix in SOURCE_BY_KEY_PREFIX) {
    if (sourceKey.startsWith(prefix)) return SOURCE_BY_KEY_PREFIX[prefix] as NewsSource
  }
  return NewsSource.Generic
}

interface CandidateRow {
  id: string
  channelKey: ChannelKey
  sourceKey: string
  headline: string
  url: string
  commentsUrl: string | null
  score: number | null
  publishedAt: Date
  halfLifeHours: number
  channelPriority: number
}

function recencyDecay(ageHours: number, halfLifeHours: number): number {
  return Math.pow(0.5, ageHours / Math.max(halfLifeHours, 0.5))
}

function engagementSignal(score: number | null): number {
  if (score === null || score <= 0) return 0
  return Math.min(1, Math.log10(score + 1) / 3)
}

function priorityScore(priority: number): number {
  return 1 / (1 + priority)
}

function scoreCandidate(c: CandidateRow, nowMs: number, isFirstTime: boolean): number {
  const ageHours = Math.max(0, (nowMs - c.publishedAt.getTime()) / 3_600_000)
  return (
    W_RECENCY * recencyDecay(ageHours, c.halfLifeHours) +
    W_ENGAGEMENT * engagementSignal(c.score) +
    W_CHANNEL_PRIORITY * priorityScore(c.channelPriority) +
    W_FRESHNESS * (isFirstTime ? 1 : 0)
  )
}

function toPayload(c: CandidateRow, nowMs: number): NewsPayload {
  return {
    kind: "news",
    id: c.id,
    source: sourceForKey(c.sourceKey),
    channelKey: c.channelKey,
    headline: c.headline,
    url: c.url,
    score: c.score ?? undefined,
    commentsUrl: c.commentsUrl ?? undefined,
    ageSeconds: Math.max(0, Math.floor((nowMs - c.publishedAt.getTime()) / 1000)),
    displayTimeMs: NEWS_DISPLAY_TIME_MS,
  }
}

export interface NextPicksArgs {
  userId: string
  deviceId: string
  n: number
}

export async function nextPicksForDevice({
  userId,
  deviceId,
  n,
}: NextPicksArgs): Promise<NewsPayload[]> {
  const redis = getRedis()
  const limit = Math.max(1, Math.min(n, 20))

  const cached = await redis.get<NewsPayload[]>(nextPicksKey(deviceId))
  // sparse channels can produce caches shorter than `limit`; serving the partial
  // beats hammering the db until the next worker tick refills news_items
  if (cached && cached.length > 0) {
    return cached.slice(0, limit)
  }

  await ensureDefaultSubscriptions(userId)

  const db = getDb()
  const subs = await db
    .select({
      channelId: channelSubscriptions.channelId,
      channelKey: channels.key,
      priority: channelSubscriptions.priority,
    })
    .from(channelSubscriptions)
    .innerJoin(channels, eq(channels.id, channelSubscriptions.channelId))
    .where(eq(channelSubscriptions.userId, userId))
  if (subs.length === 0) return []

  const channelIds = subs.map((s) => s.channelId)
  const priorityByChannel = new Map(subs.map((s) => [s.channelId, s.priority]))
  const keyByChannel = new Map(subs.map((s) => [s.channelId, s.channelKey as ChannelKey]))

  const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 3_600_000)
  const rows = await db
    .select({
      id: newsItems.id,
      channelId: newsItems.channelId,
      source: newsSources.key,
      headline: newsItems.headline,
      url: newsItems.url,
      commentsUrl: newsItems.commentsUrl,
      score: newsItems.score,
      publishedAt: newsItems.publishedAt,
      halfLifeHours: newsSources.halfLifeHours,
    })
    .from(newsItems)
    .innerJoin(newsSources, eq(newsSources.id, newsItems.sourceId))
    .where(and(inArray(newsItems.channelId, channelIds), gt(newsItems.publishedAt, cutoff)))
    .orderBy(desc(newsItems.publishedAt))
    .limit(CANDIDATE_LIMIT)

  if (rows.length === 0) return []

  const [servedMembers, offeredMembers] = await Promise.all([
    redis.smembers(servedKey(deviceId)),
    redis.smembers(recentlyOfferedKey(deviceId)),
  ])
  const served = new Set(servedMembers)
  const offered = new Set(offeredMembers)
  const nowMs = Date.now()

  const candidates: CandidateRow[] = rows.map((r) => ({
    id: r.id,
    channelKey: (keyByChannel.get(r.channelId) ?? "tech") as ChannelKey,
    sourceKey: r.source,
    headline: r.headline,
    url: r.url,
    commentsUrl: r.commentsUrl,
    score: r.score,
    publishedAt: r.publishedAt,
    halfLifeHours: r.halfLifeHours,
    channelPriority: priorityByChannel.get(r.channelId) ?? 99,
  }))

  const scored = candidates
    .map((c) => ({ c, s: scoreCandidate(c, nowMs, !served.has(c.id)) }))
    .sort((a, b) => b.s - a.s)

  // tier 1: genuinely fresh — never served AND not recently offered. always
  // preferred. serving fewer than `limit` is fine (the CLI slot-cache handles
  // partial batches); we'd rather show 3 fresh items than pad with repeats.
  const fresh = scored.filter((x) => !served.has(x.c.id) && !offered.has(x.c.id))
  let picked = fresh.slice(0, limit)
  let recycled = false

  if (picked.length === 0) {
    // fresh inventory exhausted for this device. rather than serve an empty
    // surface, start a new cycle: prefer offered-but-never-rendered items, then
    // already-served — both score-ranked. reset the offered set so the next
    // selections can rebuild it from scratch.
    recycled = true
    const offeredUnseen = scored.filter((x) => !served.has(x.c.id) && offered.has(x.c.id))
    const seen = scored.filter((x) => served.has(x.c.id))
    picked = [...offeredUnseen, ...seen].slice(0, limit)
    await redis.del(recentlyOfferedKey(deviceId)).catch(() => {})
  }

  const picks = picked.map((x) => x.c)
  const payloads = picks.map((c) => toPayload(c, nowMs))

  if (payloads.length > 0) {
    await redis.set(nextPicksKey(deviceId), payloads, { ex: NEXTPICKS_TTL_SEC })
    // mark offered NOW (not at impression time). impressions still drive the
    // long-term served set, but this short-lived set closes the window where a
    // cache-evicted-but-unsynced batch got re-served as the same handful.
    const ids = picks.map((c) => c.id)
    await redis.sadd(recentlyOfferedKey(deviceId), ids[0] as string, ...ids.slice(1))
    await redis.expire(recentlyOfferedKey(deviceId), RECENTLY_OFFERED_TTL_SEC)
  }

  logger.debug(
    {
      userIdHash: userId.slice(0, 8),
      deviceIdHash: deviceId.slice(0, 8),
      candidates: candidates.length,
      served: served.size,
      offered: offered.size,
      picked: payloads.length,
      recycled,
    },
    "news.select"
  )
  return payloads
}

// called from /ingest when a news slot impression lands. only impressions that
// actually rendered (the CLI sends durationMs > 0) advance the served set, so
// cache-evicted-but-never-shown picks stay candidates for next time.
export async function markServedOnImpression(deviceId: string, newsId: string): Promise<void> {
  const redis = getRedis()
  await redis.sadd(servedKey(deviceId), newsId)
  await redis.expire(servedKey(deviceId), SERVED_TTL_SEC)
}

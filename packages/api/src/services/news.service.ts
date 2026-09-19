import { NewsSource, type NewsPayload } from "@devdrip/shared"
import { getRedis } from "../lib/redis.js"
import { logger } from "../lib/logger.js"

// hn firebase api — free, no rate limits, no auth.
const HN_TOP_STORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json"
const HN_ITEM_URL = (id: number) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`

const CACHE_KEY = "news:hn:top"
const STALE_KEY = "news:hn:top:stale" // last-known-good fallback when hn is down
const LOCK_KEY = "news:hn:lock"
const CACHE_TTL_SEC = 900 // 15 min
const LOCK_TTL_SEC = 60
const POOL_SIZE = 100
const MIN_SCORE = 100
const MAX_AGE_HOURS = 24
const CONCURRENCY = 10
const SEEN_TTL_SEC = 7 * 86400 // 7-day rolling dedup window
const NEWS_DISPLAY_TIME_MS = 10_000 // matches existing ad default

export interface CachedNewsItem {
  id: string // "hn:38291043"
  source: NewsSource
  headline: string
  url: string
  score: number
  commentsUrl: string
  publishedAt: number // epoch sec
}

interface HnItem {
  id: number
  title?: string
  url?: string
  score?: number
  time?: number
  type?: string
  by?: string
  descendants?: number
  text?: string
}

async function fetchHnIds(): Promise<number[]> {
  const res = await fetch(HN_TOP_STORIES_URL)
  if (!res.ok) throw new Error(`hn topstories ${res.status}`)
  return (await res.json()) as number[]
}

async function fetchHnItem(id: number): Promise<HnItem | null> {
  const res = await fetch(HN_ITEM_URL(id))
  if (!res.ok) return null
  return (await res.json()) as HnItem | null
}

async function fetchManyItems(ids: number[]): Promise<HnItem[]> {
  const out: HnItem[] = []
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const slice = ids.slice(i, i + CONCURRENCY)
    const batch = await Promise.all(slice.map(fetchHnItem))
    for (const item of batch) if (item) out.push(item)
  }
  return out
}

function toCachedItem(it: HnItem): CachedNewsItem | null {
  if (!it.title || typeof it.score !== "number" || typeof it.time !== "number") return null
  const url = it.url ?? `https://news.ycombinator.com/item?id=${it.id}`
  return {
    id: `hn:${it.id}`,
    source: NewsSource.HackerNews,
    headline: it.title,
    url,
    score: it.score,
    commentsUrl: `https://news.ycombinator.com/item?id=${it.id}`,
    publishedAt: it.time,
  }
}

function isFresh(item: CachedNewsItem, nowSec: number): boolean {
  return item.score >= MIN_SCORE && nowSec - item.publishedAt <= MAX_AGE_HOURS * 3600
}

async function refreshPool(): Promise<CachedNewsItem[]> {
  const redis = getRedis()
  // SETNX-style lock: first writer wins, others fall through to cache read.
  const got = await redis.set(LOCK_KEY, "1", { nx: true, ex: LOCK_TTL_SEC })
  if (!got) {
    // contention: brief wait then return whatever's cached (likely now warm)
    await new Promise((r) => setTimeout(r, 250))
    const raw = await redis.get<string>(CACHE_KEY)
    return raw ? (JSON.parse(raw) as CachedNewsItem[]) : []
  }

  try {
    const ids = (await fetchHnIds()).slice(0, POOL_SIZE)
    const items = await fetchManyItems(ids)
    const nowSec = Math.floor(Date.now() / 1000)
    const fresh = items
      .map(toCachedItem)
      .filter((c): c is CachedNewsItem => c !== null && isFresh(c, nowSec))

    await redis.set(CACHE_KEY, fresh, { ex: CACHE_TTL_SEC })
    await redis.set(STALE_KEY, fresh) // no ttl — stale fallback
    logger.info({ count: fresh.length }, "news.fetch refreshed")
    return fresh
  } catch (err) {
    logger.warn({ err }, "news.fetch refresh failed — falling back to stale")
    const staleRaw = await redis.get<string>(STALE_KEY)
    return staleRaw ? (JSON.parse(staleRaw) as CachedNewsItem[]) : []
  } finally {
    await redis.del(LOCK_KEY)
  }
}

export async function getNewsPool(): Promise<CachedNewsItem[]> {
  const redis = getRedis()
  const raw = await redis.get<string>(CACHE_KEY)
  const cached = raw ? (JSON.parse(raw) as CachedNewsItem[]) : null
  if (cached && cached.length > 0) return cached
  return refreshPool()
}

function toPayload(item: CachedNewsItem): NewsPayload {
  return {
    id: item.id,
    source: item.source,
    headline: item.headline,
    url: item.url,
    score: item.score,
    commentsUrl: item.commentsUrl,
    ageSeconds: Math.max(0, Math.floor(Date.now() / 1000) - item.publishedAt),
    displayTimeMs: NEWS_DISPLAY_TIME_MS,
  }
}

export async function pickNewsForUser(userId: string): Promise<NewsPayload | null> {
  const redis = getRedis()
  const pool = await getNewsPool()
  if (pool.length === 0) return null

  const seenKey = `news:seen:${userId}`
  const seen = await redis.smembers(seenKey)
  const seenSet = new Set(seen)
  const unseen = pool.filter((p) => !seenSet.has(p.id))

  // resurfacing fallback: pool fully seen → show top story even if seen.
  // better than blank slot for power users.
  const pick = unseen[0] ?? pool[0]
  if (!pick) return null

  await redis.sadd(seenKey, pick.id)
  await redis.expire(seenKey, SEEN_TTL_SEC)
  logger.debug(
    { userIdHash: userId.slice(0, 8), newsId: pick.id, dedupSize: seen.length + 1 },
    "news.pick"
  )
  return toPayload(pick)
}

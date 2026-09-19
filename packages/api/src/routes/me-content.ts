import { Router } from "express"
import { eq } from "drizzle-orm"
import { ChannelMode } from "@distrotv/shared"
import type { Feed, NewsPayload, SlotPayload, TickerPayload } from "@distrotv/shared"
import { getDb } from "../db/index.js"
import { preferences } from "../db/schema/preferences.js"
import { nextPicksForDevice } from "../services/news-selection.service.js"
import { nextTickerForDevice } from "../services/ticker-selection.service.js"
import { touchDeviceHeartbeat } from "../services/device-heartbeat.service.js"
import {
  clientRendersAds,
  contentPlan,
  mixSlots,
  normalizeFeeds,
  splitCounts,
  type ContentPlan,
} from "../services/ad-mix.js"
import { nextAds } from "../services/ad-supply.service.js"

export const meContentRouter: ReturnType<typeof Router> = Router()

// GET /me/content/next?n=N&deviceId=...&surface=terminal-tv
// returns { items: SlotPayload[] } from the user's enabled feeds.
//   ads only (default)  → all sponsored
//   ads + news/markets  → alternate ad / content, starting with an ad
//   ads off             → content only (news / ticker / interleaved per channelMode)
//   nothing enabled     → []
meContentRouter.get("/next", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const deviceId =
      (req.query["deviceId"] as string | undefined) ??
      (res.locals["deviceId"] as string | undefined)
    if (!deviceId) {
      res.status(400).json({ error: "device_id_required" })
      return
    }
    // mark the device online so alert evaluation knows to serve this user.
    // fire-and-forget — never block or fail content serving on a heartbeat write.
    void touchDeviceHeartbeat(deviceId).catch(() => {})
    const nRaw = Number.parseInt((req.query["n"] as string | undefined) ?? "5", 10)
    const n = Math.max(1, Math.min(Number.isFinite(nRaw) ? nRaw : 5, 20))
    void (req.query["surface"] as string | undefined) // M5 may use this

    const { mode, feeds } = await getModeAndFeeds(userId)
    const plan = contentPlan(feeds, mode)
    // ?v= is the cli version. clients that cannot draw the ad panel never get one.
    const adsOn = feeds.includes("ads") && clientRendersAds(req.query["v"])
    const counts = splitCounts(n, adsOn, plan !== "none")

    const [ads, content] = await Promise.all([
      nextAds({ userId, deviceId, n: counts.ads }),
      fetchContent(plan, userId, deviceId, counts.content),
    ])
    res.json({ items: mixSlots<SlotPayload>(ads, content) })
  } catch (err) {
    next(err)
  }
})

async function fetchContent(
  plan: ContentPlan,
  userId: string,
  deviceId: string,
  n: number
): Promise<SlotPayload[]> {
  if (n <= 0 || plan === "none") return []
  if (plan === "news") return nextPicksForDevice({ userId, deviceId, n })
  if (plan === "ticker") return onlyTicker(userId, deviceId, n)
  return interleave(userId, deviceId, n)
}

async function getModeAndFeeds(userId: string): Promise<{ mode: ChannelMode; feeds: Feed[] }> {
  const db = getDb()
  const [row] = await db
    .select({ mode: preferences.channelMode, feeds: preferences.enabledFeeds })
    .from(preferences)
    .where(eq(preferences.userId, userId))
    .limit(1)
  const valid = Object.values(ChannelMode) as string[]
  const mode =
    row?.mode && valid.includes(row.mode) ? (row.mode as ChannelMode) : ChannelMode.Balanced
  return { mode, feeds: normalizeFeeds(row?.feeds) }
}

// fetch up to `n` tickers, skipping rotation indices that return null (missing quote
// during fetcher warm-up). bounded at 2*n attempts so a fully empty quote table
// still terminates instead of looping forever.
// concurrency cap: each nextTickerForDevice runs a db query (ensureDefaultWatchlist)
// + a yahoo fetch. full parallel (2*n at once) exhausted the postgres-js pool
// against neon (AggregateError 500s); pure sequential blew past the daemon's 10s
// timeout. a small fixed concurrency gets the speed without the connection burst.
const TICKER_CONCURRENCY = 4

async function fetchTickers(userId: string, deviceId: string, n: number): Promise<TickerPayload[]> {
  if (n <= 0) return []
  const maxAttempts = n * 2
  const out: TickerPayload[] = []
  for (let start = 0; start < maxAttempts && out.length < n; start += TICKER_CONCURRENCY) {
    const size = Math.min(TICKER_CONCURRENCY, maxAttempts - start)
    const batch = await Promise.all(
      Array.from({ length: size }, (_, k) =>
        nextTickerForDevice({ userId, deviceId, rotationIndex: start + k })
      )
    )
    for (const t of batch) if (t) out.push(t)
  }
  return out.slice(0, n)
}

async function onlyTicker(userId: string, deviceId: string, n: number): Promise<SlotPayload[]> {
  return fetchTickers(userId, deviceId, n)
}

async function interleave(userId: string, deviceId: string, n: number): Promise<SlotPayload[]> {
  const halfNews = Math.ceil(n / 2)
  const halfTicker = n - halfNews
  // news (db) + tickers (yahoo) in parallel so the response time is max(), not sum().
  const [news, tickers] = await Promise.all([
    nextPicksForDevice({ userId, deviceId, n: halfNews }),
    fetchTickers(userId, deviceId, halfTicker),
  ])
  // round-robin merge starting with news
  const out: SlotPayload[] = []
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0 && news.length > 0) {
      const item = news.shift()
      if (item) out.push(item as NewsPayload)
    } else if (tickers.length > 0) {
      const item = tickers.shift()
      if (item) out.push(item as TickerPayload)
    } else if (news.length > 0) {
      const item = news.shift()
      if (item) out.push(item as NewsPayload)
    }
  }
  return out
}

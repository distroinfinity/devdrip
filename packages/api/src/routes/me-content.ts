import { Router } from "express"
import { eq } from "drizzle-orm"
import { ChannelMode } from "@distrotv/shared"
import type { NewsPayload, SlotPayload, TickerPayload } from "@distrotv/shared"
import { getDb } from "../db/index.js"
import { preferences } from "../db/schema/preferences.js"
import { nextPicksForDevice } from "../services/news-selection.service.js"
import { nextTickerForDevice } from "../services/ticker-selection.service.js"

export const meContentRouter: ReturnType<typeof Router> = Router()

// GET /me/content/next?n=N&deviceId=...&surface=terminal-tv
// returns { items: SlotPayload[] } based on user's channelMode.
//   news_only    → 100% news items
//   ticker_only  → 100% ticker items
//   news_heavy   → mix-ish (3:1 news:ticker; deterministic pattern deferred to Task 4)
//   balanced     → mix-ish (1:1 news:ticker; deterministic pattern deferred to Task 4)
//   ticker_heavy → mix-ish (1:3 news:ticker; deterministic pattern deferred to Task 4)
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
    const nRaw = Number.parseInt((req.query["n"] as string | undefined) ?? "5", 10)
    const n = Math.max(1, Math.min(Number.isFinite(nRaw) ? nRaw : 5, 20))
    void (req.query["surface"] as string | undefined) // M5 may use this

    const mode = await getMode(userId)
    let items: SlotPayload[]
    if (mode === ChannelMode.NewsOnly) {
      items = await nextPicksForDevice({ userId, deviceId, n })
    } else if (mode === ChannelMode.TickerOnly) {
      items = await onlyTicker(userId, deviceId, n)
    } else {
      // news_heavy | balanced | ticker_heavy — all treated as interleaved for now.
      // Task 4 (slot-cache.ts) will refine per-device ratio using a counter.
      items = await interleave(userId, deviceId, n)
    }

    res.json({ items })
  } catch (err) {
    next(err)
  }
})

async function getMode(userId: string): Promise<ChannelMode> {
  const db = getDb()
  const [row] = await db
    .select({ mode: preferences.channelMode })
    .from(preferences)
    .where(eq(preferences.userId, userId))
    .limit(1)
  const m = row?.mode as string | undefined
  const valid = Object.values(ChannelMode) as string[]
  if (m && valid.includes(m)) return m as ChannelMode
  return ChannelMode.Balanced
}

// fetch up to `n` tickers, skipping rotation indices that return null (missing quote
// during fetcher warm-up). bounded at 2*n attempts so a fully empty quote table
// still terminates instead of looping forever.
async function fetchTickers(userId: string, deviceId: string, n: number): Promise<TickerPayload[]> {
  const out: TickerPayload[] = []
  let attempts = 0
  const maxAttempts = n * 2
  while (out.length < n && attempts < maxAttempts) {
    const t = await nextTickerForDevice({ userId, deviceId, rotationIndex: attempts })
    attempts++
    if (t) out.push(t)
  }
  return out
}

async function onlyTicker(userId: string, deviceId: string, n: number): Promise<SlotPayload[]> {
  return fetchTickers(userId, deviceId, n)
}

async function interleave(userId: string, deviceId: string, n: number): Promise<SlotPayload[]> {
  const halfNews = Math.ceil(n / 2)
  const halfTicker = n - halfNews
  const news = await nextPicksForDevice({ userId, deviceId, n: halfNews })
  const tickers = await fetchTickers(userId, deviceId, halfTicker)
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

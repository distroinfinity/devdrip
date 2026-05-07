import { Router } from "express"
import { eq } from "drizzle-orm"
import type { NewsPayload, SlotPayload, TickerPayload } from "@distrotv/shared"
import { getDb } from "../db/index.js"
import { preferences } from "../db/schema/preferences.js"
import { nextPicksForDevice } from "../services/news-selection.service.js"
import { nextTickerForDevice } from "../services/ticker-selection.service.js"

export const meContentRouter: ReturnType<typeof Router> = Router()

// GET /me/content/next?n=N&deviceId=...&surface=terminal-tv
// returns { items: SlotPayload[] } based on user's channelMode.
//   news    → only news items
//   markets → only ticker items (n calls with rotationIndex 0..n-1)
//   mix     → alternating news, ticker, ... up to n
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
    if (mode === "news") {
      items = await nextPicksForDevice({ userId, deviceId, n })
    } else if (mode === "markets") {
      items = await onlyTicker(userId, deviceId, n)
    } else {
      items = await interleave(userId, deviceId, n)
    }

    res.json({ items })
  } catch (err) {
    next(err)
  }
})

async function getMode(userId: string): Promise<"news" | "markets" | "mix"> {
  const db = getDb()
  const [row] = await db
    .select({ mode: preferences.channelMode })
    .from(preferences)
    .where(eq(preferences.userId, userId))
    .limit(1)
  const m = row?.mode ?? "mix"
  if (m === "news" || m === "markets" || m === "mix") return m
  return "mix"
}

async function onlyTicker(userId: string, deviceId: string, n: number): Promise<SlotPayload[]> {
  const out: TickerPayload[] = []
  for (let i = 0; i < n; i++) {
    const t = await nextTickerForDevice({ userId, deviceId, rotationIndex: i })
    if (!t) break
    out.push(t)
  }
  return out
}

async function interleave(userId: string, deviceId: string, n: number): Promise<SlotPayload[]> {
  const halfNews = Math.ceil(n / 2)
  const halfTicker = n - halfNews
  const news = await nextPicksForDevice({ userId, deviceId, n: halfNews })
  const tickers: TickerPayload[] = []
  for (let i = 0; i < halfTicker; i++) {
    const t = await nextTickerForDevice({ userId, deviceId, rotationIndex: i })
    if (!t) break
    tickers.push(t)
  }
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

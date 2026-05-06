import { NewsSource } from "@distrotv/shared"
import type { RawNewsItem, SourceFetcher } from "./types.js"

const HN_ITEM_URL = (id: number) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`
const POOL_SIZE = 60
const CONCURRENCY = 10
const MIN_SCORE = 50

interface HnItem {
  id: number
  title?: string
  url?: string
  score?: number
  time?: number
  type?: string
  descendants?: number
}

async function fetchItem(id: number): Promise<HnItem | null> {
  const res = await fetch(HN_ITEM_URL(id), { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return null
  return (await res.json()) as HnItem | null
}

export const hnFetcher: SourceFetcher = async (ctx) => {
  const idsRes = await fetch(ctx.url, { signal: AbortSignal.timeout(15_000) })
  if (!idsRes.ok) throw new Error(`hn topstories ${idsRes.status}`)
  const ids = ((await idsRes.json()) as number[]).slice(0, POOL_SIZE)

  const items: HnItem[] = []
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const slice = ids.slice(i, i + CONCURRENCY)
    const batch = await Promise.all(slice.map(fetchItem))
    for (const item of batch) if (item) items.push(item)
  }

  const out: RawNewsItem[] = []
  for (const it of items) {
    if (!it.title || typeof it.score !== "number" || typeof it.time !== "number") continue
    // top-stories endpoint mixes story/ask/job/poll; only stories belong in the news slot
    if (it.type !== undefined && it.type !== "story") continue
    if (it.score < MIN_SCORE) continue
    out.push({
      id: `hn:${it.id}`,
      source: NewsSource.HackerNews,
      headline: it.title,
      url: it.url ?? `https://news.ycombinator.com/item?id=${it.id}`,
      commentsUrl: `https://news.ycombinator.com/item?id=${it.id}`,
      score: it.score,
      commentsCount: it.descendants ?? null,
      publishedAt: new Date(it.time * 1000),
    })
  }
  return out
}

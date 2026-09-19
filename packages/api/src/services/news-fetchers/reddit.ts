import { NewsSource } from "@distrotv/shared"
import type { RawNewsItem, SourceFetcher } from "./types.js"

interface RedditChild {
  data?: {
    id?: string
    title?: string
    url?: string
    permalink?: string
    score?: number
    num_comments?: number
    created_utc?: number
  }
}

export const redditFetcher: SourceFetcher = async (ctx) => {
  const res = await fetch(ctx.url, {
    headers: { "User-Agent": "DistroTV/1.0 (by /u/distrotv)" },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`reddit ${ctx.sourceKey} ${res.status}`)
  const body = (await res.json()) as { data?: { children?: RedditChild[] } }
  const children = body.data?.children ?? []

  const out: RawNewsItem[] = []
  for (const c of children) {
    const d = c.data
    if (!d?.id || !d.title || typeof d.created_utc !== "number") continue
    const url =
      d.url && /^https?:/.test(d.url) ? d.url : `https://www.reddit.com${d.permalink ?? ""}`
    out.push({
      id: `reddit:${d.id}`,
      source: NewsSource.Reddit,
      headline: d.title,
      url,
      commentsUrl: d.permalink ? `https://www.reddit.com${d.permalink}` : null,
      score: d.score ?? null,
      commentsCount: d.num_comments ?? null,
      publishedAt: new Date(d.created_utc * 1000),
    })
  }
  return out
}

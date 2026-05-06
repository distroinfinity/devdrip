import { XMLParser } from "fast-xml-parser"
import { NewsSource } from "@distrotv/shared"
import type { RawNewsItem, SourceFetcher } from "./types.js"

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
})

interface RssItem {
  title?: string | { "#text"?: string }
  link?: string | { "@href"?: string } | Array<string | { "@href"?: string }>
  pubDate?: string
  updated?: string
  guid?: string | { "#text"?: string }
  id?: string
}

function asText(v: unknown): string {
  if (typeof v === "string") return v.trim()
  if (v && typeof v === "object" && "#text" in v)
    return String((v as { "#text": string })["#text"]).trim()
  return ""
}

function asLink(v: unknown): string {
  if (Array.isArray(v)) {
    for (const e of v) {
      const s = asLink(e)
      if (s) return s
    }
    return ""
  }
  if (typeof v === "string") return v.trim()
  if (v && typeof v === "object" && "@href" in v)
    return String((v as { "@href": string })["@href"]).trim()
  return ""
}

const SOURCE_BY_KEY_PREFIX: Record<string, NewsSource> = {
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

export const rssFetcher: SourceFetcher = async (ctx) => {
  const res = await fetch(ctx.url, {
    headers: { "User-Agent": "DistroTV/1.0 (+https://devdrip.xyz)" },
  })
  if (!res.ok) throw new Error(`rss ${ctx.sourceKey} ${res.status}`)
  const xml = await res.text()
  const tree = parser.parse(xml) as Record<string, unknown>

  const rssChannel = (tree["rss"] as { channel?: { item?: RssItem | RssItem[] } } | undefined)
    ?.channel
  const atomFeed = tree["feed"] as { entry?: RssItem | RssItem[] } | undefined

  const rawItems: RssItem[] =
    (rssChannel?.item
      ? Array.isArray(rssChannel.item)
        ? rssChannel.item
        : [rssChannel.item]
      : null) ??
    (atomFeed?.entry ? (Array.isArray(atomFeed.entry) ? atomFeed.entry : [atomFeed.entry]) : []) ??
    []

  const source = sourceForKey(ctx.sourceKey)
  const out: RawNewsItem[] = []
  for (const it of rawItems) {
    const title = asText(it.title)
    const link = asLink(it.link)
    const guid = asText(it.guid) || asText(it.id) || link
    const dateStr = it.pubDate ?? it.updated
    if (!title || !link || !dateStr) continue
    const ts = new Date(dateStr)
    if (Number.isNaN(ts.getTime())) continue
    const idTail = guid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 64) || String(ts.getTime())
    out.push({
      id: `rss:${ctx.sourceKey}:${idTail}`,
      source,
      headline: title,
      url: link,
      commentsUrl: null,
      score: null,
      commentsCount: null,
      publishedAt: ts,
    })
  }
  return out
}

import { ChannelMode, DEFAULT_FEEDS, FEEDS, type Feed } from "@distrotv/shared"

export type ContentPlan = "none" | "news" | "ticker" | "mix"

export function normalizeFeeds(raw: unknown): Feed[] {
  if (!Array.isArray(raw)) return [...DEFAULT_FEEDS]
  const out: Feed[] = []
  for (const v of raw) {
    if (FEEDS.includes(v as Feed) && !out.includes(v as Feed)) out.push(v as Feed)
  }
  return out
}

export function contentPlan(feeds: Feed[], mode: ChannelMode): ContentPlan {
  const news = feeds.includes("news")
  const markets = feeds.includes("markets")
  if (!news && !markets) return "none"
  if (news && !markets) return "news"
  if (!news && markets) return "ticker"
  if (mode === ChannelMode.NewsOnly) return "news"
  if (mode === ChannelMode.TickerOnly) return "ticker"
  return "mix"
}

export function splitCounts(
  n: number,
  adsOn: boolean,
  hasContent: boolean
): { ads: number; content: number } {
  if (!adsOn && !hasContent) return { ads: 0, content: 0 }
  if (adsOn && !hasContent) return { ads: n, content: 0 }
  if (!adsOn) return { ads: 0, content: n }
  const ads = Math.ceil(n / 2)
  return { ads, content: n - ads }
}

// alternate, starting with an ad (AD_SLOT_EVERY_N = 2); drain whichever list is longer.
export function mixSlots<T>(ads: T[], content: T[]): T[] {
  const out: T[] = []
  const a = [...ads]
  const c = [...content]
  while (a.length > 0 || c.length > 0) {
    const ad = a.shift()
    if (ad !== undefined) out.push(ad)
    const item = c.shift()
    if (item !== undefined) out.push(item)
  }
  return out
}

// the first cli release that can draw a sponsored panel. older clients (and anything that
// does not declare a version) are never sent one — they would render it as broken news.
const ADS_MIN_VERSION = [0, 3, 0] as const

export function clientRendersAds(raw: unknown): boolean {
  if (typeof raw !== "string") return false
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(raw.trim())
  if (!m) return false
  const v = [Number(m[1]), Number(m[2]), Number(m[3])]
  for (let i = 0; i < 3; i++) {
    const have = v[i] ?? 0
    const need = ADS_MIN_VERSION[i] ?? 0
    if (have !== need) return have > need
  }
  return true
}

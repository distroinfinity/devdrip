import { ChannelMode, FEEDS, type Feed } from "@distrotv/shared"

// the news:markets ratio only matters when both content feeds are on. keep the
// server-side channelMode consistent with the feeds the user picked.
export function channelModeForFeeds(feeds: Feed[], current: ChannelMode): ChannelMode {
  const news = feeds.includes("news")
  const markets = feeds.includes("markets")
  if (news && !markets) return ChannelMode.NewsOnly
  if (!news && markets) return ChannelMode.TickerOnly
  if (news && markets) {
    const mixed = [ChannelMode.NewsHeavy, ChannelMode.Balanced, ChannelMode.TickerHeavy]
    return mixed.includes(current) ? current : ChannelMode.Balanced
  }
  return current
}

export function describeFeeds(feeds: Feed[]): string {
  const ordered = FEEDS.filter((f) => feeds.includes(f))
  return ordered.length > 0 ? ordered.join(", ") : "nothing (all feeds off)"
}

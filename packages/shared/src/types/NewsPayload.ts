import type { NewsSource, ChannelKey } from "./news.js"

export interface NewsPayload {
  kind: "news"
  // namespaced id: "hn:38291043" — keeps the dedup set source-agnostic
  id: string
  source: NewsSource
  channelKey: ChannelKey
  headline: string
  url: string
  score: number
  commentsUrl?: string
  // server computes at fetch time; daemon renders "1h" / "3d"
  ageSeconds: number
  // server-set, default ~10s. lives on the payload so different content types
  // can carry different defaults.
  displayTimeMs: number
}

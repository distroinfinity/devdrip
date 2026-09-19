import type { NewsSource } from "@distrotv/shared"

export interface RawNewsItem {
  id: string
  source: NewsSource
  headline: string
  url: string
  commentsUrl: string | null
  score: number | null
  commentsCount: number | null
  publishedAt: Date
}

export interface SourceContext {
  sourceId: string
  channelId: string
  url: string
  sourceKey: string
}

export type SourceFetcher = (ctx: SourceContext) => Promise<RawNewsItem[]>

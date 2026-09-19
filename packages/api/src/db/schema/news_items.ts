import { pgTable, text, uuid, integer, timestamp, index } from "drizzle-orm/pg-core"
import { channels } from "./channels.js"
import { newsSources } from "./news_sources.js"

// id is namespaced + source-prefixed, e.g. "hn:38291043", "rss:techcrunch:abc123".
// PK on text id supports cheap upsert on stable source identifiers.
export const newsItems = pgTable(
  "news_items",
  {
    id: text("id").primaryKey(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => newsSources.id, { onDelete: "cascade" }),
    headline: text("headline").notNull(),
    url: text("url").notNull(),
    commentsUrl: text("comments_url"),
    score: integer("score"),
    commentsCount: integer("comments_count"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("news_items_channel_published_idx").on(t.channelId, t.publishedAt),
    index("news_items_published_idx").on(t.publishedAt),
  ]
)

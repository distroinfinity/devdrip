import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { channels } from "./channels.js"

// kind values: 'hn' | 'rss' | 'reddit'
export const newsSources = pgTable(
  "news_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // e.g. 'hn-top' | 'techcrunch-rss'
    kind: text("kind").notNull(),
    url: text("url").notNull(),
    halfLifeHours: real("half_life_hours").notNull().default(12),
    fetchIntervalMin: integer("fetch_interval_min").notNull().default(5),
    healthy: boolean("healthy").notNull().default(true),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("news_sources_key_uq").on(t.key)]
)

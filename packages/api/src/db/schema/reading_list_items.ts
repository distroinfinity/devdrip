import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core"
import { users } from "./users.js"

// snapshot fields (headline/url/score) so reading list survives upstream edits
// or link rot. source-of-truth for current hn state stays in redis, not here.
export const readingListItems = pgTable(
  "reading_list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    newsId: text("news_id").notNull(),
    source: text("source").notNull(),
    headline: text("headline").notNull(),
    url: text("url").notNull(),
    score: integer("score").notNull(),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdSavedAtIdx: index("reading_user_saved_idx").on(t.userId, t.savedAt),
    uniqueUserNews: uniqueIndex("reading_user_news_unique").on(t.userId, t.newsId),
  })
)

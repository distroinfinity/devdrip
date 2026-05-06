import { pgTable, uuid, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core"
import type { SlotKind } from "@distrotv/shared"
import { users } from "./users.js"
import { devices } from "./devices.js"

// analytics ledger for all slot views (news, ticker, sponsored, portfolio).
// fully isolated from earnings — there is no earned_amount column here, by design.
export const slotImpressions = pgTable(
  "slot_impressions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    // namespaced: "hn:38291043"
    newsId: text("news_id").notNull(),
    // string at db level; enum at app layer (NewsSource)
    source: text("source").notNull(),
    durationMs: integer("duration_ms").notNull(),
    // ImpressionResult value (text-coerced)
    result: text("result").notNull(),
    openedUrl: boolean("opened_url").notNull().default(false),
    // denormalized — duplicates reading_list_items existence; useful for analytics joins
    saved: boolean("saved").notNull().default(false),
    kind: text("kind").$type<SlotKind>().notNull().default("news"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index("slot_impressions_user_id_idx").on(t.userId),
    userCreatedAtIdx: index("slot_impressions_user_created_at_idx").on(t.userId, t.createdAt),
  })
)

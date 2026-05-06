import { pgTable, uuid, integer, timestamp, primaryKey, index } from "drizzle-orm/pg-core"
import { users } from "./users.js"
import { channels } from "./channels.js"

export const channelSubscriptions = pgTable(
  "channel_subscriptions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    // 0 = top priority; ties allowed (rare for 100-user scale)
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.channelId] }),
    index("channel_subscriptions_user_idx").on(t.userId),
  ]
)

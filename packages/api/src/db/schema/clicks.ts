import { pgTable, uuid, timestamp, index } from "drizzle-orm/pg-core"
import { impressions } from "./impressions.js"

export const clicks = pgTable(
  "clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    impressionId: uuid("impression_id")
      .notNull()
      .unique()
      .references(() => impressions.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("clicks_created_idx").on(t.createdAt)]
)

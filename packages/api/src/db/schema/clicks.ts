import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core"
import { impressions } from "./impressions.js"

export const clicks = pgTable("clicks", {
  id: uuid("id").primaryKey().defaultRandom(),
  impressionId: uuid("impression_id")
    .notNull()
    .unique()
    .references(() => impressions.id, { onDelete: "restrict" }),
  // creative_id intentionally omitted — derive via impression_id -> impressions.creative_id
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core"
import { impressions } from "./impressions.js"
import { creatives } from "./creatives.js"

export const clicks = pgTable("clicks", {
  id: uuid("id").primaryKey().defaultRandom(),
  impressionId: uuid("impression_id")
    .notNull()
    .unique()
    .references(() => impressions.id, { onDelete: "restrict" }),
  creativeId: uuid("creative_id")
    .notNull()
    .references(() => creatives.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

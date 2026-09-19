import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { users } from "./users.js"
import { devices } from "./devices.js"

// one row per served ad that was seen or clicked. seed of the exchange ledger:
// slot, audience (user/device), impression, click, price.
export const adImpressions = pgTable(
  "ad_impressions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    deliveryId: uuid("delivery_id").notNull(),
    adId: text("ad_id").notNull(),
    source: text("source").notNull(),
    advertiser: text("advertiser").notNull(),
    headline: text("headline").notNull(),
    targetUrl: text("target_url").notNull(),
    durationMs: integer("duration_ms").notNull().default(0),
    // ImpressionResult, or "pending" when a click arrived before the impression synced
    result: text("result").notNull().default("pending"),
    clicked: boolean("clicked").notNull().default(false),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    cpmRate: numeric("cpm_rate", { precision: 12, scale: 6 }).notNull(),
    earnedAmount: numeric("earned_amount", { precision: 12, scale: 6 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    deliveryUq: uniqueIndex("ad_impressions_delivery_uq").on(t.deliveryId),
    userCreatedIdx: index("ad_impressions_user_created_idx").on(t.userId, t.createdAt),
  })
)

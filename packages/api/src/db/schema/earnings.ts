import { pgEnum, pgTable, uuid, numeric, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core"
import { users } from "./users.js"
import { impressions } from "./impressions.js"
import { adSurfaceEnum, adCategoryEnum } from "./creatives.js"

export const earningStatusEnum = pgEnum("earning_status", ["pending", "confirmed"])

export const earningsLedger = pgTable(
  "earnings_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    impressionId: uuid("impression_id")
      .notNull()
      .references(() => impressions.id, { onDelete: "restrict" }),
    amountUsdc: numeric("amount_usdc", { precision: 12, scale: 6, mode: "number" }).notNull(),
    surface: adSurfaceEnum("surface").notNull(),
    adCategory: adCategoryEnum("ad_category").notNull(),
    status: earningStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("earnings_user_created_idx").on(t.userId, t.createdAt),
    uniqueIndex("earnings_impression_unique_idx").on(t.impressionId),
  ]
)

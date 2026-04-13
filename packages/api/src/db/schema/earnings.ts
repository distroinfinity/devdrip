import { pgEnum, pgTable, uuid, numeric, varchar, timestamp, index } from "drizzle-orm/pg-core"
import { users } from "./users.js"
import { impressions } from "./impressions.js"

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
    amountUsdc: numeric("amount_usdc", { precision: 12, scale: 6 }).notNull(),
    surface: varchar("surface", { length: 30 }).notNull(),
    adCategory: varchar("ad_category", { length: 50 }).notNull(),
    status: earningStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("earnings_user_created_idx").on(t.userId, t.createdAt)]
)

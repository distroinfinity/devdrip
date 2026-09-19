import { pgEnum, pgTable, uuid, numeric, varchar, timestamp, index } from "drizzle-orm/pg-core"
import { users } from "./users.js"

export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "processing",
  "confirmed",
  "failed",
])

export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    amountUsdc: numeric("amount_usdc", { precision: 12, scale: 6, mode: "number" }).notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }).unique(),
    status: payoutStatusEnum("status").notNull().default("pending"),
    failureReason: varchar("failure_reason", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payouts_user_idx").on(t.userId)]
)

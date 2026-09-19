import {
  pgEnum,
  pgTable,
  uuid,
  numeric,
  varchar,
  timestamp,
  bigint,
  integer,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
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
    txBlockNumber: bigint("tx_block_number", { mode: "number" }),
    status: payoutStatusEnum("status").notNull().default("pending"),
    failureReason: varchar("failure_reason", { length: 500 }),
    // Settlement & idempotency (added in PR1 — populated by API/worker in PR2/PR3)
    idempotencyKey: uuid("idempotency_key").notNull().defaultRandom(),
    retryCount: integer("retry_count").notNull().default(0),
    lastRetryAt: timestamp("last_retry_at", { withTimezone: true }),
    // Auto-disburse week marker — NULL for claim-initiated payouts.
    scheduledForWeek: date("scheduled_for_week"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payouts_user_idx").on(t.userId),
    uniqueIndex("payouts_idempotency_key_unique").on(t.idempotencyKey),
    uniqueIndex("payouts_user_week_unique").on(t.userId, t.scheduledForWeek),
    // Partial index for the settlement worker's hot scan path. Drizzle's index()
    // doesn't support WHERE in 0.45 — the actual partial index lives in raw SQL
    // in 0006_world_identity.sql. The index() entry below documents intent.
    index("payouts_status_created_idx").on(t.status, t.createdAt),
  ]
)

import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core"
import { users } from "./users.js"

export const onchainPositions = pgTable(
  "onchain_positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chainId: integer("chain_id").notNull(),
    poolId: text("pool_id").notNull(),
    positionTokenId: text("position_token_id"),
    tickLower: integer("tick_lower").notNull(),
    tickUpper: integer("tick_upper").notNull(),
    walletAddress: text("wallet_address").notNull(),
    label: text("label"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("onchain_positions_user_idx").on(t.userId)]
)

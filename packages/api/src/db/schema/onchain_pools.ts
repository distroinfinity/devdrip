import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core"

export const onchainPools = pgTable("onchain_pools", {
  poolId: text("pool_id").primaryKey(),
  chainId: integer("chain_id").notNull(),
  hookAddress: text("hook_address").notNull(),
  label: text("label").notNull(),
  token0: text("token0").notNull(),
  token1: text("token1").notNull(),
  token0Decimals: integer("token0_decimals").notNull().default(18),
  token1Decimals: integer("token1_decimals").notNull().default(18),
  tickSpacing: integer("tick_spacing").notNull(),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

import { pgTable, text, boolean, timestamp, index } from "drizzle-orm/pg-core"

export const tickerSymbolMap = pgTable(
  "ticker_symbol_map",
  {
    symbol: text("symbol").primaryKey(),
    assetClass: text("asset_class").notNull(),
    provider: text("provider").notNull(),
    providerId: text("provider_id").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ticker_symbol_map_provider_idx").on(t.provider)]
)

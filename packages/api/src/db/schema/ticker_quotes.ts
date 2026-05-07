import { pgTable, text, real, timestamp, boolean, index } from "drizzle-orm/pg-core"

export const tickerQuotes = pgTable(
  "ticker_quotes",
  {
    symbol: text("symbol").primaryKey(),
    assetClass: text("asset_class").notNull(),
    price: real("price").notNull(),
    changePct: real("change_pct").notNull(),
    prevClose: real("prev_close").notNull(),
    lastProvider: text("last_provider").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    stale: boolean("stale").notNull().default(false),
  },
  (t) => [index("ticker_quotes_fetched_at_idx").on(t.fetchedAt)]
)

import { pgTable, uuid, text, integer, timestamp, primaryKey, index } from "drizzle-orm/pg-core"
import { watchlists } from "./watchlists.js"

export const watchlistTickers = pgTable(
  "watchlist_tickers",
  {
    watchlistId: uuid("watchlist_id")
      .notNull()
      .references(() => watchlists.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    assetClass: text("asset_class").notNull(),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.watchlistId, t.symbol] }),
    index("watchlist_tickers_symbol_idx").on(t.symbol),
  ]
)

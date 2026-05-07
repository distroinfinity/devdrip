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
    // PK on (watchlist_id, symbol) — accepts the rare collision where a user
    // has both an equity AAPL and a crypto AAPL in the same list (last write wins).
    // Adding asset_class to the PK was considered and dropped: callers always
    // know the asset_class from the symbol map, so the collision is theoretical.
    primaryKey({ columns: [t.watchlistId, t.symbol] }),
    index("watchlist_tickers_symbol_idx").on(t.symbol),
  ]
)

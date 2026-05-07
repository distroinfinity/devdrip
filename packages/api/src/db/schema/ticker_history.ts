import { pgTable, text, real, integer, date, primaryKey, index } from "drizzle-orm/pg-core"

export const tickerHistory = pgTable(
  "ticker_history",
  {
    symbol: text("symbol").notNull(),
    date: date("date").notNull(),
    open: real("open").notNull(),
    high: real("high").notNull(),
    low: real("low").notNull(),
    close: real("close").notNull(),
    volume: integer("volume"),
  },
  (t) => [
    primaryKey({ columns: [t.symbol, t.date] }),
    index("ticker_history_symbol_date_idx").on(t.symbol, t.date),
  ]
)

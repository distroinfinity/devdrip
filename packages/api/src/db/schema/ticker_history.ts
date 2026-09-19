import { pgTable, text, real, date, primaryKey, index } from "drizzle-orm/pg-core"
import { desc } from "drizzle-orm"

// volume is `real` not `integer`: crypto USD-denominated volume routinely
// exceeds int32 max (~2.1B). real avoids silent overflow at the fetcher boundary.
export const tickerHistory = pgTable(
  "ticker_history",
  {
    symbol: text("symbol").notNull(),
    date: date("date").notNull(),
    open: real("open").notNull(),
    high: real("high").notNull(),
    low: real("low").notNull(),
    close: real("close").notNull(),
    volume: real("volume"),
  },
  (t) => [
    primaryKey({ columns: [t.symbol, t.date] }),
    // descending on date — chart query reads newest-first
    index("ticker_history_symbol_date_idx").on(t.symbol, desc(t.date)),
  ]
)

import { pgTable, uuid, text, real, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core"
import { users } from "./users.js"

// scope values: 'global' | 'per_ticker'
// symbol is null when scope='global' (one global rule per user, applied to every watched ticker
// unless a matching per_ticker override exists).
export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: text("symbol"),
    scope: text("scope").notNull(),
    thresholdPct: real("threshold_pct").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("alerts_user_symbol_uq").on(t.userId, t.symbol),
    index("alerts_user_idx").on(t.userId),
  ]
)

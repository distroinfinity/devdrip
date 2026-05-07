import { desc } from "drizzle-orm"
import { pgTable, uuid, text, real, timestamp, index } from "drizzle-orm/pg-core"
import { users } from "./users.js"
import { devices } from "./devices.js"

// per-fire log. one row per (user, device, symbol) fire — fan-out happens at insert time.
// fired_at drives the 60-min per-(device, symbol) debounce.
export const alertEvents = pgTable(
  "alert_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    changePct: real("change_pct").notNull(),
    thresholdPct: real("threshold_pct").notNull(),
    firedAt: timestamp("fired_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // descending on fired_at — debounce query reads newest fire first.
    index("alert_events_device_symbol_fired_idx").on(t.deviceId, t.symbol, desc(t.firedAt)),
    index("alert_events_user_fired_idx").on(t.userId, desc(t.firedAt)),
  ]
)

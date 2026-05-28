import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core"
import { users } from "./users.js"

export const onchainEvents = pgTable(
  "onchain_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id"),
    positionId: uuid("position_id"),
    type: text("type").notNull(),
    payload: jsonb("payload"),
    firedAt: timestamp("fired_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("onchain_events_device_type_idx").on(t.deviceId, t.type, t.firedAt)]
)

import { pgEnum, pgTable, uuid, varchar, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { users } from "./users.js"

export const ideTypeEnum = pgEnum("ide_type", ["terminal", "vscode", "cursor"])

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    machineIdHash: varchar("machine_id_hash", { length: 64 }).notNull(),
    deviceName: varchar("device_name", { length: 255 }),
    os: varchar("os", { length: 50 }).notNull(),
    ideType: ideTypeEnum("ide_type").notNull(),
    lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("devices_user_machine_idx").on(t.userId, t.machineIdHash)]
)

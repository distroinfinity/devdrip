import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core"
import { users } from "./users.js"

export const preferences = pgTable("preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  blockedCategories: text("blocked_categories").array().notNull().default([]),
  enabledSurfaces: text("enabled_surfaces").array().notNull().default([]),
  maxPerHour: integer("max_per_hour").notNull().default(8),
  maxPerDay: integer("max_per_day").notNull().default(60),
  quietHoursStart: integer("quiet_hours_start"),
  quietHoursEnd: integer("quiet_hours_end"),
  tzOffsetMinutes: integer("tz_offset_minutes").notNull().default(0),
  idleSensitivityMs: integer("idle_sensitivity_ms").notNull().default(10_000),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

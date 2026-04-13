import {
  pgEnum,
  pgTable,
  uuid,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core"
import { creatives, adSourceEnum, adSurfaceEnum } from "./creatives.js"
import { campaigns } from "./campaigns.js"
import { devices } from "./devices.js"

export const impressionResultEnum = pgEnum("impression_result", [
  "completed",
  "skipped",
  "expired",
  "interrupted",
])

export const impressions = pgTable(
  "impressions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creativeId: uuid("creative_id")
      .notNull()
      .references(() => creatives.id, { onDelete: "restrict" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "restrict" }),
    source: adSourceEnum("source").notNull(),
    surface: adSurfaceEnum("surface").notNull(),
    durationMs: integer("duration_ms").notNull(),
    result: impressionResultEnum("result").notNull(),
    cpmRate: numeric("cpm_rate", { precision: 12, scale: 6 }).notNull(),
    earnedAmount: numeric("earned_amount", { precision: 12, scale: 6 }).notNull(),
    clicked: boolean("clicked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("impressions_device_created_idx").on(t.deviceId, t.createdAt)]
)

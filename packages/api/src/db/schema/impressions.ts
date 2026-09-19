import {
  pgEnum,
  pgTable,
  uuid,
  integer,
  numeric,
  timestamp,
  index,
  varchar,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { creatives, adSourceEnum, adSurfaceEnum } from "./creatives.js"
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
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "restrict" }),
    source: adSourceEnum("source").notNull(),
    surface: adSurfaceEnum("surface").notNull(),
    durationMs: integer("duration_ms").notNull(),
    result: impressionResultEnum("result").notNull(),
    cpmRate: numeric("cpm_rate", { precision: 12, scale: 6, mode: "number" }).notNull(),
    earnedAmount: numeric("earned_amount", { precision: 12, scale: 6, mode: "number" }).notNull(),
    // S3-06: clicks look up their parent by this JWT jti. Nullable for old rows.
    deliveryJti: varchar("delivery_jti", { length: 36 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("impressions_device_created_idx").on(t.deviceId, t.createdAt),
    index("impressions_source_created_idx").on(t.source, t.createdAt),
    uniqueIndex("impressions_delivery_jti_idx").on(t.deliveryJti),
  ]
)

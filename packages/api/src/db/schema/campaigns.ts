import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  numeric,
  jsonb,
  timestamp,
  text,
  index,
} from "drizzle-orm/pg-core"
import { advertisers } from "./advertisers.js"

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "active",
  "paused",
  "completed",
])

export const pacingStrategyEnum = pgEnum("pacing_strategy", ["even", "front_loaded", "asap"])

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    advertiserId: uuid("advertiser_id")
      .notNull()
      .references(() => advertisers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    budgetTotal: numeric("budget_total", { precision: 12, scale: 6 }).notNull(),
    budgetDaily: numeric("budget_daily", { precision: 12, scale: 6 }).notNull(),
    budgetSpent: numeric("budget_spent", { precision: 12, scale: 6 }).notNull().default("0"),
    cpmRate: numeric("cpm_rate", { precision: 12, scale: 6 }).notNull(),
    targetCategories: text("target_categories").array().notNull().default([]),
    targetSurfaces: text("target_surfaces").array().notNull().default([]),
    targetingRules: jsonb("targeting_rules"),
    pacingStrategy: pacingStrategyEnum("pacing_strategy").notNull().default("even"),
    status: campaignStatusEnum("status").notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("campaigns_status_starts_idx").on(t.status, t.startsAt)]
)

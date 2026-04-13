import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core"
import { campaigns } from "./campaigns.js"

export const adSourceEnum = pgEnum("ad_source", [
  "direct",
  "carbon",
  "ethicalads",
  "google",
  "amazon",
  "x402",
])

export const adFormatEnum = pgEnum("ad_format", ["text", "banner", "sponsored-link"])

export const adSurfaceEnum = pgEnum("ad_surface", [
  "terminal-tv",
  "companion-tab",
  "idle-dashboard",
  "digest",
  "challenge",
  "audio",
])

export const creatives = pgTable(
  "creatives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    headline: varchar("headline", { length: 60 }).notNull(),
    body: varchar("body", { length: 140 }),
    ctaText: varchar("cta_text", { length: 30 }),
    ctaUrl: varchar("cta_url", { length: 2048 }),
    format: adFormatEnum("format").notNull().default("text"),
    surface: adSurfaceEnum("surface").notNull().default("terminal-tv"),
    category: varchar("category", { length: 50 }).notNull(),
    source: adSourceEnum("source").notNull(),
    cpmRate: numeric("cpm_rate", { precision: 12, scale: 6 }).notNull(),
    externalCampaignId: varchar("external_campaign_id", { length: 255 }),
    externalCreativeId: varchar("external_creative_id", { length: 255 }),
    impressionBeaconUrl: varchar("impression_beacon_url", { length: 2048 }),
    clickTrackingUrl: varchar("click_tracking_url", { length: 2048 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("creatives_source_active_idx").on(t.source, t.isActive),
    index("creatives_category_idx").on(t.category),
  ]
)

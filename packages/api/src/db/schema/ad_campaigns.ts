import { pgTable, uuid, text, numeric, timestamp, index } from "drizzle-orm/pg-core"
import { users } from "./users.js"

// an ad someone wrote in the advertiser portal. served ahead of network fill,
// highest bid first. ad_impressions rows reference it as ad_id = "direct:<id>".
export const adCampaigns = pgTable(
  "ad_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    brand: text("brand").notNull(),
    line: text("line").notNull(),
    url: text("url").notNull(),
    // the advertiser's cpm bid: sets serve order and the price of each impression
    bidCpm: numeric("bid_cpm", { precision: 12, scale: 6 }).notNull(),
    // "active" | "paused" | "review"
    status: text("status").notNull().default("review"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index("ad_campaigns_owner_idx").on(t.ownerUserId, t.createdAt),
    statusBidIdx: index("ad_campaigns_status_bid_idx").on(t.status, t.bidCpm),
  })
)

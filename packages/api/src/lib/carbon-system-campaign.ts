import { createHash } from "node:crypto"
import { sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { advertisers } from "../db/schema/advertisers.js"
import { campaigns } from "../db/schema/campaigns.js"
import { env } from "../config/env.js"
import { logger } from "./logger.js"

// deterministic UUIDs derived from a fixed namespace
// ensures the same IDs across all environments without querying the DB
function deterministicUuid(name: string): string {
  const hash = createHash("sha256").update(`devdrip:${name}`).digest("hex")
  // format as UUID v4-like: 8-4-4-4-12
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-")
}

export const CARBON_ADVERTISER_ID = deterministicUuid("carbon-ads-advertiser")
export const CARBON_CAMPAIGN_ID = deterministicUuid("carbon-ads-campaign")

let ensured = false

export async function ensureCarbonSystemCampaign(): Promise<void> {
  if (ensured) return

  const db = getDb()

  await db
    .insert(advertisers)
    .values({
      id: CARBON_ADVERTISER_ID,
      name: "Carbon Ads",
      contactEmail: "publishers@buysellads.com",
      companyName: "BuySellAds",
    })
    .onConflictDoNothing({ target: advertisers.id })

  await db
    .insert(campaigns)
    .values({
      id: CARBON_CAMPAIGN_ID,
      advertiserId: CARBON_ADVERTISER_ID,
      name: "Carbon Ads Network",
      budgetTotal: 999_999_999,
      budgetDaily: 999_999_999,
      budgetSpent: 0,
      cpmRate: env.carbonCpmRate,
      pacingStrategy: "asap",
      status: "active",
      targetCategories: [],
      targetSurfaces: [],
    })
    .onConflictDoNothing({ target: campaigns.id })

  // keep cpmRate in sync with env on restart
  await db
    .update(campaigns)
    .set({ cpmRate: env.carbonCpmRate, updatedAt: new Date() })
    .where(sql`${campaigns.id} = ${CARBON_CAMPAIGN_ID}`)

  ensured = true
  logger.info("carbon system campaign ensured")
}

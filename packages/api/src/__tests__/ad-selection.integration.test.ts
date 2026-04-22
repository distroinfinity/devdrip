// Integration regression for: raw `Date` values in a drizzle `sql` template
// blow up at Bind time under postgres-js ("argument must be of type string or
// Buffer"). Catches the class of bug where the unit test with a mocked DB
// passes but the real driver rejects. Runs only when DATABASE_URL_LOCAL is set.
//
// See: packages/api/src/services/ad-selection.service.ts — use nowIso, not now.

import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { AdSurface, type AdRequest } from "@devdrip/shared"
import * as schema from "../db/schema/index.js"
import { campaigns } from "../db/schema/campaigns.js"
import { creatives } from "../db/schema/creatives.js"
import { advertisers } from "../db/schema/advertisers.js"

const DATABASE_URL = process.env["DATABASE_URL_LOCAL"] ?? process.env["DATABASE_URL"] ?? ""
const ENABLED = DATABASE_URL.length > 0

const ADVERTISER_ID = randomUUID()
const CAMPAIGN_ID = randomUUID()
const CREATIVE_ID = randomUUID()

describe.skipIf(!ENABLED)("ad-selection integration (real postgres)", () => {
  let sqlClient: ReturnType<typeof postgres>
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    sqlClient = postgres(DATABASE_URL, { max: 1 })
    db = drizzle(sqlClient, { schema })

    // seed: one active advertiser → active campaign → one manual creative.
    // `creatives.source <> 'carbon'` in the provider's query means a non-carbon
    // source will be selected; `manual` works (column is free-form).
    await db.insert(advertisers).values({
      id: ADVERTISER_ID,
      name: "integ-test-advertiser",
      contactEmail: `integ-${ADVERTISER_ID.slice(0, 8)}@test.local`,
      companyName: "Integ Co",
    })
    await db.insert(campaigns).values({
      id: CAMPAIGN_ID,
      advertiserId: ADVERTISER_ID,
      name: "integ-test-campaign",
      status: "active",
      budgetTotal: 1000,
      budgetSpent: 0,
      budgetDaily: 100,
      cpmRate: 5,
      targetSurfaces: [AdSurface.TerminalTv],
      targetingRules: null,
      pacingStrategy: "even",
      startsAt: new Date(Date.now() - 3600_000), // 1h ago
      endsAt: new Date(Date.now() + 24 * 3600_000), // 1d from now
    })
    await db.insert(creatives).values({
      id: CREATIVE_ID,
      campaignId: CAMPAIGN_ID,
      headline: "integ test ad",
      body: "integ test body",
      ctaUrl: "https://example.com",
      ctaText: "Click",
      format: "text",
      surface: AdSurface.TerminalTv,
      category: "developer-tools",
      source: "direct",
      cpmRate: 5,
      isActive: true,
    })
  })

  afterAll(async () => {
    if (!sqlClient) return
    await db.delete(creatives).where(eq(creatives.id, CREATIVE_ID))
    await db.delete(campaigns).where(eq(campaigns.id, CAMPAIGN_ID))
    await db.delete(advertisers).where(eq(advertisers.id, ADVERTISER_ID))
    await sqlClient.end({ timeout: 5 })
  })

  // must set DATABASE_URL_LOCAL for the env-module singleton to pick up before
  // dynamic-importing the provider
  it("manualAdProvider.fetchAds with count>1 does not throw at Bind time", async () => {
    process.env["DB_TARGET"] = "local"
    process.env["DATABASE_URL_LOCAL"] = DATABASE_URL
    const { manualAdProvider } = await import("../services/ad-selection.service.js")

    const req: AdRequest = {
      deviceId: randomUUID(),
      userId: randomUUID(),
      os: "darwin",
      ideType: "terminal",
      surface: AdSurface.TerminalTv,
      count: 5, // >1 forces the code path that was broken
      blockedCategories: [],
      enabledSurfaces: [AdSurface.TerminalTv],
      maxAdsPerHour: 8,
      maxAdsPerDay: 60,
      tzOffsetMinutes: 0,
    }

    // before the fix this throws TypeError: argument must be string or Buffer
    const result = await manualAdProvider.fetchAds(req)
    expect(Array.isArray(result)).toBe(true)
    // our seeded creative should surface
    expect(result.some((a) => a.id === CREATIVE_ID)).toBe(true)
  })
})

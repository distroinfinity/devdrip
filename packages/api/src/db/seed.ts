/* eslint-disable @typescript-eslint/no-non-null-assertion */
import "dotenv/config"
import { getDb } from "./index.js"
import { advertisers } from "./schema/advertisers.js"
import { campaigns } from "./schema/campaigns.js"
import { creatives } from "./schema/creatives.js"
import { users } from "./schema/users.js"
import { devices } from "./schema/devices.js"
import { preferences } from "./schema/preferences.js"
import { impressions } from "./schema/impressions.js"
import { earningsLedger } from "./schema/earnings.js"
import { inviteCodes } from "./schema/invite_codes.js"

async function seed() {
  const db = getDb()

  console.log("seeding database...")

  // 1. advertiser
  const [advertiser] = await db
    .insert(advertisers)
    .values({
      name: "DevDrip Test Co",
      contactEmail: "ads@devdriptest.com",
      companyName: "DevDrip Test Co",
      billingInfo: { method: "stripe", stripeCustomerId: "cus_test_123" },
    })
    .returning()
  console.log("  advertiser:", advertiser?.id)

  // 2. campaign — active, $100 budget, $2.50 CPM
  const [campaign] = await db
    .insert(campaigns)
    .values({
      advertiserId: advertiser!.id,
      name: "Dev Tools Launch Q2",
      budgetTotal: 100.0,
      budgetDaily: 10.0,
      budgetSpent: 0,
      cpmRate: 2.5,
      targetCategories: ["developer-tools", "cloud-infrastructure"],
      targetSurfaces: ["terminal-tv", "companion-tab", "idle-dashboard"],
      status: "active",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    })
    .returning()
  console.log("  campaign:", campaign?.id)

  // 3. creatives — one per surface
  const creativeData = [
    {
      campaignId: campaign!.id,
      headline: "Ship faster with Turbo CI",
      body: "Cut build times by 70%. Try free for 30 days.",
      ctaText: "Try free",
      ctaUrl: "https://example.com/turbo-ci",
      surface: "terminal-tv" as const,
      category: "developer-tools" as const,
      source: "direct" as const,
      cpmRate: 2.5,
    },
    {
      campaignId: campaign!.id,
      headline: "PlanetScale — serverless MySQL",
      body: "Branch your database like code.",
      ctaText: "Learn more",
      ctaUrl: "https://example.com/planetscale",
      surface: "companion-tab" as const,
      category: "databases" as const,
      source: "direct" as const,
      cpmRate: 2.5,
    },
    {
      campaignId: campaign!.id,
      headline: "Datadog for startups",
      body: "Free tier for teams under 5. Full-stack observability.",
      ctaText: "Get started",
      ctaUrl: "https://example.com/datadog",
      surface: "idle-dashboard" as const,
      category: "monitoring-observability" as const,
      source: "direct" as const,
      cpmRate: 2.5,
    },
  ]
  const insertedCreatives = await db.insert(creatives).values(creativeData).returning()
  console.log("  creatives:", insertedCreatives.length)

  // 4. users — 2 test users
  const [user1] = await db
    .insert(users)
    .values({
      githubId: 1001,
      githubLogin: "testdev",
      email: "testdev@example.com",
      avatarUrl: "https://avatars.githubusercontent.com/u/1001",
      reposCount: 42,
      primaryLanguage: "TypeScript",
      referralCode: "TESTDEV1",
      tosAcceptedAt: new Date(),
      dataSharingConsent: true,
    })
    .returning()

  const [user2] = await db
    .insert(users)
    .values({
      githubId: 1002,
      githubLogin: "seeduser",
      email: "seeduser@example.com",
      avatarUrl: "https://avatars.githubusercontent.com/u/1002",
      reposCount: 15,
      primaryLanguage: "Python",
      referralCode: "SEEDUSR2",
      tosAcceptedAt: new Date(),
      dataSharingConsent: false,
    })
    .returning()
  console.log("  users:", user1?.id, user2?.id)

  // 5. devices — 1 per user
  const [device1] = await db
    .insert(devices)
    .values({
      userId: user1!.id,
      machineIdHash: "a".repeat(64),
      deviceName: "testdev-macbook",
      os: "darwin",
      ideType: "terminal",
      lastHeartbeat: new Date(),
    })
    .returning()

  const [device2] = await db
    .insert(devices)
    .values({
      userId: user2!.id,
      machineIdHash: "b".repeat(64),
      deviceName: "seeduser-linux",
      os: "linux",
      ideType: "vscode",
      lastHeartbeat: new Date(),
    })
    .returning()
  console.log("  devices:", device1?.id, device2?.id)

  // 6. preferences — defaults for each user
  await db.insert(preferences).values([
    {
      userId: user1!.id,
      enabledSurfaces: ["terminal-tv", "companion-tab", "idle-dashboard"],
    },
    {
      userId: user2!.id,
      enabledSurfaces: ["terminal-tv"],
      quietHoursStart: 23,
      quietHoursEnd: 7,
    },
  ])
  console.log("  preferences: 2")

  // 7. impressions — 5 (mix of completed/skipped)
  const impressionData = [
    {
      creativeId: insertedCreatives[0]!.id,
      deviceId: device1!.id,
      source: "direct" as const,
      surface: "terminal-tv" as const,
      durationMs: 5000,
      result: "completed" as const,
      cpmRate: 2.5,
      earnedAmount: 0.00175,
    },
    {
      creativeId: insertedCreatives[1]!.id,
      deviceId: device1!.id,
      source: "direct" as const,
      surface: "companion-tab" as const,
      durationMs: 3000,
      result: "completed" as const,
      cpmRate: 2.5,
      earnedAmount: 0.00175,
    },
    {
      creativeId: insertedCreatives[0]!.id,
      deviceId: device1!.id,
      source: "direct" as const,
      surface: "terminal-tv" as const,
      durationMs: 1200,
      result: "skipped" as const,
      cpmRate: 2.5,
      earnedAmount: 0,
    },
    {
      creativeId: insertedCreatives[2]!.id,
      deviceId: device2!.id,
      source: "direct" as const,
      surface: "idle-dashboard" as const,
      durationMs: 6000,
      result: "completed" as const,
      cpmRate: 2.5,
      earnedAmount: 0.00175,
    },
    {
      creativeId: insertedCreatives[0]!.id,
      deviceId: device2!.id,
      source: "direct" as const,
      surface: "terminal-tv" as const,
      durationMs: 800,
      result: "skipped" as const,
      cpmRate: 2.5,
      earnedAmount: 0,
    },
  ]
  const insertedImpressions = await db.insert(impressions).values(impressionData).returning()
  console.log("  impressions:", insertedImpressions.length)

  // 8. earnings_ledger — for completed impressions only
  const completedImpressions = insertedImpressions.filter(
    (_, i) => impressionData[i]?.result === "completed"
  )
  const earningsData = completedImpressions.map((imp, i) => ({
    userId: i < 2 ? user1!.id : user2!.id,
    impressionId: imp.id,
    amountUsdc: 0.00175,
    surface: impressionData[insertedImpressions.indexOf(imp)]?.surface ?? ("terminal-tv" as const),
    adCategory: "developer-tools" as const,
    status: "pending" as const,
  }))
  await db.insert(earningsLedger).values(earningsData)
  console.log("  earnings:", earningsData.length)

  // 9. invite codes — 3 unclaimed
  await db
    .insert(inviteCodes)
    .values([
      { code: "DEVDRIP-ALPHA-01" },
      { code: "DEVDRIP-ALPHA-02" },
      { code: "DEVDRIP-ALPHA-03" },
    ])
  console.log("  invite codes: 3")

  console.log("seed complete!")
  process.exit(0)
}

seed().catch((err) => {
  console.error("seed failed:", err)
  process.exit(1)
})

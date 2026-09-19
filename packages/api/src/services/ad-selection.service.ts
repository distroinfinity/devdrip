import { eq, and, ne, notInArray, isNotNull, sql } from "drizzle-orm"
import type {
  AdProvider,
  AdRequest,
  AdPayload,
  AdSurface,
  IdeType,
  TargetingRules,
} from "@devdrip/shared"
import { MAX_AD_DURATION_MS } from "@devdrip/shared"
import { getDb } from "../db/index.js"
import { campaigns } from "../db/schema/campaigns.js"
import { creatives } from "../db/schema/creatives.js"
import { checkCampaignCap } from "../lib/frequency.js"
import { nextCreativeIndex } from "../lib/budget.js"

// ── types ───────────────────────────────────────────────────────────────────

interface CandidateRow {
  id: string
  campaignId: string
  headline: string
  body: string | null
  ctaUrl: string | null
  format: string
  surface: string
  category: string
  source: string
  cpmRate: number
  impressionBeaconUrl: string | null
  clickTrackingUrl: string | null
  // campaign fields for targeting/budget checks
  campBudgetTotal: number
  campBudgetSpent: number
  campBudgetDaily: number
  campPacingStrategy: string
  campTargetSurfaces: string[]
  campTargetingRules: unknown
}

// ── helpers ─────────────────────────────────────────────────────────────────

function matchesTargeting(
  rules: TargetingRules | null | undefined,
  os: string,
  ideType: IdeType
): boolean {
  if (!rules) return true
  if (rules.osAllow && rules.osAllow.length > 0 && !rules.osAllow.includes(os)) return false
  if (rules.ideAllow && rules.ideAllow.length > 0 && !rules.ideAllow.includes(ideType)) return false
  return true
}

function hasBudgetRemaining(budgetTotal: number, budgetSpent: number, cpmRate: number): boolean {
  return budgetTotal - budgetSpent > cpmRate / 1000
}

function toAdPayload(row: CandidateRow): AdPayload {
  const rules = row.campTargetingRules as TargetingRules | null | undefined
  const cap = typeof rules?.maxImpressions === "number" ? rules.maxImpressions : undefined
  return {
    id: row.id,
    campaignId: row.campaignId,
    format: row.format as AdPayload["format"],
    headline: row.headline,
    body: row.body ?? undefined,
    url: row.ctaUrl ?? "",
    displayTimeMs: MAX_AD_DURATION_MS,
    cpmRate: row.cpmRate,
    impressionBeaconUrl: row.impressionBeaconUrl ?? undefined,
    clickTrackingUrl: row.clickTrackingUrl ?? undefined,
    campaignMaxImpressionsPerDay: cap,
  }
}

// ── fetch ads ───────────────────────────────────────────────────────────────

async function fetchAds(request: AdRequest): Promise<AdPayload[]> {
  // note: frequency caps, quiet hours, and surface checks are handled
  // by the waterfall orchestrator in ad-delivery.service.ts before calling providers.

  // stage 1: DB query — candidate set
  const db = getDb()
  // postgres-js can't serialize a raw Date inside a drizzle `sql` template
  // (throws "argument must be of type string or Buffer, received Date" in
  // Bind); send ISO strings instead, which are fine for timestamptz columns.
  const nowIso = new Date().toISOString()

  const conditions = [
    eq(campaigns.status, "active"),
    eq(creatives.isActive, true),
    eq(creatives.surface, request.surface as AdSurface),
    isNotNull(creatives.ctaUrl),
    ne(creatives.source, "carbon"), // Carbon creatives are served by the Carbon provider
  ]

  // exclude blocked categories
  if (request.blockedCategories.length > 0) {
    conditions.push(notInArray(creatives.category, request.blockedCategories))
  }

  const candidates = (await db
    .select({
      id: creatives.id,
      campaignId: creatives.campaignId,
      headline: creatives.headline,
      body: creatives.body,
      ctaUrl: creatives.ctaUrl,
      format: creatives.format,
      surface: creatives.surface,
      category: creatives.category,
      source: creatives.source,
      cpmRate: creatives.cpmRate,
      impressionBeaconUrl: creatives.impressionBeaconUrl,
      clickTrackingUrl: creatives.clickTrackingUrl,
      campBudgetTotal: campaigns.budgetTotal,
      campBudgetSpent: campaigns.budgetSpent,
      campBudgetDaily: campaigns.budgetDaily,
      campPacingStrategy: campaigns.pacingStrategy,
      campTargetSurfaces: campaigns.targetSurfaces,
      campTargetingRules: campaigns.targetingRules,
    })
    .from(creatives)
    .innerJoin(campaigns, eq(creatives.campaignId, campaigns.id))
    .where(
      and(
        ...conditions,
        // date range: only include campaigns whose window covers now
        sql`(${campaigns.startsAt} IS NULL OR ${campaigns.startsAt} <= ${nowIso})`,
        sql`(${campaigns.endsAt} IS NULL OR ${campaigns.endsAt} > ${nowIso})`
      )
    )) as CandidateRow[]

  if (candidates.length === 0) return []

  // stage 2: app-level targeting filter
  const filtered: CandidateRow[] = []

  for (const row of candidates) {
    // campaign surface restriction
    if (row.campTargetSurfaces.length > 0 && !row.campTargetSurfaces.includes(request.surface)) {
      continue
    }

    // OS / IDE targeting
    const rules = row.campTargetingRules as TargetingRules | null
    if (!matchesTargeting(rules, request.os, request.ideType)) continue

    // budget pre-screen
    if (!hasBudgetRemaining(row.campBudgetTotal, row.campBudgetSpent, row.cpmRate)) continue

    // per-campaign frequency cap
    if (rules?.maxImpressions) {
      const allowed = await checkCampaignCap(request.deviceId, row.campaignId, rules.maxImpressions)
      if (!allowed) continue
    }

    filtered.push(row)
  }

  if (filtered.length === 0) return []

  // stage 3: rotation + selection
  // group by campaign, pick one creative per campaign via round-robin
  const byCampaign = new Map<string, CandidateRow[]>()
  for (const row of filtered) {
    const group = byCampaign.get(row.campaignId)
    if (group) group.push(row)
    else byCampaign.set(row.campaignId, [row])
  }

  const selected: AdPayload[] = []
  for (const [campaignId, group] of byCampaign) {
    if (selected.length >= request.count) break
    const idx = await nextCreativeIndex(campaignId)
    const pick = group[idx % group.length]
    if (pick) selected.push(toAdPayload(pick))
  }

  return selected
}

// ── export ──────────────────────────────────────────────────────────────────

export const manualAdProvider: AdProvider = {
  name: "manual",
  fetchAds,
}

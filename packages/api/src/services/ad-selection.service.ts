import { eq, and, notInArray, sql } from "drizzle-orm"
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
import { checkFrequencyCaps, checkCampaignCap, isQuietHours } from "../lib/frequency.js"
import { nextCreativeIndex } from "../lib/budget.js"
import { logger } from "../lib/logger.js"

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
  return {
    id: row.id,
    campaignId: row.campaignId,
    format: row.format as AdPayload["format"],
    headline: row.headline,
    body: row.body ?? undefined,
    url: row.ctaUrl ?? "",
    displayTimeMs: MAX_AD_DURATION_MS,
  }
}

// ── fetch ads ───────────────────────────────────────────────────────────────

async function fetchAds(request: AdRequest): Promise<AdPayload[]> {
  // stage 1: user-level gates (no DB)
  if (!request.enabledSurfaces.includes(request.surface)) {
    logger.debug({ surface: request.surface }, "surface disabled by user preferences")
    return []
  }

  if (isQuietHours(request.quietHoursStart, request.quietHoursEnd)) {
    logger.debug("quiet hours active, skipping ad fetch")
    return []
  }

  const capCheck = await checkFrequencyCaps(
    request.deviceId,
    request.surface,
    request.maxAdsPerHour,
    request.maxAdsPerDay
  )
  if (!capCheck.allowed) {
    logger.debug({ reason: capCheck.reason }, "frequency cap exceeded")
    return []
  }

  // stage 2: DB query — candidate set
  const db = getDb()
  const now = new Date()

  const conditions = [
    eq(campaigns.status, "active"),
    eq(creatives.isActive, true),
    eq(creatives.surface, request.surface as AdSurface),
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
        sql`(${campaigns.startsAt} IS NULL OR ${campaigns.startsAt} <= ${now})`,
        sql`(${campaigns.endsAt} IS NULL OR ${campaigns.endsAt} > ${now})`
      )
    )) as CandidateRow[]

  if (candidates.length === 0) return []

  // stage 3: app-level targeting filter
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

  // stage 4: rotation + selection
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

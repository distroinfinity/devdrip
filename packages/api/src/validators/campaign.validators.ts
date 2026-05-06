import { AdCategory, AdSurface } from "@distrotv/shared"
import { ValidationError } from "../errors/index.js"
import {
  validateUUID,
  validateStringField,
  validatePositiveNumber,
  validateEnumArray,
  validateOptionalEnumValue,
  validateDate,
  validateEnumValue,
  requireBody,
} from "./common.js"

const VALID_PACING = ["even", "front_loaded", "asap"] as const
const VALID_STATUSES = ["draft", "active", "paused", "completed"] as const
const AD_CATEGORIES = Object.values(AdCategory) as string[]
const AD_SURFACES = Object.values(AdSurface) as string[]

export type CampaignStatus = (typeof VALID_STATUSES)[number]

// ── types ───────────────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  advertiserId: string
  name: string
  budgetTotal: number
  budgetDaily: number
  cpmRate: number
  targetCategories: string[]
  targetSurfaces: string[]
  targetingRules: Record<string, unknown> | null
  pacingStrategy: "even" | "front_loaded" | "asap"
  startsAt: Date | null
  endsAt: Date | null
}

export interface UpdateCampaignInput {
  name?: string
  budgetTotal?: number
  budgetDaily?: number
  cpmRate?: number
  targetCategories?: string[]
  targetSurfaces?: string[]
  targetingRules?: Record<string, unknown> | null
  pacingStrategy?: "even" | "front_loaded" | "asap"
  startsAt?: Date | null
  endsAt?: Date | null
}

// ── create ──────────────────────────────────────────────────────────────────

export function validateCreateCampaign(body: unknown): CreateCampaignInput {
  const b = requireBody(body)

  const advertiserId = validateUUID(b["advertiserId"], "advertiser_id")
  const name = validateStringField(b["name"], "name", { required: true, maxLength: 255 })
  const budgetTotal = validatePositiveNumber(b["budgetTotal"], "budget_total")
  const budgetDaily = validatePositiveNumber(b["budgetDaily"], "budget_daily")
  const cpmRate = validatePositiveNumber(b["cpmRate"], "cpm_rate")

  if (budgetDaily > budgetTotal) {
    throw new ValidationError("budget_daily_exceeds_total")
  }

  const targetCategories = validateEnumArray(
    b["targetCategories"],
    AD_CATEGORIES,
    "target_categories"
  )
  const targetSurfaces = validateEnumArray(b["targetSurfaces"], AD_SURFACES, "target_surfaces")
  const pacingStrategy = validateOptionalEnumValue(
    b["pacingStrategy"],
    VALID_PACING,
    "pacing_strategy",
    "even"
  ) as "even" | "front_loaded" | "asap"

  // targeting rules — light structural check
  let targetingRules: Record<string, unknown> | null = null
  if (b["targetingRules"] !== undefined && b["targetingRules"] !== null) {
    if (typeof b["targetingRules"] !== "object" || Array.isArray(b["targetingRules"])) {
      throw new ValidationError("invalid_targeting_rules")
    }
    targetingRules = b["targetingRules"] as Record<string, unknown>
  }

  const startsAt = validateDate(b["startsAt"], "starts_at")
  const endsAt = validateDate(b["endsAt"], "ends_at")

  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new ValidationError("ends_at_must_be_after_starts_at")
  }

  return {
    advertiserId,
    name,
    budgetTotal,
    budgetDaily,
    cpmRate,
    targetCategories,
    targetSurfaces,
    targetingRules,
    pacingStrategy,
    startsAt,
    endsAt,
  }
}

// ── update ──────────────────────────────────────────────────────────────────

// current campaign state is needed for cross-field validation (budget, dates)
export function validateUpdateCampaign(
  body: unknown,
  current: {
    budgetTotal: number
    budgetSpent: number
    budgetDaily: number
    startsAt: Date | null
    endsAt: Date | null
  }
): UpdateCampaignInput {
  const b = requireBody(body)

  // reject status changes — use the dedicated endpoint
  if (b["status"] !== undefined) {
    throw new ValidationError("use_status_endpoint")
  }

  const updates: UpdateCampaignInput = {}
  let hasField = false

  if (b["name"] !== undefined) {
    updates.name = validateStringField(b["name"], "name", { required: true, maxLength: 255 })
    hasField = true
  }
  if (b["budgetTotal"] !== undefined) {
    updates.budgetTotal = validatePositiveNumber(b["budgetTotal"], "budget_total")
    if (updates.budgetTotal < current.budgetSpent) {
      throw new ValidationError("budget_total_below_spent")
    }
    hasField = true
  }
  if (b["budgetDaily"] !== undefined) {
    updates.budgetDaily = validatePositiveNumber(b["budgetDaily"], "budget_daily")
    hasField = true
  }
  if (b["cpmRate"] !== undefined) {
    updates.cpmRate = validatePositiveNumber(b["cpmRate"], "cpm_rate")
    hasField = true
  }
  if (b["targetCategories"] !== undefined) {
    updates.targetCategories = validateEnumArray(
      b["targetCategories"],
      AD_CATEGORIES,
      "target_categories"
    )
    hasField = true
  }
  if (b["targetSurfaces"] !== undefined) {
    updates.targetSurfaces = validateEnumArray(b["targetSurfaces"], AD_SURFACES, "target_surfaces")
    hasField = true
  }
  if (b["targetingRules"] !== undefined) {
    if (
      b["targetingRules"] !== null &&
      (typeof b["targetingRules"] !== "object" || Array.isArray(b["targetingRules"]))
    ) {
      throw new ValidationError("invalid_targeting_rules")
    }
    updates.targetingRules = b["targetingRules"] as Record<string, unknown> | null
    hasField = true
  }
  if (b["pacingStrategy"] !== undefined) {
    updates.pacingStrategy = validateEnumValue(
      b["pacingStrategy"],
      VALID_PACING,
      "pacing_strategy"
    ) as "even" | "front_loaded" | "asap"
    hasField = true
  }
  if (b["startsAt"] !== undefined) {
    updates.startsAt = b["startsAt"] === null ? null : validateDate(b["startsAt"], "starts_at")
    hasField = true
  }
  if (b["endsAt"] !== undefined) {
    updates.endsAt = b["endsAt"] === null ? null : validateDate(b["endsAt"], "ends_at")
    hasField = true
  }

  if (!hasField) throw new ValidationError("no_fields_to_update")

  // validate merged schedule — resolve final dates from update + current
  const finalStartsAt = updates.startsAt !== undefined ? updates.startsAt : current.startsAt
  const finalEndsAt = updates.endsAt !== undefined ? updates.endsAt : current.endsAt
  if (finalStartsAt && finalEndsAt && finalEndsAt <= finalStartsAt) {
    throw new ValidationError("ends_at_must_be_after_starts_at")
  }

  // validate merged budget — resolve final totals from update + current
  const finalTotal = updates.budgetTotal ?? current.budgetTotal
  const finalDaily = updates.budgetDaily ?? current.budgetDaily
  if (finalDaily > finalTotal) {
    throw new ValidationError("budget_daily_exceeds_total")
  }

  return updates
}

// ── status transition ───────────────────────────────────────────────────────

export function validateStatusTransition(body: unknown): { status: CampaignStatus } {
  const b = requireBody(body)
  const status = validateEnumValue(b["status"], VALID_STATUSES, "status") as CampaignStatus
  return { status }
}

// ── list filters ────────────────────────────────────────────────────────────

export function validateCampaignFilters(query: Record<string, unknown>): {
  status?: CampaignStatus
  advertiserId?: string
} {
  const filters: { status?: CampaignStatus; advertiserId?: string } = {}
  if (query["status"] !== undefined) {
    filters.status = validateEnumValue(
      query["status"],
      VALID_STATUSES,
      "status_filter"
    ) as CampaignStatus
  }
  if (query["advertiserId"] !== undefined) {
    filters.advertiserId = validateUUID(query["advertiserId"], "advertiser_id_filter")
  }
  return filters
}

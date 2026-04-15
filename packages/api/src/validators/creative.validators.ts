import { AdCategory, AdSource, AdSurface } from "@devdrip/shared"
import { ValidationError } from "../errors/index.js"
import {
  validateStringField,
  validatePositiveNumber,
  validateEnumValue,
  validateOptionalUrl,
  requireBody,
} from "./common.js"

const VALID_FORMATS = ["text", "banner", "sponsored-link"] as const
const AD_CATEGORIES = Object.values(AdCategory) as string[]
const AD_SOURCES = Object.values(AdSource) as string[]
const AD_SURFACES = Object.values(AdSurface) as string[]

// ── types ───────────────────────────────────────────────────────────────────

export interface CreateCreativeInput {
  campaignId: string
  headline: string
  body: string | null
  ctaText: string | null
  ctaUrl: string | null
  format: string
  surface: string
  category: string
  source: string
  cpmRate: number
  impressionBeaconUrl: string | null
  clickTrackingUrl: string | null
  externalCampaignId: string | null
  externalCreativeId: string | null
}

export interface UpdateCreativeInput {
  headline?: string
  body?: string | null
  ctaText?: string | null
  ctaUrl?: string | null
  format?: string
  surface?: string
  category?: string
  source?: string
  cpmRate?: number
  impressionBeaconUrl?: string | null
  clickTrackingUrl?: string | null
  externalCampaignId?: string | null
  externalCreativeId?: string | null
  isActive?: boolean
}

// ── create ──────────────────────────────────────────────────────────────────

export function validateCreateCreative(body: unknown, campaignId: string): CreateCreativeInput {
  const b = requireBody(body)

  const headline = validateStringField(b["headline"], "headline", { required: true, maxLength: 60 })
  const bodyText = validateStringField(b["body"], "body", { maxLength: 140 })
  const ctaText = validateStringField(b["ctaText"], "cta_text", { maxLength: 30 })
  const ctaUrl = validateOptionalUrl(b["ctaUrl"], "cta_url")
  const format = validateEnumValue(b["format"], VALID_FORMATS, "format")
  const surface = validateEnumValue(b["surface"], AD_SURFACES, "surface")
  const category = validateEnumValue(b["category"], AD_CATEGORIES, "category")
  const source = validateEnumValue(b["source"], AD_SOURCES, "source")
  const cpmRate = validatePositiveNumber(b["cpmRate"], "cpm_rate")
  const impressionBeaconUrl = validateOptionalUrl(b["impressionBeaconUrl"], "impression_beacon_url")
  const clickTrackingUrl = validateOptionalUrl(b["clickTrackingUrl"], "click_tracking_url")
  const externalCampaignId = validateStringField(b["externalCampaignId"], "external_campaign_id", {
    maxLength: 255,
  })
  const externalCreativeId = validateStringField(b["externalCreativeId"], "external_creative_id", {
    maxLength: 255,
  })

  return {
    campaignId,
    headline,
    body: bodyText,
    ctaText,
    ctaUrl,
    format,
    surface,
    category,
    source,
    cpmRate,
    impressionBeaconUrl,
    clickTrackingUrl,
    externalCampaignId,
    externalCreativeId,
  }
}

// ── update ──────────────────────────────────────────────────────────────────

export function validateUpdateCreative(body: unknown): UpdateCreativeInput {
  const b = requireBody(body)
  const updates: UpdateCreativeInput = {}
  let hasField = false

  if (b["headline"] !== undefined) {
    updates.headline = validateStringField(b["headline"], "headline", {
      required: true,
      maxLength: 60,
    })
    hasField = true
  }
  if (b["body"] !== undefined) {
    updates.body =
      b["body"] === null ? null : validateStringField(b["body"], "body", { maxLength: 140 })
    hasField = true
  }
  if (b["ctaText"] !== undefined) {
    updates.ctaText =
      b["ctaText"] === null
        ? null
        : validateStringField(b["ctaText"], "cta_text", { maxLength: 30 })
    hasField = true
  }
  if (b["ctaUrl"] !== undefined) {
    updates.ctaUrl = validateOptionalUrl(b["ctaUrl"], "cta_url")
    hasField = true
  }
  if (b["format"] !== undefined) {
    updates.format = validateEnumValue(b["format"], VALID_FORMATS, "format")
    hasField = true
  }
  if (b["surface"] !== undefined) {
    updates.surface = validateEnumValue(b["surface"], AD_SURFACES, "surface")
    hasField = true
  }
  if (b["category"] !== undefined) {
    updates.category = validateEnumValue(b["category"], AD_CATEGORIES, "category")
    hasField = true
  }
  if (b["source"] !== undefined) {
    updates.source = validateEnumValue(b["source"], AD_SOURCES, "source")
    hasField = true
  }
  if (b["cpmRate"] !== undefined) {
    updates.cpmRate = validatePositiveNumber(b["cpmRate"], "cpm_rate")
    hasField = true
  }
  if (b["impressionBeaconUrl"] !== undefined) {
    updates.impressionBeaconUrl = validateOptionalUrl(
      b["impressionBeaconUrl"],
      "impression_beacon_url"
    )
    hasField = true
  }
  if (b["clickTrackingUrl"] !== undefined) {
    updates.clickTrackingUrl = validateOptionalUrl(b["clickTrackingUrl"], "click_tracking_url")
    hasField = true
  }
  if (b["externalCampaignId"] !== undefined) {
    updates.externalCampaignId =
      b["externalCampaignId"] === null
        ? null
        : validateStringField(b["externalCampaignId"], "external_campaign_id", { maxLength: 255 })
    hasField = true
  }
  if (b["externalCreativeId"] !== undefined) {
    updates.externalCreativeId =
      b["externalCreativeId"] === null
        ? null
        : validateStringField(b["externalCreativeId"], "external_creative_id", { maxLength: 255 })
    hasField = true
  }
  if (b["isActive"] !== undefined) {
    if (typeof b["isActive"] !== "boolean") throw new ValidationError("invalid_is_active")
    updates.isActive = b["isActive"]
    hasField = true
  }

  if (!hasField) throw new ValidationError("no_fields_to_update")
  return updates
}

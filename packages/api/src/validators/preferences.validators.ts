import { AdCategory, ChannelMode, NewsTopic } from "@distrotv/shared"
import { ValidationError } from "../errors/index.js"
import { requireBody, validateEnumArray, validateEnumValue } from "./common.js"

const AD_CATEGORIES = Object.values(AdCategory) as string[]
const CHANNEL_MODES = Object.values(ChannelMode) as string[]
const NEWS_TOPICS = Object.values(NewsTopic) as string[]

export interface UpdatePreferencesInput {
  blockedCategories?: AdCategory[]
  maxPerHour?: number
  maxPerDay?: number
  quietHoursStart?: number | null
  quietHoursEnd?: number | null
  tzOffsetMinutes?: number
  idleSensitivityMs?: number
  sessionWarmupMs?: number
  nightMode?: boolean
  channelMode?: ChannelMode
  newsTopics?: NewsTopic[]
}

const ALLOWED_KEYS = new Set<string>([
  "blockedCategories",
  "maxPerHour",
  "maxPerDay",
  "quietHoursStart",
  "quietHoursEnd",
  "tzOffsetMinutes",
  "idleSensitivityMs",
  "sessionWarmupMs",
  "nightMode",
  "channelMode",
  "newsTopics",
])

export function validateUpdatePreferences(body: unknown): UpdatePreferencesInput {
  const b = requireBody(body)

  for (const k of Object.keys(b)) {
    if (!ALLOWED_KEYS.has(k)) throw new ValidationError("unknown_field")
  }

  const out: UpdatePreferencesInput = {}

  if (b["blockedCategories"] !== undefined) {
    const arr = validateEnumArray(b["blockedCategories"], AD_CATEGORIES, "blocked_categories")
    out.blockedCategories = arr as AdCategory[]
  }

  if (b["maxPerHour"] !== undefined) {
    out.maxPerHour = parseIntInRange(b["maxPerHour"], 1, 100, "max_per_hour")
  }

  if (b["maxPerDay"] !== undefined) {
    out.maxPerDay = parseIntInRange(b["maxPerDay"], 1, 1000, "max_per_day")
  }

  if (b["quietHoursStart"] !== undefined) {
    if (
      b["quietHoursStart"] !== null &&
      (typeof b["quietHoursStart"] !== "number" ||
        b["quietHoursStart"] < 0 ||
        b["quietHoursStart"] > 1439 ||
        !Number.isInteger(b["quietHoursStart"]))
    ) {
      throw new ValidationError("invalid_quiet_hours_start")
    }
    out.quietHoursStart = b["quietHoursStart"] as number | null
  }

  if (b["quietHoursEnd"] !== undefined) {
    if (
      b["quietHoursEnd"] !== null &&
      (typeof b["quietHoursEnd"] !== "number" ||
        b["quietHoursEnd"] < 0 ||
        b["quietHoursEnd"] > 1439 ||
        !Number.isInteger(b["quietHoursEnd"]))
    ) {
      throw new ValidationError("invalid_quiet_hours_end")
    }
    out.quietHoursEnd = b["quietHoursEnd"] as number | null
  }

  const startProvided = b["quietHoursStart"] !== undefined
  const endProvided = b["quietHoursEnd"] !== undefined
  if (startProvided !== endProvided) {
    throw new ValidationError("quiet_hours_endpoints_must_be_set_together")
  }
  if (
    startProvided &&
    endProvided &&
    (b["quietHoursStart"] === null) !== (b["quietHoursEnd"] === null)
  ) {
    throw new ValidationError("quiet_hours_endpoints_must_both_be_null_or_both_set")
  }

  if (b["tzOffsetMinutes"] !== undefined) {
    if (
      typeof b["tzOffsetMinutes"] !== "number" ||
      b["tzOffsetMinutes"] < -720 ||
      b["tzOffsetMinutes"] > 840 ||
      !Number.isInteger(b["tzOffsetMinutes"])
    ) {
      throw new ValidationError("invalid_tz_offset")
    }
    out.tzOffsetMinutes = b["tzOffsetMinutes"]
  }

  if (b["idleSensitivityMs"] !== undefined) {
    out.idleSensitivityMs = parseIntInRange(
      b["idleSensitivityMs"],
      1_000,
      300_000,
      "idle_sensitivity_ms"
    )
  }

  if (b["sessionWarmupMs"] !== undefined) {
    out.sessionWarmupMs = parseIntInRange(b["sessionWarmupMs"], 0, 60_000, "session_warmup_ms")
  }

  if (b["nightMode"] !== undefined) {
    if (typeof b["nightMode"] !== "boolean") throw new ValidationError("invalid_night_mode")
    out.nightMode = b["nightMode"]
  }

  if (b["channelMode"] !== undefined) {
    out.channelMode = validateEnumValue(
      b["channelMode"],
      CHANNEL_MODES,
      "channel_mode"
    ) as ChannelMode
  }

  if (b["newsTopics"] !== undefined) {
    const topics = validateEnumArray(b["newsTopics"], NEWS_TOPICS, "news_topics")
    out.newsTopics = topics as NewsTopic[]
  }

  return out
}

function parseIntInRange(v: unknown, min: number, max: number, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v) || v < min || v > max) {
    throw new ValidationError(`invalid_${field}`)
  }
  return v
}

import type { DistroPreferences } from "../types/index.js"
import { ChannelMode } from "../types/index.js"

// ── timing ──────────────────────────────────────────────────────────────────

export const GRACE_PERIOD_MS = 0
export const MAX_AD_DURATION_MS = 8_000

// daemonSocketPath moved to @distrotv/shared/daemon-socket — kept out of the
// main barrel so the frontend bundle doesn't pull node:os / node:path through
// the shared package. CLI imports from "@distrotv/shared/daemon-socket".

// ── idle detection ─────────────────────────────────────────────────────────

export const MIN_IDLE_PREDICTION_MS = 10_000
export const MIN_IDLE_DURATION_MS = 8_000
export const RE_ENGAGEMENT_COOLDOWN_MS = 15_000

// ── frequency caps ─────────────────────────────────────────────────────────

export const MAX_ADS_PER_HOUR_PER_SURFACE = 9_999

// ── late-night reduction ───────────────────────────────────────────────────

export const LATE_NIGHT_HOUR = 23
export const LATE_NIGHT_FREQUENCY_REDUCTION = 1.0

// ── revenue split ──────────────────────────────────────────────────────────

export const REVENUE_SHARE_DEVELOPER = 0.7
export const REVENUE_SHARE_PLATFORM = 0.25
export const REVENUE_SHARE_OSS_FUND = 0.05

// ── impression validation ──────────────────────────────────────────────────

export const MIN_COMPLETED_DURATION_MS = 1_000
export const IMPRESSION_CLOCK_TOLERANCE_MS = 1_000

// ── ad display ─────────────────────────────────────────────────────────────

export const MUTE_DURATION_MS = 1_800_000
export const AD_ROTATION_INTERVAL_MS = 15_000
export const MAX_ADS_PER_CONTINUOUS_SESSION = 9_999
export const INTER_AD_GAP_MS = 500
export const MAX_AUDIO_AD_DURATION_MS = 15_000

// ── progress bar ──────────────────────────────────────────────────────────
export const PROGRESS_TICK_MS = 500
export const PROGRESS_CAP = 0.9
export const PROGRESS_SNAP_HOLD_MS = 120

// ── night-mode preset ─────────────────────────────────────────────────────
export const NIGHT_MODE_DEFAULT_START_HOUR = 22
export const NIGHT_MODE_DEFAULT_END_HOUR = 7

export const IDLE_SENSITIVITY_MS = 10_000

// ── default DistroPreferences for fresh v2→v3 migration / --reset ──────────
export function defaultPreferences(): DistroPreferences {
  return {
    quietHoursStart: null,
    quietHoursEnd: null,
    nightMode: false,
    channelMode: ChannelMode.Balanced,
    newsTopics: [],
    tzOffsetMinutes: -new Date().getTimezoneOffset(),
    idleSensitivityMs: IDLE_SENSITIVITY_MS,
    // Sentinel "never synced" — first GET /me/preferences will replace it.
    updatedAt: new Date(0).toISOString(),
    muteUntil: null,
  }
}

export const defaultDistroPreferences = defaultPreferences

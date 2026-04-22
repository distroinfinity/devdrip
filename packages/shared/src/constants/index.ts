import { homedir } from "node:os"
import { join } from "node:path"
import type { DevdripPreferences } from "../types/index.js"

// ── timing ──────────────────────────────────────────────────────────────────

export const GRACE_PERIOD_MS = 3_000
export const MAX_AD_DURATION_MS = 8_000

// ── daemon socket path ─────────────────────────────────────────────────────

const SUN_PATH_MAX = 104

// Single source of truth for the daemon socket path. Evaluated lazily on each
// call so tests that override `process.env.HOME` pick up the right home dir.
// Unix domain socket paths have a ~104-byte limit on macOS (sun_path); falls
// back to /tmp/devdrip-<uid>.sock on the rare long-home-dir case.
export function daemonSocketPath(
  uid: number = typeof process.getuid === "function" ? (process.getuid() as number) : 0
): string {
  const preferred = join(homedir(), ".devdrip", "daemon.sock")
  if (preferred.length < SUN_PATH_MAX) return preferred
  return `/tmp/devdrip-${uid}.sock`
}

// ── idle detection ─────────────────────────────────────────────────────────

export const MIN_IDLE_PREDICTION_MS = 10_000
export const MIN_IDLE_DURATION_MS = 8_000
export const RE_ENGAGEMENT_COOLDOWN_MS = 15_000
export const SESSION_WARMUP_MS = 60_000

// ── frequency caps ─────────────────────────────────────────────────────────

export const MAX_ADS_PER_HOUR_PER_SURFACE = 4
export const MAX_ADS_PER_HOUR_TOTAL = 20
export const MAX_ADS_PER_DAY = 120

// ── late-night reduction ───────────────────────────────────────────────────

export const LATE_NIGHT_HOUR = 23
export const LATE_NIGHT_FREQUENCY_REDUCTION = 0.5

// ── revenue split ──────────────────────────────────────────────────────────

export const REVENUE_SHARE_DEVELOPER = 0.7
export const REVENUE_SHARE_PLATFORM = 0.25
export const REVENUE_SHARE_OSS_FUND = 0.05

// ── payouts ────────────────────────────────────────────────────────────────

export const MIN_PAYOUT_USDC = 1.0

// ── impression validation ──────────────────────────────────────────────────

export const MIN_COMPLETED_DURATION_MS = 1_000
export const IMPRESSION_CLOCK_TOLERANCE_MS = 1_000

// ── ad display ─────────────────────────────────────────────────────────────

export const MUTE_DURATION_MS = 1_800_000
export const AD_ROTATION_INTERVAL_MS = 15_000
export const MAX_ADS_PER_CONTINUOUS_SESSION = 8
export const INTER_AD_GAP_MS = 500
export const MAX_AUDIO_AD_DURATION_MS = 15_000

// ── night-mode preset (active when DevdripPreferences.nightMode is true
// and no custom quiet hours are set) ───────────────────────────────────────
export const NIGHT_MODE_DEFAULT_START_HOUR = 22
export const NIGHT_MODE_DEFAULT_END_HOUR = 7

// ── default DevdripPreferences for fresh v2→v3 migration / --reset ─────────
export function defaultDevdripPreferences(): DevdripPreferences {
  return {
    blockedCategories: [],
    maxPerHour: MAX_ADS_PER_HOUR_TOTAL,
    maxPerDay: MAX_ADS_PER_DAY,
    sessionWarmupMs: SESSION_WARMUP_MS,
    quietHoursStart: null,
    quietHoursEnd: null,
    nightMode: false,
    tzOffsetMinutes: -new Date().getTimezoneOffset(),
    muteUntil: null,
  }
}

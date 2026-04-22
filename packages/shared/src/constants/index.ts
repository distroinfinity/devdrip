import { homedir } from "node:os"
import { join } from "node:path"

// ── timing ──────────────────────────────────────────────────────────────────

export const GRACE_PERIOD_MS = 3_000
export const MAX_AD_DURATION_MS = 8_000
export const VANISH_DEADLINE_MS = 200

// Unix domain socket path has a ~104-byte limit on macOS (sun_path). The
// default path under ~/.devdrip/ fits comfortably except for users with
// unusually long home directories; the daemon falls back to /tmp/devdrip-<uid>.sock
// via resolveDaemonSocketPath() in that case.
export const DAEMON_SOCKET_PATH = join(homedir(), ".devdrip", "daemon.sock")

const SUN_PATH_MAX = 104

export function resolveDaemonSocketPath(
  uid: number = typeof process.getuid === "function" ? (process.getuid() as number) : 0
): string {
  if (DAEMON_SOCKET_PATH.length < SUN_PATH_MAX) return DAEMON_SOCKET_PATH
  return `/tmp/devdrip-${uid}.sock`
}

// ── idle detection ─────────────────────────────────────────────────────────

export const MIN_IDLE_PREDICTION_MS = 10_000
export const MIN_IDLE_DURATION_MS = 8_000
export const RE_ENGAGEMENT_COOLDOWN_MS = 15_000
export const SESSION_WARMUP_MS = 600_000

// ── frequency caps ─────────────────────────────────────────────────────────

export const MAX_ADS_PER_HOUR_PER_SURFACE = 4
export const MAX_ADS_PER_HOUR_TOTAL = 8
export const MAX_ADS_PER_DAY = 60

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
export const MAX_AUDIO_AD_DURATION_MS = 15_000

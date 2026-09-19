// ── timing ──────────────────────────────────────────────────────────────────

export const GRACE_PERIOD_MS = 3_000
export const MAX_AD_DURATION_MS = 8_000
export const VANISH_DEADLINE_MS = 200
export const DAEMON_SOCKET_PATH = `${process.env["XDG_RUNTIME_DIR"] ?? "/tmp"}/devdrip.sock`

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

export const REVENUE_SHARE_DEVELOPER = 0.70
export const REVENUE_SHARE_PLATFORM = 0.25
export const REVENUE_SHARE_OSS_FUND = 0.05

// ── payouts ────────────────────────────────────────────────────────────────

export const MIN_PAYOUT_USDC = 1.00

// ── ad display ─────────────────────────────────────────────────────────────

export const MUTE_DURATION_MS = 1_800_000
export const AD_ROTATION_INTERVAL_MS = 15_000
export const MAX_AUDIO_AD_DURATION_MS = 15_000

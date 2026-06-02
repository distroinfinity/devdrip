// CH 03 "Utilities" — an ambient dev instrument panel rendered as one rotating
// slot alongside news + markets. Unlike news/ticker, this payload is built
// LOCALLY by the daemon (never fetched from the API) from the telemetry Claude
// Code pipes to `distro statusline` on stdin plus cheap local probes (git,
// machine, service health). Every bucket is optional so an unavailable source
// is simply omitted rather than rendered as a fake zeroed gauge.

// Claude session telemetry, sourced from the status-line stdin snapshot.
export interface UtilityAi {
  // rolling rate-limit windows (0-100), with epoch-ms reset times when known
  fiveHourPct?: number
  fiveHourResetAt?: number
  sevenDayPct?: number
  sevenDayResetAt?: number
  // context window
  ctxPct?: number
  ctxSize?: number
  // % at which auto-compact kicks in (for the "compaction imminent" cue)
  compactAtPct?: number
  // session economics
  costUsd?: number
  cachePct?: number
  // derived from the rolling snapshot history
  burnUsdPerMin?: number
  burnTokPerMin?: number
  // projected minutes until the nearest limit (5h or 7d) is hit at current burn
  timeToLimitMin?: number
  // identity / session deltas
  model?: string
  effort?: string
  linesAdded?: number
  linesRemoved?: number
}

export interface UtilityGit {
  branch?: string
  ahead?: number
  behind?: number
  dirtyFiles?: number
  uncommittedLines?: number
  lastCommitAgeSec?: number
}

export interface UtilityMachine {
  cpuPct?: number // instantaneous % busy (sampled), not load average
  memPct?: number // % used — real pressure (macOS memory_pressure / linux MemAvailable)
  diskUsedPct?: number // % used (100 - free), so a fuller disk reads as a fuller bar
}

export type AnthropicHealth = "ok" | "degraded" | "down"

export interface UtilityHealth {
  anthropic?: AnthropicHealth
  apiLatencyMs?: number
  online?: boolean
}

// "full" shows the complete gauge grid; "complement" drops the gauges a user's
// own custom status line likely already shows (ctx/5h/7d/cost) and leads with
// the derived/extra stats instead.
export type UtilityLayout = "full" | "complement"

export interface UtilityPayload {
  kind: "utility"
  generatedAt: number
  layout: UtilityLayout
  ai?: UtilityAi
  git?: UtilityGit
  machine?: UtilityMachine
  health?: UtilityHealth
}

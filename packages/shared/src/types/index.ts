// ── enums ───────────────────────────────────────────────────────────────────

export enum ImpressionResult {
  Completed = "completed",
  Skipped = "skipped",
  Expired = "expired",
  Interrupted = "interrupted",
}

// ── channel mode + news ────────────────────────────────────────────────────

export enum ChannelMode {
  NewsOnly = "news_only",
  NewsHeavy = "news_heavy", // 3:1 news:ticker
  Balanced = "balanced", // 1:1 news:ticker (default; replaces "mix")
  TickerHeavy = "ticker_heavy", // 1:3 news:ticker
  TickerOnly = "ticker_only",
}

import type { NewsTopic } from "./news.js"
export { NewsSource, NewsTopic } from "./news.js"
export type { ChannelKey } from "./news.js"

// ── types ───────────────────────────────────────────────────────────────────

export type IdeType = "terminal" | "vscode" | "cursor"

// ── interfaces ──────────────────────────────────────────────────────────────

// Synced preferences — round-tripped via GET/PUT /me/preferences. Server is
// source of truth; updatedAt drives last-write-wins between dashboard + CLI.
export interface SyncedPreferences {
  // local hour (0-23); null = unset. wraparound allowed (start=22, end=7).
  quietHoursStart: number | null
  quietHoursEnd: number | null
  tzOffsetMinutes: number
  idleSensitivityMs: number
  // when true AND no custom quiet hours set, daemon treats 22→07 as quiet.
  nightMode: boolean
  channelMode: ChannelMode
  newsTopics: NewsTopic[]
  // ISO 8601, set by server on every write. clients never set this.
  updatedAt: string
}

// CLI-local preferences — never uploaded. muteUntil is an ephemeral
// "shut up for the next N minutes" escape hatch that wouldn't survive
// multi-device sync sensibly, so it stays here.
export interface LocalPreferences {
  // epoch ms; null = not muted. cleared when now >= muteUntil.
  muteUntil: number | null
}

export type DevdripPreferences = SyncedPreferences & LocalPreferences

export interface Device {
  id: string
  userId: string
  deviceName: string | null
  os: string
  ideType: IdeType
  lastHeartbeat: string | null
  createdAt: string
}

// ── slot payload types ─────────────────────────────────────────────────────

export type { NewsPayload } from "./NewsPayload.js"
export type { TickerPayload, TickerStats } from "./TickerPayload.js"
export type { SlotPayload, SlotKind, SlotLayout } from "./SlotPayload.js"
export type { WatchlistDto, WatchlistTickerDto, AssetClass } from "./WatchlistDto.js"
export type { AlertDto, AlertScope, PendingAlert, AlertReplacement } from "./AlertDto.js"
export type { ChannelDto } from "./ChannelDto.js"

// ── M6 dashboard surfaces ─────────────────────────────────────────────────

export interface ActivitySummaryEvent {
  ts: string // ISO 8601
  kind: "news" | "ticker" | "alert"
  weight: 1 | 2 | 3
}

export interface ActivitySummaryDto {
  windowSec: number
  events: ActivitySummaryEvent[]
  totals: { news: number; ticker: number; alert: number; uptime_days: number }
}

export interface SparklinePoint {
  ts: string
  price: number
}

export interface SparklineDto {
  symbol: string
  points: SparklinePoint[]
}

export interface AlertEventDto {
  id: string
  symbol: string
  changePct: number
  thresholdPct: number
  firedAt: string
}

export interface NowPlayingDto {
  active: {
    kind: "news" | "ticker" | "alert"
    payload: unknown
    startedAt: string
    endsAt: string
  } | null
  next: { kind: "news" | "ticker" | "alert"; preview: string } | null
}

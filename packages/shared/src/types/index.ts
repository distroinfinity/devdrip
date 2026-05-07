// ── enums ───────────────────────────────────────────────────────────────────

export enum AdCategory {
  CloudInfrastructure = "cloud-infrastructure",
  DeveloperTools = "developer-tools",
  Databases = "databases",
  MonitoringObservability = "monitoring-observability",
  DeveloperRecruiting = "developer-recruiting",
  DeveloperEducation = "developer-education",
  SaasProducts = "saas-products",
}

export enum ImpressionResult {
  Completed = "completed",
  Skipped = "skipped",
  Expired = "expired",
  Interrupted = "interrupted",
}

// ── channel mode + news ────────────────────────────────────────────────────

export enum ChannelMode {
  News = "news", // news only (default once markets is wired in M3)
  Markets = "markets", // markets only (M4)
  Mix = "mix", // alternates news + markets (recommended; default)
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
  blockedCategories: AdCategory[]
  maxPerHour: number
  maxPerDay: number
  // local hour (0-23); null = unset. wraparound allowed (start=22, end=7).
  quietHoursStart: number | null
  quietHoursEnd: number | null
  tzOffsetMinutes: number
  idleSensitivityMs: number
  sessionWarmupMs: number
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

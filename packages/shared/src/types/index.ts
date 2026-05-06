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
  Earn = "earn", // ads only
  Learn = "learn", // news only
  Mix = "mix", // alternates 1:1 (default)
}

export enum NewsSource {
  HackerNews = "hn",
}

// MVP placeholder so the field validates. v1.1 adds Ai/Devtools/Startups/Career.
export enum NewsTopic {
  General = "general",
}

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

// ── slot content union ─────────────────────────────────────────────────────

// content-agnostic slot envelope. adding a new content type means a new variant
// here + a new render branch in cli daemon display.ts (exhaustiveness-checked).
export interface NewsSlot {
  kind: "news"
  payload: NewsPayload
}

export type SlotContent = NewsSlot

export interface NewsPayload {
  // namespaced id: "hn:38291043" — keeps the dedup set source-agnostic
  id: string
  source: NewsSource
  headline: string
  url: string
  score: number
  commentsUrl?: string
  // server computes at fetch time; daemon renders "1h" / "3d"
  ageSeconds: number
  // server-set, default ~10s. lives on the payload so different content types
  // can carry different defaults.
  displayTimeMs: number
}

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

export enum AdSource {
  Direct = "direct",
  Carbon = "carbon",
  EthicalAds = "ethicalads",
  Google = "google",
  Amazon = "amazon",
  X402 = "x402",
}

export enum AdSurface {
  TerminalTv = "terminal-tv",
  CompanionTab = "companion-tab",
  IdleDashboard = "idle-dashboard",
  Digest = "digest",
  Challenge = "challenge",
  Audio = "audio",
}

export enum IdleState {
  Active = "active",
  Warming = "warming",
  Idle = "idle",
}

export enum CampaignStatus {
  Draft = "draft",
  Active = "active",
  Paused = "paused",
  Completed = "completed",
}

export enum EarningStatus {
  Pending = "pending",
  Confirmed = "confirmed",
}

export enum PayoutStatus {
  Pending = "pending",
  Processing = "processing",
  Confirmed = "confirmed",
  Failed = "failed",
}

export enum ImpressionResult {
  Completed = "completed",
  Skipped = "skipped",
  Expired = "expired",
  Interrupted = "interrupted",
}

// ── billing ─────────────────────────────────────────────────────────────────

export interface BillingInfo {
  method: "stripe" | "crypto" | "invoice"
  stripeCustomerId?: string
  walletAddress?: string
  billingEmail?: string
  taxId?: string
}

// ── targeting ───────────────────────────────────────────────────────────────

export interface TargetingRules {
  geoAllow?: string[]
  geoDeny?: string[]
  osAllow?: string[]
  ideAllow?: IdeType[]
  minIdleMs?: number
  maxImpressions?: number
}

// ── types ───────────────────────────────────────────────────────────────────

export type AdFormat = "text" | "banner" | "sponsored-link"

export type IdeType = "terminal" | "vscode" | "cursor"

// ── interfaces ──────────────────────────────────────────────────────────────

export interface UserPreferences {
  maxAdsPerHour: number
  maxAdsPerDay: number
  blockedCategories: AdCategory[]
  enabledSurfaces: AdSurface[]
  quietHoursStart?: number
  quietHoursEnd?: number
  tzOffsetMinutes: number
  idleSensitivityMs: number
  dataSharingConsent: boolean
}

// Local, user-editable preferences persisted in ~/.devdrip/config.json.
// Distinct from UserPreferences (server-side shape) because the CLI owns
// the warmup + night-mode toggle and the server doesn't model those yet.
export interface DevdripPreferences {
  blockedCategories: AdCategory[]
  maxPerHour: number
  maxPerDay: number
  sessionWarmupMs: number
  // local hour (0-23); null = unset. wraparound allowed (start=22, end=7).
  quietHoursStart: number | null
  quietHoursEnd: number | null
  // convenience: when true AND no custom quiet hours set, daemon treats 22→07 as quiet.
  nightMode: boolean
  tzOffsetMinutes: number
  // epoch ms; null = not muted. cleared when now >= muteUntil.
  muteUntil: number | null
}

export interface User {
  id: string
  email: string
  walletAddress?: string
  preferences: UserPreferences
  balance: number
  monthlyEarnings: number
  streakDays: number
  createdAt: string
  updatedAt: string
}

export interface Device {
  id: string
  userId: string
  deviceName: string | null
  os: string
  ideType: IdeType
  lastHeartbeat: string | null
  createdAt: string
}

export interface Ad {
  id: string
  campaignId: string
  format: AdFormat
  headline: string
  body?: string
  url: string
  displayTimeMs: number
  cpmRate: number
  surface: AdSurface
  source: AdSource
  category: AdCategory
  createdAt: string
}

export interface AdPayload {
  id: string
  campaignId: string
  format: AdFormat
  headline: string
  body?: string
  url: string
  displayTimeMs: number
  // cpmRate propagates server→client so the CLI can render an optimistic
  // "+$0.XX earned" toast without a round-trip. Backend remains the source of
  // truth at sync time; this is a display hint only.
  cpmRate: number
  impressionBeaconUrl?: string
  clickTrackingUrl?: string
}

export interface ServedAdPayload extends AdPayload {
  deliveryToken: string
}

export interface Advertiser {
  id: string
  name: string
  email: string
  companyName: string
  createdAt: string
  updatedAt: string
}

export interface Campaign {
  id: string
  advertiserId: string
  name: string
  budget: number
  spent: number
  cpmRate: number
  dailyCap: number
  startDate: string
  endDate: string
  status: CampaignStatus
  targetCategories: AdCategory[]
  targetSurfaces: AdSurface[]
  createdAt: string
  updatedAt: string
}

export interface Impression {
  id: string
  userId: string
  adId: string
  campaignId: string
  surface: AdSurface
  result: ImpressionResult
  displayDurationMs: number
  cpmRate: number
  earnedAmount: number
  createdAt: string
}

export interface Earning {
  id: string
  userId: string
  impressionId: string
  amount: number
  surface: AdSurface
  adCategory: AdCategory
  status: EarningStatus
  createdAt: string
}

export interface Payout {
  id: string
  userId: string
  amount: number
  txHash?: string
  walletAddress: string
  status: PayoutStatus
  createdAt: string
  confirmedAt?: string
}

// ── admin ───────────────────────────────────────────────────────────────────

export interface AdminStatsBlock {
  impressionsCount: number
  spendUsdc: number
  earningsUsdc: number
}

export interface AdminStats {
  today: AdminStatsBlock
  lifetime: AdminStatsBlock
  // live snapshot — not date-filtered, so lives outside the today/lifetime blocks
  activeCampaignsCount: number
}

export interface InviteCode {
  id: string
  code: string
  usedBy: string | null
  usedAt: string | null
  createdAt: string
}

export interface AdminUser {
  id: string
  githubLogin: string | null
  email: string
  hasWallet: boolean
  lifetimeEarningsUsdc: number
  createdAt: string
}

// ── ad provider ────────────────────────────────────────────────────────────

export { type AdRequest, type AdProvider } from "./ad-provider.js"

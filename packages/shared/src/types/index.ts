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

// ── ad provider ────────────────────────────────────────────────────────────

export { type AdRequest, type AdProvider } from "./ad-provider.js"

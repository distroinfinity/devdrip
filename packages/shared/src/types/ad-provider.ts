import type { AdCategory, AdPayload, AdSurface, IdeType } from "./index.js"

// ── ad request ─────────────────────────────────────────────────────────────
// everything the provider needs to make a selection decision.
// assembled by the route handler from device record + user preferences.

export interface AdRequest {
  deviceId: string
  userId: string
  os: string
  ideType: IdeType
  surface: AdSurface
  count: number
  blockedCategories: AdCategory[]
  enabledSurfaces: AdSurface[]
  maxAdsPerHour: number
  maxAdsPerDay: number
  quietHoursStart?: number
  quietHoursEnd?: number
}

// ── ad provider ────────────────────────────────────────────────────────────
// selection-only interface. impression/click recording is a separate concern.
// each provider (Manual, Carbon, EthicalAds…) implements this.

export interface AdProvider {
  readonly name: string
  fetchAds(request: AdRequest): Promise<AdPayload[]>
}

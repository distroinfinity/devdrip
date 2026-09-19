// types, limits and messages shared by the server data layer and the client composer

export type AdStatus = "active" | "paused" | "review"

export interface AdvertiserAd {
  id: string
  brand: string
  line: string
  url: string
  bidCpm: number
  status: AdStatus
  createdAt: string
  stats: { served: number; views: number; clicks: number; ctr: number; spend: number }
}

export interface CreateAdBody {
  brand: string
  line: string
  url: string
  bidCpm?: number
}

export const AD_LIMITS = {
  brandMin: 2,
  brandMax: 40,
  lineMin: 10,
  lineMax: 140,
  urlMax: 2048,
  bidMin: 1,
  bidMax: 100,
  bidDefault: 10,
} as const

export type AdField = "brand" | "line" | "url" | "bid" | "form"

// api error code → the field it belongs to and what to do about it
export const AD_ERRORS: Record<string, { field: AdField; message: string }> = {
  invalid_brand: { field: "brand", message: "Use 2 to 40 characters." },
  invalid_line: { field: "line", message: "Use 10 to 140 characters." },
  invalid_url: { field: "url", message: "Use a full https:// link." },
  invalid_bid: { field: "bid", message: "Enter a bid from 1 to 100." },
  too_many_ads: { field: "form", message: "Ten ads is the limit. Pause one you no longer need." },
  in_review: { field: "form", message: "This ad is in review. It can't be changed yet." },
  not_available: { field: "form", message: "The ad service isn't available yet. Try again soon." },
}

export function adError(code: string): { field: AdField; message: string } {
  return AD_ERRORS[code] ?? { field: "form", message: "That didn't save. Try again." }
}

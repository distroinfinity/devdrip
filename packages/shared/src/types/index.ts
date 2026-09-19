export type AdFormat = "text" | "banner" | "sponsored-link"

export interface AdPayload {
  id: string
  campaignId: string
  format: AdFormat
  headline: string
  body?: string
  url: string
  displayTimeMs: number
}

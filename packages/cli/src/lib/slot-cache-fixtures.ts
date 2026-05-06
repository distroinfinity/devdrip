import type { CachedSlot } from "./slot-cache.js"

export const DEMO_SLOTS: readonly CachedSlot[] = [
  {
    kind: "ad",
    payload: {
      id: "demo-ad-1",
      campaignId: "demo-campaign",
      format: "text",
      headline: "Distro TV demo — no real advertiser",
      body: "We'll show real sponsors here once you're online. You won't earn from demo ads.",
      url: "https://distrotv.sh",
      displayTimeMs: 4000,
      deliveryToken: "",
      cpmRate: 0,
    },
    cacheSource: "demo",
  },
  {
    kind: "ad",
    payload: {
      id: "demo-ad-2",
      campaignId: "demo-campaign",
      format: "text",
      headline: "Distro TV demo — backend offline",
      body: "Cache refresh failed. Run `distro status --local` to inspect state.",
      url: "https://distrotv.sh/docs/offline",
      displayTimeMs: 4000,
      deliveryToken: "",
      cpmRate: 0,
    },
    cacheSource: "demo",
  },
  {
    kind: "ad",
    payload: {
      id: "demo-ad-3",
      campaignId: "demo-campaign",
      format: "text",
      headline: "Distro TV demo — placeholder",
      body: "Ads resume automatically when the API reconnects.",
      url: "https://distrotv.sh",
      displayTimeMs: 4000,
      deliveryToken: "",
      cpmRate: 0,
    },
    cacheSource: "demo",
  },
]

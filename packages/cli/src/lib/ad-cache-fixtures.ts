import type { CachedAd } from "./ad-cache.js"

// demo ads shown when the backend is unreachable AND the cache is empty.
// flagged cacheSource: "demo" so the hook/daemon layer skips writing them to
// the ledger (no earnings credit for demos). headlines are copy-labeled so a
// dev never mistakes a demo ad for a real sponsor.
export const DEMO_ADS: readonly CachedAd[] = [
  {
    id: "demo-ad-1",
    campaignId: "demo-campaign",
    format: "text",
    headline: "DevDrip demo — no real advertiser",
    body: "We'll show real sponsors here once you're online. You won't earn from demo ads.",
    url: "https://devdrip.sh",
    displayTimeMs: 4000,
    deliveryToken: "",
    cpmRate: 0,
    cacheSource: "demo",
  },
  {
    id: "demo-ad-2",
    campaignId: "demo-campaign",
    format: "text",
    headline: "DevDrip demo — backend offline",
    body: "Cache refresh failed. Run `devdrip status --local` to inspect state.",
    url: "https://devdrip.sh/docs/offline",
    displayTimeMs: 4000,
    deliveryToken: "",
    cpmRate: 0,
    cacheSource: "demo",
  },
  {
    id: "demo-ad-3",
    campaignId: "demo-campaign",
    format: "text",
    headline: "DevDrip demo — placeholder",
    body: "Ads resume automatically when the API reconnects.",
    url: "https://devdrip.sh",
    displayTimeMs: 4000,
    deliveryToken: "",
    cpmRate: 0,
    cacheSource: "demo",
  },
]

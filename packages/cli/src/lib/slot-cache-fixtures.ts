import { NewsSource } from "@distrotv/shared"
import type { CachedSlot } from "./slot-cache.js"

export const DEMO_SLOTS: readonly CachedSlot[] = [
  {
    kind: "news",
    id: "demo-hn:1",
    source: NewsSource.HackerNews,
    // legacy HN-only path; Batch 4 replaces this entire codepath
    channelKey: "tech",
    headline: "Distro TV — offline demo (backend not reachable)",
    url: "https://distrotv.sh",
    score: 0,
    ageSeconds: 0,
    displayTimeMs: 4000,
    cacheSource: "demo",
  },
]

import type { CachedSlot } from "./slot-cache.js"

export const DEMO_SLOTS: readonly CachedSlot[] = [
  {
    kind: "news",
    payload: {
      id: "demo-hn:1",
      source: "hn" as never,
      headline: "Distro TV — offline demo (backend not reachable)",
      url: "https://distrotv.sh",
      score: 0,
      ageSeconds: 0,
      displayTimeMs: 4000,
    },
    cacheSource: "demo",
  },
]

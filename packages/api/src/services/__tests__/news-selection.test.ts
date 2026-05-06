import { describe, it, expect } from "vitest"

// Helpers duplicated from news-selection.service.ts. Keep this lockstep with the service.
// (If/when the service exports them, swap these for direct imports.)
function recencyDecay(ageHours: number, halfLifeHours: number): number {
  return Math.pow(0.5, ageHours / Math.max(halfLifeHours, 0.5))
}
function engagementSignal(score: number | null): number {
  if (score === null || score <= 0) return 0
  return Math.min(1, Math.log10(score + 1) / 3)
}
function priorityScore(priority: number): number {
  return 1 / (1 + priority)
}
function score(args: {
  ageHours: number
  halfLife: number
  hnScore: number | null
  channelPriority: number
  isFirstTime: boolean
}): number {
  const W_RECENCY = 0.45,
    W_ENGAGEMENT = 0.2,
    W_CHANNEL_PRIORITY = 0.3,
    W_FRESHNESS = 0.05
  return (
    W_RECENCY * recencyDecay(args.ageHours, args.halfLife) +
    W_ENGAGEMENT * engagementSignal(args.hnScore) +
    W_CHANNEL_PRIORITY * priorityScore(args.channelPriority) +
    W_FRESHNESS * (args.isFirstTime ? 1 : 0)
  )
}

describe("news selection scoring", () => {
  it("ranks unseen, recent, high-priority items above old, seen, low-priority ones", () => {
    const fresh = score({
      ageHours: 1,
      halfLife: 6,
      hnScore: 300,
      channelPriority: 0,
      isFirstTime: true,
    })
    const stale = score({
      ageHours: 36,
      halfLife: 6,
      hnScore: 50,
      channelPriority: 3,
      isFirstTime: false,
    })
    expect(fresh).toBeGreaterThan(stale)
  })

  it("is decisive about freshness — same item, served vs unseen, unseen wins", () => {
    const args = { ageHours: 4, halfLife: 6, hnScore: 100, channelPriority: 0 } as const
    const unseen = score({ ...args, isFirstTime: true })
    const seen = score({ ...args, isFirstTime: false })
    expect(unseen).toBeGreaterThan(seen)
  })

  it("decays with age, even at high priority", () => {
    const young = score({
      ageHours: 1,
      halfLife: 6,
      hnScore: 100,
      channelPriority: 0,
      isFirstTime: true,
    })
    const old = score({
      ageHours: 24,
      halfLife: 6,
      hnScore: 100,
      channelPriority: 0,
      isFirstTime: true,
    })
    expect(young).toBeGreaterThan(old)
  })
})

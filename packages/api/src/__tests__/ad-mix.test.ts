import { describe, it, expect } from "vitest"
import { ChannelMode } from "@distrotv/shared"
import { contentPlan, splitCounts, mixSlots, normalizeFeeds } from "../services/ad-mix.js"
import { validateUpdatePreferences } from "../validators/preferences.validators.js"

describe("contentPlan", () => {
  it("no content feeds → none", () =>
    expect(contentPlan(["ads"], ChannelMode.Balanced)).toBe("none"))
  it("news only", () => expect(contentPlan(["ads", "news"], ChannelMode.TickerOnly)).toBe("news"))
  it("markets only", () => expect(contentPlan(["markets"], ChannelMode.NewsOnly)).toBe("ticker"))
  it("both → channel mode decides", () => {
    expect(contentPlan(["news", "markets"], ChannelMode.NewsOnly)).toBe("news")
    expect(contentPlan(["news", "markets"], ChannelMode.TickerOnly)).toBe("ticker")
    expect(contentPlan(["news", "markets"], ChannelMode.Balanced)).toBe("mix")
  })
})

describe("splitCounts", () => {
  it("ads only → all ads", () =>
    expect(splitCounts(6, true, false)).toEqual({ ads: 6, content: 0 }))
  it("ads + content → half, ads round up", () =>
    expect(splitCounts(5, true, true)).toEqual({ ads: 3, content: 2 }))
  it("ads off → all content", () =>
    expect(splitCounts(6, false, true)).toEqual({ ads: 0, content: 6 }))
  it("nothing on → nothing", () =>
    expect(splitCounts(6, false, false)).toEqual({ ads: 0, content: 0 }))
})

describe("mixSlots", () => {
  it("alternates starting with an ad", () => {
    expect(mixSlots(["a1", "a2"], ["c1", "c2"])).toEqual(["a1", "c1", "a2", "c2"])
  })
  it("drains the longer list", () => {
    expect(mixSlots(["a1"], ["c1", "c2", "c3"])).toEqual(["a1", "c1", "c2", "c3"])
    expect(mixSlots(["a1", "a2"], [])).toEqual(["a1", "a2"])
  })
})

describe("normalizeFeeds", () => {
  it("defaults to ads when unset or junk", () => {
    expect(normalizeFeeds(undefined)).toEqual(["ads"])
    expect(normalizeFeeds("x")).toEqual(["ads"])
  })
  it("keeps an explicit empty list and drops unknown values", () => {
    expect(normalizeFeeds([])).toEqual([])
    expect(normalizeFeeds(["news", "bogus", "news"])).toEqual(["news"])
  })
})

describe("preferences validator", () => {
  it("accepts enabledFeeds", () => {
    expect(validateUpdatePreferences({ enabledFeeds: ["ads", "news"] }).enabledFeeds).toEqual([
      "ads",
      "news",
    ])
    expect(validateUpdatePreferences({ enabledFeeds: [] }).enabledFeeds).toEqual([])
  })
  it("rejects unknown feeds", () => {
    expect(() => validateUpdatePreferences({ enabledFeeds: ["crypto"] })).toThrow()
  })
})

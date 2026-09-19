import { describe, it, expect } from "vitest"
import { defaultPreferences, DEFAULT_FEEDS, FEEDS, AD_SLOT_EVERY_N } from "../index.js"

describe("feeds defaults", () => {
  it("ads are the only default feed", () => {
    expect(DEFAULT_FEEDS).toEqual(["ads"])
    expect(defaultPreferences().enabledFeeds).toEqual(["ads"])
  })
  it("utilities are off by default", () => {
    expect(defaultPreferences().utilitiesEnabled).toBe(false)
  })
  it("exposes the feed list and ad cadence", () => {
    expect(FEEDS).toEqual(["ads", "news", "markets"])
    expect(AD_SLOT_EVERY_N).toBe(2)
  })
})

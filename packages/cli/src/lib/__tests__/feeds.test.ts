import { describe, it, expect } from "vitest"
import { ChannelMode } from "@distrotv/shared"
import { channelModeForFeeds, describeFeeds } from "../feeds.js"

describe("channelModeForFeeds", () => {
  it("news only → news_only, markets only → ticker_only", () => {
    expect(channelModeForFeeds(["ads", "news"], ChannelMode.Balanced)).toBe(ChannelMode.NewsOnly)
    expect(channelModeForFeeds(["markets"], ChannelMode.Balanced)).toBe(ChannelMode.TickerOnly)
  })
  it("both → keeps a mixed mode, or falls back to balanced", () => {
    expect(channelModeForFeeds(["news", "markets"], ChannelMode.NewsHeavy)).toBe(
      ChannelMode.NewsHeavy
    )
    expect(channelModeForFeeds(["news", "markets"], ChannelMode.NewsOnly)).toBe(
      ChannelMode.Balanced
    )
  })
  it("no content feeds → leaves the mode alone", () => {
    expect(channelModeForFeeds(["ads"], ChannelMode.TickerHeavy)).toBe(ChannelMode.TickerHeavy)
  })
})

describe("describeFeeds", () => {
  it("lists what plays", () => {
    expect(describeFeeds(["ads"])).toBe("ads")
    expect(describeFeeds(["ads", "news", "markets"])).toBe("ads, news, markets")
    expect(describeFeeds([])).toBe("nothing (all feeds off)")
  })
})

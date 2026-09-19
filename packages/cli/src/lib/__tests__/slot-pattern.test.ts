import { describe, it, expect } from "vitest"
import { ChannelMode } from "@distrotv/shared"
import { pickKind } from "../slot-cache.js"

describe("pickKind", () => {
  it("news_only always returns news", () => {
    for (let i = 0; i < 10; i++) expect(pickKind(ChannelMode.NewsOnly, i)).toBe("news")
  })
  it("ticker_only always returns ticker", () => {
    for (let i = 0; i < 10; i++) expect(pickKind(ChannelMode.TickerOnly, i)).toBe("ticker")
  })
  it("balanced alternates 1:1", () => {
    expect([0, 1, 2, 3, 4].map((i) => pickKind(ChannelMode.Balanced, i))).toEqual([
      "news",
      "ticker",
      "news",
      "ticker",
      "news",
    ])
  })
  it("news_heavy alternates 3:1", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => pickKind(ChannelMode.NewsHeavy, i))).toEqual([
      "news",
      "news",
      "news",
      "ticker",
      "news",
      "news",
      "news",
      "ticker",
    ])
  })
  it("ticker_heavy alternates 1:3", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => pickKind(ChannelMode.TickerHeavy, i))).toEqual([
      "news",
      "ticker",
      "ticker",
      "ticker",
      "news",
      "ticker",
      "ticker",
      "ticker",
    ])
  })
})

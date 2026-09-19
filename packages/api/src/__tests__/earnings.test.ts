import { describe, it, expect } from "vitest"
import { ctr, clampLimit } from "../services/earnings.service.js"

describe("earnings helpers", () => {
  it("ctr is clicks / impressions, 0 when empty", () => {
    expect(ctr(0, 0)).toBe(0)
    expect(ctr(200, 5)).toBeCloseTo(0.025, 6)
  })
  it("clamps limit to 1..100, default 20", () => {
    expect(clampLimit(undefined)).toBe(20)
    expect(clampLimit("500")).toBe(100)
  })
})

describe("live revenue helpers", () => {
  it("rate per agent-hour = earned / hours of ad view time", async () => {
    const { ratePerHour } = await import("../services/earnings.service.js")
    // 300 ads x 12s = 1 hour of view time, 300 x $0.007 = $2.10
    expect(ratePerHour(2.1, 3_600_000)).toBeCloseTo(2.1, 6)
    expect(ratePerHour(0.007, 12_000)).toBeCloseTo(2.1, 6)
  })
  it("rate is 0 until there is a meaningful amount of view time", async () => {
    const { ratePerHour } = await import("../services/earnings.service.js")
    expect(ratePerHour(0, 0)).toBe(0)
    expect(ratePerHour(0.007, 500)).toBe(0)
  })
  it("parses the chart range, defaulting to 30d", async () => {
    const { parseRange } = await import("../services/earnings.service.js")
    expect(parseRange("1h")).toEqual({ range: "1h", step: "minute", points: 60 })
    expect(parseRange("24h")).toEqual({ range: "24h", step: "hour", points: 24 })
    expect(parseRange("30d")).toEqual({ range: "30d", step: "day", points: 30 })
    expect(parseRange("nope").range).toBe("30d")
    expect(parseRange(undefined).range).toBe("30d")
  })
})

import { describe, it, expect } from "vitest"
import { ctr, clampDays, clampLimit } from "../services/earnings.service.js"

describe("earnings helpers", () => {
  it("ctr is clicks / impressions, 0 when empty", () => {
    expect(ctr(0, 0)).toBe(0)
    expect(ctr(200, 5)).toBeCloseTo(0.025, 6)
  })
  it("clamps days to 1..90, default 30", () => {
    expect(clampDays(undefined)).toBe(30)
    expect(clampDays("7")).toBe(7)
    expect(clampDays("9999")).toBe(90)
    expect(clampDays("abc")).toBe(30)
  })
  it("clamps limit to 1..100, default 20", () => {
    expect(clampLimit(undefined)).toBe(20)
    expect(clampLimit("500")).toBe(100)
  })
})

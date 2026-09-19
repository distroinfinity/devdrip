import { describe, it, expect } from "vitest"
import { computeEarned, parseAdImpression } from "../services/ad-impression.service.js"

describe("computeEarned", () => {
  it("pays cpm/1000 * 0.7 for a viewable impression", () => {
    expect(computeEarned(12_000, "completed", 10)).toBeCloseTo(0.007, 6)
    expect(computeEarned(1_000, "interrupted", 10)).toBeCloseTo(0.007, 6)
  })
  it("pays nothing under one second", () => expect(computeEarned(999, "completed", 10)).toBe(0))
  it("pays nothing when skipped", () => expect(computeEarned(5_000, "skipped", 10)).toBe(0))
  it("pays nothing for junk input", () => {
    expect(computeEarned(Number.NaN, "completed", 10)).toBe(0)
    expect(computeEarned(5_000, "completed", -1)).toBe(0)
  })
})

describe("parseAdImpression", () => {
  const ok = {
    deliveryToken: "3f0c2f0e-7f1a-4b57-9d9e-0d8f4f3f2a11",
    durationMs: 12000,
    result: "completed",
  }
  it("accepts a well-formed row", () => expect(parseAdImpression(ok)).toEqual(ok))
  it("ignores extra client fields", () =>
    expect(parseAdImpression({ ...ok, deviceId: "x" })).toEqual(ok))
  it("rejects bad rows", () => {
    expect(parseAdImpression({ ...ok, deliveryToken: 5 })).toBeNull()
    expect(parseAdImpression({ ...ok, deliveryToken: "not-a-uuid" })).toBeNull()
    expect(parseAdImpression({ ...ok, result: "won" })).toBeNull()
    expect(parseAdImpression({ ...ok, result: "pending" })).toBeNull()
    expect(parseAdImpression({ ...ok, durationMs: -1 })).toBeNull()
    expect(parseAdImpression(null)).toBeNull()
  })
  it("clamps absurd durations", () => {
    expect(parseAdImpression({ ...ok, durationMs: 9_999_999 })?.durationMs).toBe(60_000)
  })
})

describe("click short codes", () => {
  it("derives a 12-hex code from a delivery id", async () => {
    const { clickCode } = await import("../services/ad-impression.service.js")
    expect(clickCode("3f0c2f0e-7f1a-4b57-9d9e-0d8f4f3f2a11")).toBe("3f0c2f0e7f1a")
  })
  it("turns a code into the uuid range that shares its prefix", async () => {
    const { codeRange } = await import("../services/ad-impression.service.js")
    expect(codeRange("3f0c2f0e7f1a")).toEqual({
      lo: "3f0c2f0e-7f1a-0000-0000-000000000000",
      hi: "3f0c2f0e-7f1a-ffff-ffff-ffffffffffff",
    })
    expect(codeRange("3F0C2F0E7F1A")?.lo).toBe("3f0c2f0e-7f1a-0000-0000-000000000000")
  })
  it("rejects anything that is not exactly 12 hex chars", async () => {
    const { codeRange } = await import("../services/ad-impression.service.js")
    expect(codeRange("abc")).toBeNull()
    expect(codeRange("zzzzzzzzzzzz")).toBeNull()
    expect(codeRange("3f0c2f0e7f1a00")).toBeNull()
    expect(codeRange("3f0c2f0e-7f1")).toBeNull()
  })
})

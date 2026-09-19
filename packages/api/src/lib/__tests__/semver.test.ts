import { describe, it, expect } from "vitest"
import { compareSemver } from "../semver.js"

describe("compareSemver", () => {
  it("0.2.9 < 0.2.10 (double-digit patch)", () => {
    expect(compareSemver("0.2.9", "0.2.10")).toBe(-1)
  })

  it("0.2.10 > 0.2.9", () => {
    expect(compareSemver("0.2.10", "0.2.9")).toBe(1)
  })

  it("1.0.0 === 1.0.0", () => {
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0)
  })

  it("double-digit minor: 0.2.10 > 0.2.9", () => {
    expect(compareSemver("0.2.10", "0.2.9")).toBe(1)
  })

  it("pre-release sorts below release: 1.0.0-beta < 1.0.0", () => {
    expect(compareSemver("1.0.0-beta", "1.0.0")).toBe(-1)
  })
})

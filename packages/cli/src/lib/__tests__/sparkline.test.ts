import { describe, it, expect } from "vitest"
import { sparkline } from "../sparkline.js"

describe("sparkline", () => {
  it("returns empty for width 0", () => {
    expect(sparkline([1, 2, 3], 0)).toBe("")
  })

  it("returns spaces for empty input", () => {
    expect(sparkline([], 5)).toBe("     ")
  })

  it("returns flat mid-block for single-point input", () => {
    expect(sparkline([5], 4)).toBe("▄▄▄▄")
  })

  it("returns flat mid-block for all-equal input", () => {
    expect(sparkline([10, 10, 10, 10], 4)).toBe("▄▄▄▄")
  })

  it("renders an ascending series with rising blocks", () => {
    const out = sparkline([1, 2, 3, 4, 5, 6, 7, 8], 8)
    expect(out.charAt(0)).toBe("▁")
    expect(out.charAt(out.length - 1)).toBe("█")
    expect(out.length).toBe(8)
  })

  it("matches requested width even when input length differs", () => {
    expect(sparkline([1, 2, 3, 4, 5, 6, 7, 8], 4).length).toBe(4)
    expect(sparkline([1, 2, 3], 10).length).toBe(10)
  })
})

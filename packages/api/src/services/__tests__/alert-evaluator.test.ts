import { describe, it, expect } from "vitest"

// duplicates the threshold + debounce predicates from alert-evaluator.service.ts
// to lock in the invariants we care about. if/when those helpers are exported,
// swap to direct imports.
function shouldFire(absChangePct: number, thresholdPct: number): boolean {
  return absChangePct >= thresholdPct
}

function isWithinDebounce(lastFiredAtMs: number, nowMs: number): boolean {
  const DEBOUNCE_MS = 60 * 60 * 1000
  return nowMs - lastFiredAtMs < DEBOUNCE_MS
}

describe("alert evaluator predicates", () => {
  it("fires when |changePct| meets the threshold", () => {
    expect(shouldFire(5, 5)).toBe(true)
    expect(shouldFire(6.2, 5)).toBe(true)
    expect(shouldFire(5.0, 5.0)).toBe(true)
  })

  it("does not fire below threshold", () => {
    expect(shouldFire(4.9, 5)).toBe(false)
    expect(shouldFire(0.1, 0.5)).toBe(false)
  })

  it("treats negative + positive moves the same (uses absolute value upstream)", () => {
    // the predicate operates on |changePct| — caller must pass Math.abs.
    expect(shouldFire(Math.abs(-6.2), 5)).toBe(true)
    expect(shouldFire(Math.abs(-4.9), 5)).toBe(false)
  })

  it("debounces within 60 min", () => {
    const now = 1_000_000_000
    expect(isWithinDebounce(now - 30 * 60 * 1000, now)).toBe(true) // 30 min ago
    expect(isWithinDebounce(now - 59 * 60 * 1000, now)).toBe(true) // 59 min ago
    expect(isWithinDebounce(now - 61 * 60 * 1000, now)).toBe(false) // 61 min ago
    expect(isWithinDebounce(now - 60 * 60 * 1000, now)).toBe(false) // exactly 60 min — boundary
  })
})

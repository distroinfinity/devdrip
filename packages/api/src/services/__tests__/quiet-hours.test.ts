import { describe, it, expect } from "vitest"
import { isInQuietHours } from "../../lib/quiet-hours.js"

const offNyc = -240 // EDT
const offUtc = 0

describe("isInQuietHours", () => {
  it("returns false when either endpoint is null", () => {
    const prefs = { quietHoursStart: null, quietHoursEnd: 420, tzOffsetMinutes: offUtc }
    expect(isInQuietHours(prefs, new Date("2026-05-08T03:00:00Z"))).toBe(false)
  })

  it("same-day window: 13:00 → 17:00 UTC", () => {
    const prefs = { quietHoursStart: 780, quietHoursEnd: 1020, tzOffsetMinutes: offUtc }
    expect(isInQuietHours(prefs, new Date("2026-05-08T12:59:00Z"))).toBe(false)
    expect(isInQuietHours(prefs, new Date("2026-05-08T13:00:00Z"))).toBe(true)
    expect(isInQuietHours(prefs, new Date("2026-05-08T16:59:00Z"))).toBe(true)
    expect(isInQuietHours(prefs, new Date("2026-05-08T17:00:00Z"))).toBe(false)
  })

  it("wrap-midnight: 22:00 → 07:30 UTC", () => {
    const prefs = { quietHoursStart: 1320, quietHoursEnd: 450, tzOffsetMinutes: offUtc }
    expect(isInQuietHours(prefs, new Date("2026-05-08T21:59:00Z"))).toBe(false)
    expect(isInQuietHours(prefs, new Date("2026-05-08T22:00:00Z"))).toBe(true)
    expect(isInQuietHours(prefs, new Date("2026-05-08T03:00:00Z"))).toBe(true)
    expect(isInQuietHours(prefs, new Date("2026-05-08T07:29:00Z"))).toBe(true)
    expect(isInQuietHours(prefs, new Date("2026-05-08T07:30:00Z"))).toBe(false)
  })

  it("zero-width window (start === end) is 'off'", () => {
    const prefs = { quietHoursStart: 600, quietHoursEnd: 600, tzOffsetMinutes: offUtc }
    expect(isInQuietHours(prefs, new Date("2026-05-08T10:00:00Z"))).toBe(false)
  })

  it("respects tzOffsetMinutes (NYC observer, 22:00→07:30 local)", () => {
    const prefs = { quietHoursStart: 1320, quietHoursEnd: 450, tzOffsetMinutes: offNyc }
    expect(isInQuietHours(prefs, new Date("2026-05-08T02:00:00Z"))).toBe(true) // 22:00 EDT
    expect(isInQuietHours(prefs, new Date("2026-05-08T12:00:00Z"))).toBe(false) // 08:00 EDT
  })
})

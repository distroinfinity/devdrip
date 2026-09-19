import { describe, it, expect } from "vitest"
import { computePacing } from "../services/reports.service.js"

const now = new Date("2026-04-24T12:00:00Z")

describe("computePacing", () => {
  it("on_track when spend matches elapsed fraction", () => {
    const p = computePacing({
      createdAt: new Date("2026-04-01T00:00:00Z"),
      startsAt: new Date("2026-04-01T00:00:00Z"),
      endsAt: new Date("2026-05-01T00:00:00Z"),
      budgetTotal: 100,
      actualSpend: 76, // ~76% elapsed
      now,
    })
    expect(p.status).toBe("on_track")
  })

  it("underpacing when spend < 85% of expected", () => {
    const p = computePacing({
      createdAt: new Date("2026-04-01T00:00:00Z"),
      startsAt: new Date("2026-04-01T00:00:00Z"),
      endsAt: new Date("2026-05-01T00:00:00Z"),
      budgetTotal: 100,
      actualSpend: 20,
      now,
    })
    expect(p.status).toBe("underpacing")
  })

  it("overpacing when spend > 115% of expected", () => {
    const p = computePacing({
      createdAt: new Date("2026-04-01T00:00:00Z"),
      startsAt: new Date("2026-04-01T00:00:00Z"),
      endsAt: new Date("2026-05-01T00:00:00Z"),
      budgetTotal: 100,
      actualSpend: 95,
      now,
    })
    expect(p.status).toBe("overpacing")
  })

  it("falls back to createdAt when startsAt is null", () => {
    const p = computePacing({
      createdAt: new Date("2026-04-01T00:00:00Z"),
      startsAt: null,
      endsAt: new Date("2026-05-01T00:00:00Z"),
      budgetTotal: 100,
      actualSpend: 76,
      now,
    })
    expect(p.status).toBe("on_track")
  })

  it("uses synthetic 30d duration when endsAt is null", () => {
    const p = computePacing({
      createdAt: new Date("2026-04-01T00:00:00Z"),
      startsAt: new Date("2026-04-01T00:00:00Z"),
      endsAt: null,
      budgetTotal: 100,
      actualSpend: 76,
      now,
    })
    // 23/30 elapsed = 0.767, expected 76.7 → ratio ~0.99 → on_track
    expect(p.status).toBe("on_track")
  })

  it("returns unknown when budgetTotal is zero", () => {
    const p = computePacing({
      createdAt: new Date("2026-04-01T00:00:00Z"),
      startsAt: null,
      endsAt: null,
      budgetTotal: 0,
      actualSpend: 0,
      now,
    })
    expect(p.status).toBe("unknown")
    expect(p.ratio).toBeNull()
  })
})

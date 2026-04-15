import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { AdSurface, REVENUE_SHARE_DEVELOPER, ImpressionResult } from "@devdrip/shared"

// mock dependencies before imports
vi.mock("../db/index.js", () => ({
  getDb: vi.fn(),
}))

vi.mock("../lib/budget.js", () => ({
  recordSpend: vi.fn().mockResolvedValue({ allowed: true, exhausted: false }),
  rollbackSpend: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../lib/frequency.js", () => ({
  incrementFrequency: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../services/campaign.service.js", () => ({
  transitionStatus: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../lib/logger.js", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}))

import { recordImpression, recordClick } from "../services/impression.service.js"
import { getDb } from "../db/index.js"
import { recordSpend, rollbackSpend } from "../lib/budget.js"
import { incrementFrequency } from "../lib/frequency.js"
import { transitionStatus } from "../services/campaign.service.js"

function mockCreativeRow(overrides: Record<string, unknown> = {}) {
  return {
    creativeId: "creative-1",
    campaignId: "campaign-1",
    source: "direct",
    surface: "terminal-tv",
    category: "developer-tools",
    cpmRate: 5.0,
    budgetTotal: 1000,
    budgetSpent: 100,
    budgetDaily: 50,
    pacingStrategy: "even",
    ...overrides,
  }
}

function mockTxWith(
  creativeRow: Record<string, unknown> | null,
  impressionRow: Record<string, unknown>
) {
  const insertReturning = vi.fn().mockResolvedValue([impressionRow])
  const insertValues = vi.fn(() => ({ returning: insertReturning }))
  const insertFn = vi.fn(() => ({ values: insertValues }))

  const txFn = vi.fn(async (cb: (tx: Record<string, unknown>) => Promise<unknown>) => {
    const tx = {
      insert: insertFn,
    }
    return cb(tx)
  })

  const selectWhere = vi.fn().mockResolvedValue(creativeRow ? [creativeRow] : [])
  const selectFrom = vi.fn(() => ({
    innerJoin: vi.fn(() => ({
      where: selectWhere,
    })),
    where: selectWhere,
  }))
  const selectFn = vi.fn(() => ({ from: selectFrom }))

  vi.mocked(getDb).mockReturnValue({
    select: selectFn,
    transaction: txFn,
  } as unknown as ReturnType<typeof getDb>)

  return { txFn, insertFn, insertValues, insertReturning }
}

describe("recordImpression", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(recordSpend).mockResolvedValue({ allowed: true, exhausted: false })
    vi.mocked(rollbackSpend).mockResolvedValue(undefined)
  })

  it("creates impression with correct earned amount for completed result", async () => {
    const cpmRate = 5.0
    const expectedEarned = (cpmRate / 1000) * REVENUE_SHARE_DEVELOPER
    const impressionRow = {
      id: "imp-1",
      creativeId: "creative-1",
      durationMs: 6000,
      result: "completed",
      earnedAmount: expectedEarned,
    }

    const { insertValues } = mockTxWith(mockCreativeRow({ cpmRate }), impressionRow)

    const result = await recordImpression({
      creativeId: "creative-1",
      deviceId: "device-1",
      userId: "user-1",
      surface: AdSurface.TerminalTv,
      durationMs: 6000,
      result: ImpressionResult.Completed,
    })

    expect(result.id).toBe("imp-1")
    // first insert call is the impression, second is earnings
    expect(insertValues).toHaveBeenCalledTimes(2)
  })

  it("does not create earnings entry for skipped result", async () => {
    const impressionRow = {
      id: "imp-1",
      creativeId: "creative-1",
      durationMs: 2000,
      result: "skipped",
      earnedAmount: 0,
    }

    const { insertValues } = mockTxWith(mockCreativeRow(), impressionRow)

    await recordImpression({
      creativeId: "creative-1",
      deviceId: "device-1",
      userId: "user-1",
      surface: AdSurface.TerminalTv,
      durationMs: 2000,
      result: ImpressionResult.Skipped,
    })

    // only one insert (impression), no earnings
    expect(insertValues).toHaveBeenCalledTimes(1)
  })

  it("calls recordSpend with correct campaign budget", async () => {
    const impressionRow = { id: "imp-1", result: "completed", earnedAmount: 0 }
    mockTxWith(
      mockCreativeRow({ budgetTotal: 500, budgetSpent: 50, budgetDaily: 25, cpmRate: 4.0 }),
      impressionRow
    )

    await recordImpression({
      creativeId: "creative-1",
      deviceId: "device-1",
      userId: "user-1",
      surface: AdSurface.TerminalTv,
      durationMs: 6000,
      result: ImpressionResult.Completed,
    })

    expect(recordSpend).toHaveBeenCalledWith("campaign-1", 4.0 / 1000, {
      budgetTotal: 500,
      budgetSpent: 50,
      budgetDaily: 25,
      pacingStrategy: "even",
    })
  })

  it("calls incrementFrequency after recording", async () => {
    const impressionRow = { id: "imp-1", result: "completed", earnedAmount: 0 }
    mockTxWith(mockCreativeRow(), impressionRow)

    await recordImpression({
      creativeId: "creative-1",
      deviceId: "device-1",
      userId: "user-1",
      surface: AdSurface.TerminalTv,
      durationMs: 6000,
      result: ImpressionResult.Completed,
    })

    // allow fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 10))
    expect(incrementFrequency).toHaveBeenCalledWith("device-1", "campaign-1", "terminal-tv")
  })

  it("triggers campaign completion when budget exhausted", async () => {
    vi.mocked(recordSpend).mockResolvedValue({ allowed: true, exhausted: true })
    const impressionRow = { id: "imp-1", result: "completed", earnedAmount: 0 }
    mockTxWith(mockCreativeRow(), impressionRow)

    await recordImpression({
      creativeId: "creative-1",
      deviceId: "device-1",
      userId: "user-1",
      surface: AdSurface.TerminalTv,
      durationMs: 6000,
      result: ImpressionResult.Completed,
    })

    await new Promise((r) => setTimeout(r, 10))
    expect(transitionStatus).toHaveBeenCalledWith("campaign-1", "completed")
  })

  it("throws StateError when creative is not servable", async () => {
    mockTxWith(null, {})

    await expect(
      recordImpression({
        creativeId: "nonexistent",
        deviceId: "device-1",
        userId: "user-1",
        surface: AdSurface.TerminalTv,
        durationMs: 6000,
        result: ImpressionResult.Completed,
      })
    ).rejects.toThrow("creative_not_servable")
  })

  it("throws StateError when the budget guard blocks the impression", async () => {
    vi.mocked(recordSpend).mockResolvedValue({ allowed: false, reason: "daily_cap" })
    const impressionRow = { id: "imp-1", result: "completed", earnedAmount: 0 }
    const { insertValues } = mockTxWith(mockCreativeRow(), impressionRow)

    await expect(
      recordImpression({
        creativeId: "creative-1",
        deviceId: "device-1",
        userId: "user-1",
        surface: AdSurface.TerminalTv,
        durationMs: 6000,
        result: ImpressionResult.Completed,
      })
    ).rejects.toThrow("campaign_budget_exhausted")

    expect(insertValues).not.toHaveBeenCalled()
  })

  it("rolls back spend if the DB transaction fails after reserving budget", async () => {
    const txFn = vi.fn(async () => {
      throw new Error("db_write_failed")
    })
    const selectWhere = vi.fn().mockResolvedValue([mockCreativeRow()])
    const selectFrom = vi.fn(() => ({
      innerJoin: vi.fn(() => ({
        where: selectWhere,
      })),
      where: selectWhere,
    }))
    const selectFn = vi.fn(() => ({ from: selectFrom }))

    vi.mocked(getDb).mockReturnValue({
      select: selectFn,
      transaction: txFn,
    } as unknown as ReturnType<typeof getDb>)

    await expect(
      recordImpression({
        creativeId: "creative-1",
        deviceId: "device-1",
        userId: "user-1",
        surface: AdSurface.TerminalTv,
        durationMs: 6000,
        result: ImpressionResult.Completed,
      })
    ).rejects.toThrow("db_write_failed")

    expect(rollbackSpend).toHaveBeenCalledWith("campaign-1", 5.0 / 1000)
  })
})

describe("recordClick", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns clickId on success", async () => {
    const insertReturning = vi.fn().mockResolvedValue([{ id: "click-1" }])
    const insertValues = vi.fn(() => ({ returning: insertReturning }))
    const insertFn = vi.fn(() => ({ values: insertValues }))

    vi.mocked(getDb).mockReturnValue({
      insert: insertFn,
    } as unknown as ReturnType<typeof getDb>)

    const result = await recordClick("imp-1")
    expect(result).toEqual({ clickId: "click-1" })
  })

  it("throws NotFoundError when FK constraint fails (impression does not exist)", async () => {
    const fkError = new Error("FK violation") as Error & { code: string }
    fkError.code = "23503"
    const insertReturning = vi.fn().mockRejectedValue(fkError)
    const insertValues = vi.fn(() => ({ returning: insertReturning }))
    const insertFn = vi.fn(() => ({ values: insertValues }))

    vi.mocked(getDb).mockReturnValue({
      insert: insertFn,
    } as unknown as ReturnType<typeof getDb>)

    await expect(recordClick("nonexistent")).rejects.toThrow("impression_not_found")
  })
})

// ── duration bounds ────────────────────────────────────────────────────────

import { assertDurationBounds } from "../routes/impressions.js"

describe("assertDurationBounds", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("rejects when durationMs exceeds elapsed + tolerance", () => {
    vi.setSystemTime(new Date("2026-04-15T00:00:10.000Z"))
    const issuedAt = Math.floor(new Date("2026-04-15T00:00:00.000Z").getTime() / 1000)
    // elapsed = 10000ms, tolerance = 1000ms → max claimable = 11000ms
    expect(() => assertDurationBounds(12000, ImpressionResult.Completed, issuedAt)).toThrow(
      "invalid_duration_ms"
    )
  })

  it("accepts when durationMs is within elapsed + tolerance", () => {
    vi.setSystemTime(new Date("2026-04-15T00:00:10.000Z"))
    const issuedAt = Math.floor(new Date("2026-04-15T00:00:00.000Z").getTime() / 1000)
    expect(() => assertDurationBounds(10000, ImpressionResult.Completed, issuedAt)).not.toThrow()
  })

  it("rejects completed with durationMs below MIN_COMPLETED_DURATION_MS", () => {
    vi.setSystemTime(new Date("2026-04-15T00:00:10.000Z"))
    const issuedAt = Math.floor(new Date("2026-04-15T00:00:00.000Z").getTime() / 1000)
    expect(() => assertDurationBounds(500, ImpressionResult.Completed, issuedAt)).toThrow(
      "invalid_duration_ms"
    )
  })

  it("does not enforce minimum for non-completed results", () => {
    vi.setSystemTime(new Date("2026-04-15T00:00:10.000Z"))
    const issuedAt = Math.floor(new Date("2026-04-15T00:00:00.000Z").getTime() / 1000)
    expect(() => assertDurationBounds(0, ImpressionResult.Skipped, issuedAt)).not.toThrow()
  })
})

// ── validator threshold ────────────────────────────────────────────────────

import { validateRecordImpression } from "../validators/ad.validators.js"

describe("validateRecordImpression duration threshold", () => {
  it("rejects completed impression with durationMs below 1000ms", () => {
    expect(() =>
      validateRecordImpression({ deliveryToken: "tok", durationMs: 500, result: "completed" })
    ).toThrow("invalid_duration_ms")
  })

  it("accepts completed impression with durationMs at 1000ms", () => {
    const result = validateRecordImpression({
      deliveryToken: "tok",
      durationMs: 1000,
      result: "completed",
    })
    expect(result.durationMs).toBe(1000)
  })

  it("accepts skipped impression with durationMs 0", () => {
    const result = validateRecordImpression({
      deliveryToken: "tok",
      durationMs: 0,
      result: "skipped",
    })
    expect(result.durationMs).toBe(0)
  })
})

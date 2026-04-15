import { describe, it, expect, vi, beforeEach } from "vitest"
import { REVENUE_SHARE_DEVELOPER, ImpressionResult } from "@devdrip/shared"

// mock dependencies before imports
vi.mock("../db/index.js", () => ({
  getDb: vi.fn(),
}))

vi.mock("../lib/budget.js", () => ({
  recordSpend: vi.fn().mockResolvedValue({ allowed: true, exhausted: false }),
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
import { recordSpend } from "../lib/budget.js"
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
      durationMs: 6000,
      result: ImpressionResult.Completed,
    })

    await new Promise((r) => setTimeout(r, 10))
    expect(transitionStatus).toHaveBeenCalledWith("campaign-1", "completed")
  })

  it("throws NotFoundError when creative does not exist", async () => {
    mockTxWith(null, {})

    await expect(
      recordImpression({
        creativeId: "nonexistent",
        deviceId: "device-1",
        userId: "user-1",
        durationMs: 6000,
        result: ImpressionResult.Completed,
      })
    ).rejects.toThrow("creative_not_found")
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

    const selectWhere = vi.fn().mockResolvedValue([{ id: "imp-1" }])
    const selectFrom = vi.fn(() => ({ where: selectWhere }))
    const selectFn = vi.fn(() => ({ from: selectFrom }))

    vi.mocked(getDb).mockReturnValue({
      select: selectFn,
      insert: insertFn,
    } as unknown as ReturnType<typeof getDb>)

    const result = await recordClick("imp-1")
    expect(result).toEqual({ clickId: "click-1" })
  })

  it("throws NotFoundError for non-existent impression", async () => {
    const selectWhere = vi.fn().mockResolvedValue([])
    const selectFrom = vi.fn(() => ({ where: selectWhere }))
    const selectFn = vi.fn(() => ({ from: selectFrom }))

    vi.mocked(getDb).mockReturnValue({ select: selectFn } as unknown as ReturnType<typeof getDb>)

    await expect(recordClick("nonexistent")).rejects.toThrow("impression_not_found")
  })
})

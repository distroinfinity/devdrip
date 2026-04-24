import { describe, it, expect, vi, beforeEach } from "vitest"
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

import { recordImpression, recordClick, recordClickByJti } from "../services/impression.service.js"
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
      deliveryJti: "test-jti",
    })

    expect(result.id).toBe("imp-1")
    // first insert call is the impression, second is earnings
    expect(insertValues).toHaveBeenCalledTimes(2)
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ deliveryJti: "test-jti" }))
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
      deliveryJti: "test-jti",
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
      deliveryJti: "test-jti",
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
      deliveryJti: "test-jti",
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
      deliveryJti: "test-jti",
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
        deliveryJti: "test-jti",
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
        deliveryJti: "test-jti",
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
        deliveryJti: "test-jti",
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

describe("recordClickByJti", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockDbForClickByJti(opts: {
    impressionRow?: { id: string; deviceId: string } | null
    deviceRow?: { userId: string } | null
    insertResult?: "success" | "conflict" | "fk"
    clickId?: string
  }) {
    const {
      impressionRow = { id: "imp-1", deviceId: "dev-1" },
      deviceRow = { userId: "user-1" },
      insertResult = "success",
      clickId = "click-1",
    } = opts

    // select calls: first for impressions, second for devices
    let selectCallCount = 0
    const selectFn = vi.fn(() => {
      const callIndex = selectCallCount++
      const row =
        callIndex === 0 ? (impressionRow ? [impressionRow] : []) : deviceRow ? [deviceRow] : []
      return {
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(row),
        })),
      }
    })

    let insertReturning: ReturnType<typeof vi.fn>
    if (insertResult === "conflict") {
      const err = new Error("unique violation") as Error & { code: string }
      err.code = "23505"
      insertReturning = vi.fn().mockRejectedValue(err)
    } else if (insertResult === "fk") {
      const err = new Error("fk violation") as Error & { code: string }
      err.code = "23503"
      insertReturning = vi.fn().mockRejectedValue(err)
    } else {
      insertReturning = vi.fn().mockResolvedValue([{ id: clickId }])
    }
    const insertValues = vi.fn(() => ({ returning: insertReturning }))
    const insertFn = vi.fn(() => ({ values: insertValues }))

    vi.mocked(getDb).mockReturnValue({
      select: selectFn,
      insert: insertFn,
    } as unknown as ReturnType<typeof getDb>)

    return { selectFn, insertFn, insertValues }
  }

  it("skips DB lookup when resolvedImpressionId provided, returns clickId + earningsDelta 0", async () => {
    const insertReturning = vi.fn().mockResolvedValue([{ id: "click-42" }])
    const insertValues = vi.fn(() => ({ returning: insertReturning }))
    const insertFn = vi.fn(() => ({ values: insertValues }))
    vi.mocked(getDb).mockReturnValue({
      insert: insertFn,
    } as unknown as ReturnType<typeof getDb>)

    const result = await recordClickByJti("jti-x", "user-1", "imp-resolved")
    expect(result).toEqual({ clickId: "click-42", earningsDelta: 0 })
    // no select was called
    expect(insertValues).toHaveBeenCalledWith({ impressionId: "imp-resolved" })
  })

  it("throws impression_not_synced when jti not found in DB", async () => {
    mockDbForClickByJti({ impressionRow: null })

    let err: unknown
    try {
      await recordClickByJti("jti-missing", "user-1")
    } catch (e) {
      err = e
    }
    expect((err as { errorCode: string }).errorCode).toBe("impression_not_synced")
  })

  it("throws delivery_not_owned when device belongs to different user", async () => {
    mockDbForClickByJti({ deviceRow: { userId: "other-user" } })

    let err: unknown
    try {
      await recordClickByJti("jti-y", "user-1")
    } catch (e) {
      err = e
    }
    expect((err as { errorCode: string }).errorCode).toBe("delivery_not_owned")
  })

  it("throws click_already_recorded on 23505 unique violation", async () => {
    mockDbForClickByJti({ insertResult: "conflict" })

    let err: unknown
    try {
      await recordClickByJti("jti-z", "user-1", "imp-1")
    } catch (e) {
      err = e
    }
    expect((err as { errorCode: string }).errorCode).toBe("click_already_recorded")
  })

  it("throws impression_not_synced on 23503 FK violation during insert", async () => {
    mockDbForClickByJti({ insertResult: "fk" })

    let err: unknown
    try {
      await recordClickByJti("jti-w", "user-1", "imp-1")
    } catch (e) {
      err = e
    }
    expect((err as { errorCode: string }).errorCode).toBe("impression_not_synced")
  })
})

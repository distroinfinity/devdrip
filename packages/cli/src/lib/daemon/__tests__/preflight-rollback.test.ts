import { describe, it, expect } from "vitest"
import { shouldRollbackOnRespawn } from "../lifecycle.js"

const base = { phase: "probation" as const, previousVersion: "0.2.10", newVersion: "0.2.11" }

describe("shouldRollbackOnRespawn", () => {
  it("rolls back when probation has had no healthy heartbeat past the threshold", () => {
    const now = 200_000
    expect(
      shouldRollbackOnRespawn({
        state: { ...base, swappedAt: now - 100_000 },
        lastHeartbeatAt: now - 120_000,
        now,
      })
    ).toBe(true)
  })

  it("does not roll back if a heartbeat appeared after the swap", () => {
    const now = 200_000
    expect(
      shouldRollbackOnRespawn({
        state: { ...base, swappedAt: now - 100_000 },
        lastHeartbeatAt: now - 5_000,
        now,
      })
    ).toBe(false)
  })

  it("does not roll back before the threshold elapses", () => {
    const now = 200_000
    expect(
      shouldRollbackOnRespawn({
        state: { ...base, swappedAt: now - 10_000 },
        lastHeartbeatAt: null,
        now,
      })
    ).toBe(false)
  })

  it("does not roll back when not in probation", () => {
    expect(
      shouldRollbackOnRespawn({
        state: { phase: "stable", previousVersion: "0.2.10", newVersion: "0.2.11", swappedAt: 0 },
        lastHeartbeatAt: null,
        now: 999_999,
      })
    ).toBe(false)
  })

  it("does not roll back when there is no previous version", () => {
    const now = 200_000
    expect(
      shouldRollbackOnRespawn({
        state: { ...base, previousVersion: null, swappedAt: now - 100_000 },
        lastHeartbeatAt: null,
        now,
      })
    ).toBe(false)
  })
})

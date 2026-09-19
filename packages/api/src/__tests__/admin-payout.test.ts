import { describe, it, expect } from "vitest"
import {
  validateSetPayoutStatus,
  validatePayoutStatusFilter,
} from "../validators/admin-payout.validators.js"

describe("validateSetPayoutStatus", () => {
  const validHash = "0x" + "a".repeat(64)

  it("accepts confirmed with a well-formed tx hash", () => {
    expect(validateSetPayoutStatus({ status: "confirmed", txHash: validHash })).toEqual({
      status: "confirmed",
      txHash: validHash,
      failureReason: null,
    })
  })

  it("accepts mixed-case hex in tx hash", () => {
    const mixed = "0xAbC" + "d".repeat(61)
    expect(validateSetPayoutStatus({ status: "confirmed", txHash: mixed }).txHash).toBe(mixed)
  })

  it("rejects confirmed without tx hash", () => {
    expect(() => validateSetPayoutStatus({ status: "confirmed" })).toThrow("invalid_tx_hash")
  })

  it("rejects tx hash missing 0x prefix", () => {
    const noPrefix = "a".repeat(64)
    expect(() => validateSetPayoutStatus({ status: "confirmed", txHash: noPrefix })).toThrow(
      "invalid_tx_hash"
    )
  })

  it("rejects tx hash with wrong length", () => {
    expect(() => validateSetPayoutStatus({ status: "confirmed", txHash: "0xabc" })).toThrow(
      "invalid_tx_hash"
    )
  })

  it("rejects tx hash with non-hex chars", () => {
    const bad = "0x" + "g".repeat(64)
    expect(() => validateSetPayoutStatus({ status: "confirmed", txHash: bad })).toThrow(
      "invalid_tx_hash"
    )
  })

  it("accepts failed with no tx hash and optional reason", () => {
    expect(validateSetPayoutStatus({ status: "failed", failureReason: "timeout" })).toEqual({
      status: "failed",
      txHash: null,
      failureReason: "timeout",
    })
  })

  it("accepts failed without a failure reason", () => {
    expect(validateSetPayoutStatus({ status: "failed" })).toEqual({
      status: "failed",
      txHash: null,
      failureReason: null,
    })
  })

  it("rejects pending as a target (worker-owned state)", () => {
    expect(() => validateSetPayoutStatus({ status: "pending" })).toThrow("invalid_status")
  })

  it("rejects processing as a target (worker-owned state)", () => {
    expect(() => validateSetPayoutStatus({ status: "processing" })).toThrow("invalid_status")
  })

  it("rejects unknown status values", () => {
    expect(() => validateSetPayoutStatus({ status: "nope" })).toThrow("invalid_status")
  })
})

describe("validatePayoutStatusFilter", () => {
  it("returns undefined when no filter is provided", () => {
    expect(validatePayoutStatusFilter({})).toBeUndefined()
  })

  it("accepts every valid status in the filter", () => {
    for (const s of ["pending", "processing", "confirmed", "failed"]) {
      expect(validatePayoutStatusFilter({ status: s })).toBe(s)
    }
  })

  it("rejects unknown filter values", () => {
    expect(() => validatePayoutStatusFilter({ status: "bogus" })).toThrow("invalid_status_filter")
  })
})

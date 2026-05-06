import { PayoutStatus } from "@distrotv/shared"
import { ValidationError } from "../errors/index.js"
import { requireBody, validateEnumValue, validateStringField } from "./common.js"

// ethereum tx hashes are exactly 0x + 64 hex chars
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/

export type AdminPayoutStatus = "pending" | "processing" | "confirmed" | "failed"

const VALID_PAYOUT_STATUSES = Object.values(PayoutStatus) as readonly string[]
// operators can only move a payout into a terminal state; let the worker own
// forward progress (pending→processing→confirmed). Reject resurrecting rows.
const OPERATOR_TARGETS = ["confirmed", "failed"] as const

export interface SetPayoutStatusInput {
  status: AdminPayoutStatus
  txHash: string | null
  failureReason: string | null
}

export function validateSetPayoutStatus(body: unknown): SetPayoutStatusInput {
  const b = requireBody(body)
  const status = validateEnumValue(b["status"], OPERATOR_TARGETS, "status") as AdminPayoutStatus
  if (status === "confirmed") {
    const txHash = validateStringField(b["txHash"], "tx_hash", { required: true, maxLength: 66 })
    if (!TX_HASH_RE.test(txHash)) throw new ValidationError("invalid_tx_hash")
    return { status, txHash, failureReason: null }
  }
  const failureReason = validateStringField(b["failureReason"], "failure_reason", {
    maxLength: 500,
  })
  return { status, txHash: null, failureReason }
}

export function validatePayoutStatusFilter(
  query: Record<string, unknown>
): AdminPayoutStatus | undefined {
  if (query["status"] === undefined) return undefined
  return validateEnumValue(
    query["status"],
    VALID_PAYOUT_STATUSES,
    "status_filter"
  ) as AdminPayoutStatus
}

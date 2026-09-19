// packages/shared/src/types/chain.ts

export interface ChainConfig {
  chainId: number
  name: string
  rpcUrl: string
  usdcAddress: `0x${string}`
  blockExplorerUrl: string
  blockExplorerTxPath: string // e.g. "/tx/" — appended with txHash
}

export type VerificationLevel = "device" | "orb"

export type CliPairStatus = "pending" | "linked" | "expired"

// Discriminating string union — settlement worker writes one of these to
// payouts.failure_reason. The "reverted: <reason>" tail is a free-form chain
// revert reason that we string-prefix so the union still narrows.
export type PayoutFailureReason =
  | "insufficient_funds"
  | "insufficient_gas"
  | "broadcast_timeout_after_3_retries"
  | `reverted: ${string}`

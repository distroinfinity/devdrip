// packages/shared/src/format.ts

import { WORLD_CHAIN_SEPOLIA } from "./constants/chain.js"

// Renders a USDC amount as "$X.XX". Accepts number or numeric string so callers
// can pass either a JS number or a Postgres NUMERIC(12,6) string without
// double-conversion. Negative values get a leading minus.
export function formatUsdc(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount
  if (!Number.isFinite(n)) return "$0.00"
  const sign = n < 0 ? "-" : ""
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

// World Chain Sepolia explorer URL for a transaction hash. Returns null when
// the hash is missing or malformed so callers can render a placeholder instead
// of a dangling explorer link. Validates EVM hash shape (0x + 64 hex chars).
export function worldscanTxUrl(txHash: string | null | undefined): string | null {
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) return null
  return `${WORLD_CHAIN_SEPOLIA.blockExplorerUrl}${WORLD_CHAIN_SEPOLIA.blockExplorerTxPath}${txHash}`
}

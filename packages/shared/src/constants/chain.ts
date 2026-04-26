// packages/shared/src/constants/chain.ts

import type { ChainConfig } from "../types/chain.js"

// World Chain Sepolia testnet (chainId 4801). Mainnet (480) is a Phase 2 ticket.
export const WORLD_CHAIN_SEPOLIA: ChainConfig = {
  chainId: 4801,
  name: "World Chain Sepolia",
  rpcUrl: "https://worldchain-sepolia.g.alchemy.com/public",
  usdcAddress: "0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88",
  blockExplorerUrl: "https://worldchain-sepolia.explorer.alchemy.com",
  blockExplorerTxPath: "/tx/",
}

// USDC has 6 decimals on World Chain (bridged USDC, matches Circle's standard).
export const USDC_DECIMALS = 6

// Auto-disburse cron threshold: ≥ $5 confirmed balance triggers a weekly payout.
// Distinct from MIN_PAYOUT_USDC (the user-initiated claim minimum).
export const MIN_AUTO_DISBURSE_USDC = 5.0

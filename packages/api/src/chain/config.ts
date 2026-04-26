// packages/api/src/chain/config.ts

import { defineChain } from "viem"
import { WORLD_CHAIN_SEPOLIA } from "@devdrip/shared"

export { WORLD_CHAIN_SEPOLIA }

// viem chain object for client factories. Falls back to the public RPC if
// WORLD_CHAIN_RPC env var isn't set; production should always provide its own.
export function worldChainSepoliaViem(rpcUrlOverride?: string) {
  return defineChain({
    id: WORLD_CHAIN_SEPOLIA.chainId,
    name: WORLD_CHAIN_SEPOLIA.name,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrlOverride ?? WORLD_CHAIN_SEPOLIA.rpcUrl] },
    },
    blockExplorers: {
      default: {
        name: "WorldScan",
        url: WORLD_CHAIN_SEPOLIA.blockExplorerUrl,
      },
    },
    testnet: true,
  })
}

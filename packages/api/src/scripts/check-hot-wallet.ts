// packages/api/src/scripts/check-hot-wallet.ts
//
// Smoke test: prints the configured hot wallet address, ETH balance, and USDC
// balance on World Chain Sepolia. Run with `pnpm --filter @distrotv/api chain:check`.

import "dotenv/config"
import { formatEther, formatUnits } from "viem"
import { env } from "../config/env.js"
import { getPublicClient, WORLD_CHAIN_SEPOLIA, usdcAbi } from "../chain/index.js"

async function main() {
  const address = env.hotWalletAddress as `0x${string}`
  const client = getPublicClient()

  const [ethWei, usdcRaw, usdcDecimals] = await Promise.all([
    client.getBalance({ address }),
    client.readContract({
      abi: usdcAbi,
      address: WORLD_CHAIN_SEPOLIA.usdcAddress,
      functionName: "balanceOf",
      args: [address],
    }),
    client.readContract({
      abi: usdcAbi,
      address: WORLD_CHAIN_SEPOLIA.usdcAddress,
      functionName: "decimals",
    }),
  ])

  const eth = formatEther(ethWei)
  const usdc = formatUnits(usdcRaw, Number(usdcDecimals))

  // Plain console.log so this works as a CLI script. The runbook in
  // gitbook-docs/architecture/chain.md tells operators what these numbers mean.
  console.log("hot wallet:", address)
  console.log("network:   ", WORLD_CHAIN_SEPOLIA.name, `(chainId ${WORLD_CHAIN_SEPOLIA.chainId})`)
  console.log("rpc:       ", env.worldChainRpc)
  console.log("eth:       ", eth, "ETH")
  console.log("usdc:      ", usdc, "USDC")

  // Threshold hints from the spec runbook (≤ $50 USDC, ≤ 0.01 ETH float).
  const ethNum = Number(eth)
  const usdcNum = Number(usdc)
  if (ethNum < 0.001) console.log("⚠ ETH below 0.001 — fund with World Chain Sepolia ETH faucet")
  if (usdcNum < 5) console.log("⚠ USDC below $5 — bridge from Sepolia or hit the testnet faucet")
}

main().catch((err) => {
  console.error("chain:check failed:", err)
  process.exit(1)
})

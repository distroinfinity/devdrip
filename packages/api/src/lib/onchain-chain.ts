import { createPublicClient, http, getAddress } from "viem"
import { XLAYER_RPC_URL, XLAYER_CHAIN_ID } from "../config/onchain.js"

const xlayer = {
  id: XLAYER_CHAIN_ID,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [XLAYER_RPC_URL] } },
} as const

export const publicClient = createPublicClient({
  transport: http(XLAYER_RPC_URL),
  chain: xlayer as never,
})

const hookAbi = [
  {
    type: "function",
    name: "volOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "lastTick", type: "int24" },
      { name: "ewmaVolBps", type: "uint32" },
      { name: "seeded", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "currentTick",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ name: "tick", type: "int24" }],
  },
] as const

export async function readVol(
  hookAddress: string,
  poolId: string
): Promise<{ tick: number; volBps: number }> {
  const address = getAddress(hookAddress)
  const id = poolId as `0x${string}`
  // volBps comes from the ewma accumulator; tick must be the LIVE pool tick
  // (currentTick view), not the cached volOf.lastTick.
  const [vol, tick] = await Promise.all([
    publicClient.readContract({
      address,
      abi: hookAbi,
      functionName: "volOf",
      args: [id],
    }) as Promise<readonly [number, number, boolean]>,
    publicClient.readContract({
      address,
      abi: hookAbi,
      functionName: "currentTick",
      args: [id],
    }) as Promise<number>,
  ])
  return { tick: Number(tick), volBps: Number(vol[1]) }
}

// price of token0 in token1 = 1.0001^tick * 10^(dec0 - dec1)
export function priceFromTick(tick: number, dec0: number, dec1: number): number {
  return Math.pow(1.0001, tick) * Math.pow(10, dec0 - dec1)
}

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

const volOfAbi = [
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
] as const

export async function readVol(
  hookAddress: string,
  poolId: string
): Promise<{ tick: number; volBps: number }> {
  const res = (await publicClient.readContract({
    address: getAddress(hookAddress),
    abi: volOfAbi,
    functionName: "volOf",
    args: [poolId as `0x${string}`],
  })) as readonly [number, number, boolean]
  return { tick: Number(res[0]), volBps: Number(res[1]) }
}

// price of token0 in token1 = 1.0001^tick * 10^(dec0 - dec1)
export function priceFromTick(tick: number, dec0: number, dec1: number): number {
  return Math.pow(1.0001, tick) * Math.pow(10, dec0 - dec1)
}

import { encodeFunctionData, getAddress, type Abi } from "viem"
import { eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { onchainPositions } from "../db/schema/onchain_positions.js"
import { onchainPools } from "../db/schema/onchain_pools.js"

const SWAP_ROUTER = process.env["XLAYER_SWAP_ROUTER"] ?? ""

// PoolSwapTest.swap(PoolKey, SwapParams, TestSettings, bytes hookData)
const swapRouterAbi: Abi = [
  {
    type: "function",
    name: "swap",
    stateMutability: "payable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "zeroForOne", type: "bool" },
          { name: "amountSpecified", type: "int256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
      {
        name: "testSettings",
        type: "tuple",
        components: [
          { name: "takeClaims", type: "bool" },
          { name: "settleUsingBurn", type: "bool" },
        ],
      },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [{ name: "delta", type: "int256" }],
  },
]

export async function prepareAction(
  userId: string,
  input: { positionId: string; action: "hedge" | "exit" | "rebalance"; amount?: string }
) {
  const db = getDb()
  const [pos] = await db
    .select()
    .from(onchainPositions)
    .where(eq(onchainPositions.id, input.positionId))
    .limit(1)
  if (!pos || pos.userId !== userId) throw new Error("position_not_found")

  const [pool] = await db
    .select()
    .from(onchainPools)
    .where(eq(onchainPools.poolId, pos.poolId))
    .limit(1)
  if (!pool) throw new Error("pool_not_found")

  if (input.action !== "hedge") throw new Error("action_not_implemented") // exit/rebalance deferred

  const amount = BigInt(input.amount ?? "1000000000000000") // 1e15 default (small hedge)
  const data = encodeFunctionData({
    abi: swapRouterAbi,
    functionName: "swap",
    args: [
      {
        currency0: getAddress(pool.token0),
        currency1: getAddress(pool.token1),
        fee: 0x800000,
        tickSpacing: pool.tickSpacing,
        hooks: getAddress(pool.hookAddress),
      },
      {
        zeroForOne: true,
        amountSpecified: -amount,
        sqrtPriceLimitX96: 4295128740n,
      },
      {
        takeClaims: false,
        settleUsingBurn: false,
      },
      "0x",
    ],
  })
  return { chainId: pool.chainId, to: getAddress(SWAP_ROUTER), data, value: "0" }
}

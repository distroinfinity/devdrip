import { Router } from "express"
import { formatEther, formatUnits } from "viem"
import { env } from "../config/env.js"
import { getPublicClient, WORLD_CHAIN_SEPOLIA, usdcAbi } from "../chain/index.js"

export const adminHotWalletRouter: ReturnType<typeof Router> = Router()

adminHotWalletRouter.get("/balance", async (_req, res, next) => {
  try {
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
    res.json({
      address,
      chainId: WORLD_CHAIN_SEPOLIA.chainId,
      ethWei: ethWei.toString(),
      ethFormatted: formatEther(ethWei),
      usdcRaw: usdcRaw.toString(),
      usdcFormatted: formatUnits(usdcRaw, Number(usdcDecimals)),
    })
  } catch (err) {
    next(err)
  }
})

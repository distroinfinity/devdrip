import { z } from "zod"

const hexAddr = z.string().regex(/^0x[a-fA-F0-9]{40}$/)
const bytes32 = z.string().regex(/^0x[a-fA-F0-9]{64}$/)

export const registerPositionSchema = z.object({
  chainId: z.number().int().positive(),
  poolId: bytes32,
  positionTokenId: z.string().optional(),
  tickLower: z.number().int(),
  tickUpper: z.number().int(),
  walletAddress: hexAddr,
  label: z.string().max(40).optional(),
})

export const prepareActionSchema = z.object({
  positionId: z.string().uuid(),
  action: z.enum(["hedge", "exit", "rebalance"]),
  amount: z.string().optional(),
  slippageBps: z.number().int().min(1).max(5000).optional(),
})

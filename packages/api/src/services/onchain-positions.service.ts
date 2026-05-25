import { eq, and, asc } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { onchainPositions } from "../db/schema/onchain_positions.js"

export async function registerPosition(
  userId: string,
  input: {
    chainId: number
    poolId: string
    positionTokenId?: string
    tickLower: number
    tickUpper: number
    walletAddress: string
    label?: string
  }
) {
  const db = getDb()
  const [row] = await db
    .insert(onchainPositions)
    .values({ userId, ...input })
    .returning()
  return row
}

export async function listPositions(userId: string) {
  const db = getDb()
  return db
    .select()
    .from(onchainPositions)
    .where(and(eq(onchainPositions.userId, userId), eq(onchainPositions.status, "active")))
    .orderBy(asc(onchainPositions.createdAt))
}

export async function deletePosition(userId: string, id: string) {
  const db = getDb()
  await db
    .update(onchainPositions)
    .set({ status: "closed" })
    .where(and(eq(onchainPositions.id, id), eq(onchainPositions.userId, userId)))
}

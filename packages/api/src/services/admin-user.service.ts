import { sql, eq, desc, count } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { users } from "../db/schema/users.js"
import { earningsLedger } from "../db/schema/earnings.js"
import type { AdminUser } from "@distrotv/shared"

export async function list(
  limit: number,
  offset: number
): Promise<{ users: AdminUser[]; total: number }> {
  const db = getDb()

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: users.id,
        githubLogin: users.githubLogin,
        email: users.email,
        walletAddress: users.walletAddress,
        createdAt: users.createdAt,
        lifetimeEarnings: sql<number>`coalesce(sum(${earningsLedger.amountUsdc}), 0)::float`,
      })
      .from(users)
      .leftJoin(earningsLedger, eq(earningsLedger.userId, users.id))
      .groupBy(users.id)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(users),
  ])

  return {
    users: rows.map((r) => ({
      id: r.id,
      githubLogin: r.githubLogin,
      email: r.email,
      hasWallet: Boolean(r.walletAddress),
      lifetimeEarningsUsdc: r.lifetimeEarnings ?? 0,
      createdAt: r.createdAt.toISOString(),
    })),
    total: totalRow?.count ?? 0,
  }
}

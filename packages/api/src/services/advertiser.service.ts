import { eq, and, count, notInArray } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { advertisers } from "../db/schema/advertisers.js"
import { campaigns } from "../db/schema/campaigns.js"
import { NotFoundError, ConflictError, pgErrorCode } from "../errors/index.js"
import type {
  CreateAdvertiserInput,
  UpdateAdvertiserInput,
} from "../validators/advertiser.validators.js"

export async function create(input: CreateAdvertiserInput) {
  const db = getDb()
  try {
    const [advertiser] = await db.insert(advertisers).values(input).returning()
    if (!advertiser) throw new Error("insert returned no rows")
    return advertiser
  } catch (err) {
    if (pgErrorCode(err) === "23505") throw new ConflictError("email_already_exists")
    throw err
  }
}

export async function list(limit: number, offset: number) {
  const db = getDb()
  const [rows, [totalRow]] = await Promise.all([
    db.select().from(advertisers).limit(limit).offset(offset).orderBy(advertisers.createdAt),
    db.select({ count: count() }).from(advertisers),
  ])
  return { advertisers: rows, total: totalRow?.count ?? 0 }
}

export async function getById(id: string) {
  const db = getDb()
  const [advertiser] = await db.select().from(advertisers).where(eq(advertisers.id, id))
  if (!advertiser) throw new NotFoundError("advertiser")
  return advertiser
}

export async function update(id: string, input: UpdateAdvertiserInput) {
  const db = getDb()
  try {
    const [updated] = await db
      .update(advertisers)
      .set(input)
      .where(eq(advertisers.id, id))
      .returning()
    if (!updated) throw new NotFoundError("advertiser")
    return updated
  } catch (err) {
    if (pgErrorCode(err) === "23505") throw new ConflictError("email_already_exists")
    throw err
  }
}

export async function remove(id: string) {
  const db = getDb()

  return db.transaction(async (tx) => {
    // check for non-draft/non-completed campaigns (prevents deletion of advertisers
    // with active or paused campaigns that may have served impressions)
    const [blocking] = await tx
      .select({ count: count() })
      .from(campaigns)
      .where(
        and(eq(campaigns.advertiserId, id), notInArray(campaigns.status, ["draft", "completed"]))
      )

    if (blocking && blocking.count > 0) {
      throw new ConflictError("has_active_campaigns")
    }

    try {
      const [deleted] = await tx.delete(advertisers).where(eq(advertisers.id, id)).returning()
      if (!deleted) throw new NotFoundError("advertiser")
      return deleted
    } catch (err) {
      // cascade delete may hit impressions FK RESTRICT via creatives
      if (pgErrorCode(err) === "23503") {
        throw new ConflictError("has_historical_data")
      }
      throw err
    }
  })
}

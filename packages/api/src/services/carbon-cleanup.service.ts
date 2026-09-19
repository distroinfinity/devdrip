import { sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { creatives } from "../db/schema/creatives.js"
import { logger } from "../lib/logger.js"

// deactivate Carbon creatives that haven't been served in 24 hours.
// deactivate (not delete) to preserve FK integrity with impressions.
export async function deactivateStaleCarbonCreatives(): Promise<number> {
  const db = getDb()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const result = await db
    .update(creatives)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      sql`${creatives.source} = 'carbon'
          AND ${creatives.isActive} = true
          AND ${creatives.updatedAt} < ${cutoff}`
    )
    .returning()

  const count = result.length
  if (count > 0) {
    logger.info({ count }, "deactivated stale carbon creatives")
  }
  return count
}

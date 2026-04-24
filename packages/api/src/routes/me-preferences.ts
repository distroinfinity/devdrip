import { Router } from "express"
import { eq, sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { preferences } from "../db/schema/preferences.js"
import { validateUpdatePreferences } from "../validators/preferences.validators.js"

export const mePreferencesRouter: ReturnType<typeof Router> = Router()

type PreferencesRow = typeof preferences.$inferSelect

function shape(row: PreferencesRow) {
  return {
    blockedCategories: row.blockedCategories,
    enabledSurfaces: row.enabledSurfaces,
    maxPerHour: row.maxPerHour,
    maxPerDay: row.maxPerDay,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
    tzOffsetMinutes: row.tzOffsetMinutes,
    idleSensitivityMs: row.idleSensitivityMs,
    sessionWarmupMs: row.sessionWarmupMs,
    nightMode: row.nightMode,
    updatedAt: row.updatedAt.toISOString(),
  }
}

mePreferencesRouter.get("/preferences", async (_req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const db = getDb()

    const [existing] = await db
      .select()
      .from(preferences)
      .where(eq(preferences.userId, userId))
      .limit(1)

    if (existing) {
      res.json({ preferences: shape(existing) })
      return
    }

    // lazy-init defaults so the CLI/dashboard always get a stable shape
    const [created] = await db
      .insert(preferences)
      .values({ userId })
      .onConflictDoNothing()
      .returning()

    if (created) {
      res.json({ preferences: shape(created) })
      return
    }

    // race: another request created it in parallel; re-read
    const [row] = await db.select().from(preferences).where(eq(preferences.userId, userId)).limit(1)

    if (!row) {
      res.status(500).json({ error: "internal_error" })
      return
    }

    res.json({ preferences: shape(row) })
  } catch (err) {
    next(err)
  }
})

mePreferencesRouter.put("/preferences", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const input = validateUpdatePreferences(req.body)

    const db = getDb()

    const insertValues: Record<string, unknown> = { userId }
    const updateSet: Record<string, unknown> = { updatedAt: sql`now()` }
    for (const [k, v] of Object.entries(input)) {
      if (v === undefined) continue
      insertValues[k] = v
      updateSet[k] = v
    }

    const [row] = await db
      .insert(preferences)
      .values(insertValues as typeof preferences.$inferInsert)
      .onConflictDoUpdate({ target: preferences.userId, set: updateSet })
      .returning()

    if (!row) {
      res.status(500).json({ error: "internal_error" })
      return
    }

    res.json({ preferences: shape(row) })
  } catch (err) {
    next(err)
  }
})

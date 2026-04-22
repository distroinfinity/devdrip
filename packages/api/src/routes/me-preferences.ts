import { Router } from "express"
import { sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { preferences } from "../db/schema/preferences.js"
import { validateUpdatePreferences } from "../validators/preferences.validators.js"

export const mePreferencesRouter: ReturnType<typeof Router> = Router()

mePreferencesRouter.put("/preferences", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const input = validateUpdatePreferences(req.body)

    const db = getDb()

    const insertValues: Record<string, unknown> = { userId }
    const updateSet: Record<string, unknown> = { updatedAt: sql`now()` }
    if (input.blockedCategories !== undefined) {
      insertValues["blockedCategories"] = input.blockedCategories
      updateSet["blockedCategories"] = input.blockedCategories
    }
    if (input.tzOffsetMinutes !== undefined) {
      insertValues["tzOffsetMinutes"] = input.tzOffsetMinutes
      updateSet["tzOffsetMinutes"] = input.tzOffsetMinutes
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

    res.json({
      preferences: {
        blockedCategories: row.blockedCategories,
        enabledSurfaces: row.enabledSurfaces,
        maxPerHour: row.maxPerHour,
        maxPerDay: row.maxPerDay,
        quietHoursStart: row.quietHoursStart,
        quietHoursEnd: row.quietHoursEnd,
        tzOffsetMinutes: row.tzOffsetMinutes,
        idleSensitivityMs: row.idleSensitivityMs,
      },
    })
  } catch (err) {
    next(err)
  }
})

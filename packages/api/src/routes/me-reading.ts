import { Router } from "express"
import { validateUUID } from "../validators/common.js"
import { validateSaveReadingItem } from "../validators/reading.validators.js"
import {
  saveReadingItem,
  listReadingItems,
  deleteReadingItem,
} from "../services/reading.service.js"

export const meReadingRouter: ReturnType<typeof Router> = Router()

meReadingRouter.post("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const body = validateSaveReadingItem(req.body)
    const result = await saveReadingItem({ userId, ...body })
    res.status(result.created ? 201 : 200).json({ item: result.item })
  } catch (err) {
    next(err)
  }
})

meReadingRouter.get("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const limitRaw = req.query["limit"]
    const limitParsed = typeof limitRaw === "string" ? Number.parseInt(limitRaw, 10) : 100
    const limit = Number.isFinite(limitParsed) ? Math.max(1, Math.min(100, limitParsed)) : 100
    const result = await listReadingItems(userId, limit)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

meReadingRouter.delete("/:id", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const id = validateUUID(req.params["id"], "id")
    await deleteReadingItem(userId, id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

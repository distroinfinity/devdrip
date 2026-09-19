import { Router } from "express"
import { registerPositionSchema } from "../validators/onchain.validators.js"
import {
  registerPosition,
  listPositions,
  deletePosition,
} from "../services/onchain-positions.service.js"

export const meOnchainRouter: ReturnType<typeof Router> = Router()

meOnchainRouter.post("/positions", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const input = registerPositionSchema.parse(req.body)
    const row = await registerPosition(userId, input)
    res.status(201).json(row)
  } catch (err) {
    next(err)
  }
})

meOnchainRouter.get("/positions", async (_req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    res.json({ positions: await listPositions(userId) })
  } catch (err) {
    next(err)
  }
})

meOnchainRouter.delete("/positions/:id", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    await deletePosition(userId, req.params["id"] as string)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

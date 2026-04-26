import { Router } from "express"
import { getBalance } from "../services/balance.service.js"

export const meBalanceRouter: ReturnType<typeof Router> = Router()

meBalanceRouter.get("/", async (_req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const balance = await getBalance(userId)
    res.json(balance)
  } catch (err) {
    next(err)
  }
})

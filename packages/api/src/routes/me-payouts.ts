import { Router } from "express"
import { createClaim } from "../services/payout-claim.service.js"
import { getPayout, listPayouts } from "../services/payout-list.service.js"
import {
  parseIdempotencyKey,
  parseListPayoutsQuery,
  parsePayoutIdParam,
} from "../validators/me-payouts.validators.js"

export const mePayoutsRouter: ReturnType<typeof Router> = Router()

mePayoutsRouter.post("/claim", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const idempotencyKey = parseIdempotencyKey(req.header("Idempotency-Key"))
    const result = await createClaim(userId, idempotencyKey)
    res.json({
      id: result.id,
      status: result.status,
      amount_usdc: result.amountUsdc,
      wallet_address: result.walletAddress,
    })
  } catch (err) {
    next(err)
  }
})

mePayoutsRouter.get("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const opts = parseListPayoutsQuery(req.query as Record<string, unknown>)
    const result = await listPayouts(userId, opts)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

mePayoutsRouter.get("/:id", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const id = parsePayoutIdParam(req.params["id"])
    const row = await getPayout(userId, id)
    res.json(row)
  } catch (err) {
    next(err)
  }
})

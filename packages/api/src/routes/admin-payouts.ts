import { Router } from "express"
import { validateUUID, validatePagination } from "../validators/common.js"
import {
  validateSetPayoutStatus,
  validatePayoutStatusFilter,
} from "../validators/admin-payout.validators.js"
import * as adminPayoutService from "../services/admin-payout.service.js"

export const adminPayoutsRouter: ReturnType<typeof Router> = Router()

adminPayoutsRouter.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = validatePagination(req.query as Record<string, unknown>)
    const status = validatePayoutStatusFilter(req.query as Record<string, unknown>)
    const result = await adminPayoutService.list(status, limit, offset)
    await res.json({ ...result, limit, offset })
  } catch (err) {
    next(err)
  }
})

adminPayoutsRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const id = validateUUID(req.params.id)
    const input = validateSetPayoutStatus(req.body)
    const payout = await adminPayoutService.setStatus(id, input)
    await res.json({ payout })
  } catch (err) {
    next(err)
  }
})

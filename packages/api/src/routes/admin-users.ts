import { Router } from "express"
import { validatePagination } from "../validators/common.js"
import * as adminUserService from "../services/admin-user.service.js"

export const adminUsersRouter: ReturnType<typeof Router> = Router()

adminUsersRouter.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = validatePagination(req.query as Record<string, unknown>)
    const result = await adminUserService.list(limit, offset)
    await res.json({ ...result, limit, offset })
  } catch (err) {
    next(err)
  }
})

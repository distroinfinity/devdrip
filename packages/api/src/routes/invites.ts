import { Router } from "express"
import { validatePagination } from "../validators/common.js"
import { validateGenerateInvites } from "../validators/invite.validators.js"
import * as inviteService from "../services/invite.service.js"

export const invitesRouter: ReturnType<typeof Router> = Router()

invitesRouter.post("/", async (req, res, next) => {
  try {
    const { count } = validateGenerateInvites(req.body)
    const invites = await inviteService.generateBatch(count)
    await res.status(201).json({ invites })
  } catch (err) {
    next(err)
  }
})

invitesRouter.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = validatePagination(req.query as Record<string, unknown>)
    const result = await inviteService.listUnused(limit, offset)
    await res.json({ ...result, limit, offset })
  } catch (err) {
    next(err)
  }
})

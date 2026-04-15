import { Router } from "express"
import { validateUUID, validatePagination } from "../validators/common.js"
import {
  validateCreateAdvertiser,
  validateUpdateAdvertiser,
} from "../validators/advertiser.validators.js"
import * as advertiserService from "../services/advertiser.service.js"

export const advertisersRouter: ReturnType<typeof Router> = Router()

advertisersRouter.post("/", async (req, res, next) => {
  try {
    const input = validateCreateAdvertiser(req.body)
    const advertiser = await advertiserService.create(input)
    await res.status(201).json({ advertiser })
  } catch (err) {
    next(err)
  }
})

advertisersRouter.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = validatePagination(req.query as Record<string, unknown>)
    const result = await advertiserService.list(limit, offset)
    await res.json({ ...result, limit, offset })
  } catch (err) {
    next(err)
  }
})

advertisersRouter.get("/:id", async (req, res, next) => {
  try {
    const id = validateUUID(req.params.id)
    const advertiser = await advertiserService.getById(id)
    await res.json({ advertiser })
  } catch (err) {
    next(err)
  }
})

advertisersRouter.patch("/:id", async (req, res, next) => {
  try {
    const id = validateUUID(req.params.id)
    const input = validateUpdateAdvertiser(req.body)
    const advertiser = await advertiserService.update(id, input)
    await res.json({ advertiser })
  } catch (err) {
    next(err)
  }
})

advertisersRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = validateUUID(req.params.id)
    const advertiser = await advertiserService.remove(id)
    await res.json({ advertiser })
  } catch (err) {
    next(err)
  }
})

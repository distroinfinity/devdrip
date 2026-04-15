import { Router } from "express"
import { validateUUID, validatePagination } from "../validators/common.js"
import {
  validateCreateCampaign,
  validateUpdateCampaign,
  validateStatusTransition,
  validateCampaignFilters,
} from "../validators/campaign.validators.js"
import * as campaignService from "../services/campaign.service.js"
import { creativesRouter } from "./creatives.js"

export const campaignsRouter: ReturnType<typeof Router> = Router()

// mount creatives as sub-router
campaignsRouter.use("/:campaignId/creatives", creativesRouter)

campaignsRouter.post("/", async (req, res, next) => {
  try {
    const input = validateCreateCampaign(req.body)
    const campaign = await campaignService.create(input)
    await res.status(201).json({ campaign })
  } catch (err) {
    next(err)
  }
})

campaignsRouter.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = validatePagination(req.query as Record<string, unknown>)
    const filters = validateCampaignFilters(req.query as Record<string, unknown>)
    const result = await campaignService.list(limit, offset, filters)
    await res.json({ ...result, limit, offset })
  } catch (err) {
    next(err)
  }
})

campaignsRouter.get("/:id", async (req, res, next) => {
  try {
    const id = validateUUID(req.params.id)
    const campaign = await campaignService.getById(id)
    await res.json({ campaign })
  } catch (err) {
    next(err)
  }
})

campaignsRouter.patch("/:id", async (req, res, next) => {
  try {
    const id = validateUUID(req.params.id)
    // fetch current state for cross-field validation (budget, dates)
    const current = await campaignService.getById(id)
    const input = validateUpdateCampaign(req.body, current)
    const campaign = await campaignService.update(id, input)
    await res.json({ campaign })
  } catch (err) {
    next(err)
  }
})

campaignsRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const id = validateUUID(req.params.id)
    const { status } = validateStatusTransition(req.body)
    const campaign = await campaignService.transitionStatus(id, status)
    await res.json({ campaign })
  } catch (err) {
    next(err)
  }
})

campaignsRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = validateUUID(req.params.id)
    const campaign = await campaignService.remove(id)
    await res.json({ campaign })
  } catch (err) {
    next(err)
  }
})

campaignsRouter.get("/:id/stats", async (req, res, next) => {
  try {
    const id = validateUUID(req.params.id)
    const stats = await campaignService.getStats(id)
    await res.json(stats)
  } catch (err) {
    next(err)
  }
})

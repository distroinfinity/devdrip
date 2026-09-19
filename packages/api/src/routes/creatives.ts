import { Router, type Request } from "express"
import { validateUUID, validatePagination } from "../validators/common.js"
import {
  validateCreateCreative,
  validateUpdateCreative,
} from "../validators/creative.validators.js"
import * as creativeService from "../services/creative.service.js"

type CampaignParams = { campaignId: string }
type CreativeParams = { campaignId: string; id: string }

export const creativesRouter: ReturnType<typeof Router> = Router({ mergeParams: true })

creativesRouter.post("/", async (req: Request<CampaignParams>, res, next) => {
  try {
    const campaignId = validateUUID(req.params.campaignId, "campaign_id")
    const input = validateCreateCreative(req.body, campaignId)
    const creative = await creativeService.create(input)
    await res.status(201).json({ creative })
  } catch (err) {
    next(err)
  }
})

creativesRouter.get("/", async (req: Request<CampaignParams>, res, next) => {
  try {
    const campaignId = validateUUID(req.params.campaignId, "campaign_id")
    const { limit, offset } = validatePagination(req.query as Record<string, unknown>)
    const isActive = req.query["isActive"] as string | undefined
    const isActiveFilter = isActive === "true" ? true : isActive === "false" ? false : undefined
    const result = await creativeService.list(campaignId, limit, offset, isActiveFilter)
    await res.json({ ...result, limit, offset })
  } catch (err) {
    next(err)
  }
})

creativesRouter.get("/:id", async (req: Request<CreativeParams>, res, next) => {
  try {
    const campaignId = validateUUID(req.params.campaignId, "campaign_id")
    const id = validateUUID(req.params.id)
    const creative = await creativeService.getById(campaignId, id)
    await res.json({ creative })
  } catch (err) {
    next(err)
  }
})

creativesRouter.patch("/:id", async (req: Request<CreativeParams>, res, next) => {
  try {
    const campaignId = validateUUID(req.params.campaignId, "campaign_id")
    const id = validateUUID(req.params.id)
    const input = validateUpdateCreative(req.body)
    const creative = await creativeService.update(campaignId, id, input)
    await res.json({ creative })
  } catch (err) {
    next(err)
  }
})

creativesRouter.delete("/:id", async (req: Request<CreativeParams>, res, next) => {
  try {
    const campaignId = validateUUID(req.params.campaignId, "campaign_id")
    const id = validateUUID(req.params.id)
    const creative = await creativeService.remove(campaignId, id)
    await res.json({ creative })
  } catch (err) {
    next(err)
  }
})

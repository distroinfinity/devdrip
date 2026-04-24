import { Router } from "express"
import { validateUUID } from "../validators/common.js"
import {
  listCampaignReports,
  getCampaignReport,
  getAdvertiserReport,
  type CampaignReportFilters,
} from "../services/reports.service.js"

export const adminReportsRouter: ReturnType<typeof Router> = Router()

adminReportsRouter.get("/campaigns", async (req, res, next) => {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>)
    const rows = await listCampaignReports(filters)
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

adminReportsRouter.get("/campaigns/:id", async (req, res, next) => {
  try {
    const id = validateUUID(req.params["id"], "campaign_id")
    const data = await getCampaignReport(id)
    res.json(data)
  } catch (err) {
    next(err)
  }
})

adminReportsRouter.get("/advertisers/:id", async (req, res, next) => {
  try {
    const id = validateUUID(req.params["id"], "advertiser_id")
    const data = await getAdvertiserReport(id)
    res.json(data)
  } catch (err) {
    next(err)
  }
})

function parseFilters(q: Record<string, unknown>): CampaignReportFilters {
  const out: CampaignReportFilters = {}
  if (typeof q["status"] === "string") out.status = q["status"]
  if (typeof q["source"] === "string") out.source = q["source"]
  if (typeof q["from"] === "string") out.from = new Date(q["from"])
  if (typeof q["to"] === "string") out.to = new Date(q["to"])
  return out
}

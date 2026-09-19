import { Router } from "express"
import { ValidationError } from "../errors/index.js"
import { parseListImpressionsQuery } from "../validators/me-impressions.validators.js"
import {
  CSV_LIMIT,
  getUserImpressionDetail,
  listUserImpressions,
  listUserImpressionsForCsv,
} from "../services/me-impressions.service.js"

export const meImpressionsRouter: ReturnType<typeof Router> = Router()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

meImpressionsRouter.get("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const filters = parseListImpressionsQuery(req.query as Record<string, unknown>)
    const data = await listUserImpressions(userId, filters)
    res.json(data)
  } catch (err) {
    next(err)
  }
})

meImpressionsRouter.get("/export.csv", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const parsed = parseListImpressionsQuery(req.query as Record<string, unknown>)
    const filters = {
      from: parsed.from,
      to: parsed.to,
      source: parsed.source,
      result: parsed.result,
      category: parsed.category,
    }
    const items = await listUserImpressionsForCsv(userId, filters)

    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename="impressions.csv"`)
    res.setHeader("X-Row-Limit", String(CSV_LIMIT))

    const header = [
      "id",
      "created_at",
      "advertiser",
      "campaign",
      "source",
      "surface",
      "category",
      "duration_ms",
      "result",
      "earned_amount",
      "cpm_rate",
      "has_click",
    ]
    res.write(header.join(",") + "\n")
    for (const r of items) {
      res.write(
        [
          r.id,
          r.createdAt,
          csvCell(r.advertiserName),
          csvCell(r.campaignName),
          r.source,
          r.surface,
          r.category ?? "",
          r.durationMs,
          r.result,
          r.earnedAmount,
          r.cpmRate,
          r.hasClick ? "true" : "false",
        ].join(",") + "\n"
      )
    }
    res.end()
  } catch (err) {
    next(err)
  }
})

meImpressionsRouter.get("/:id", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const id = req.params["id"]
    if (!id || !UUID_RE.test(id)) throw new ValidationError("invalid_id")
    const data = await getUserImpressionDetail(userId, id)
    res.json(data)
  } catch (err) {
    next(err)
  }
})

function csvCell(v: string | null | undefined): string {
  if (v === null || v === undefined) return ""
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

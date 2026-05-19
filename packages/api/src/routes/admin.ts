import { Router, type Router as ExpressRouter } from "express"
import { requireAuth } from "../middleware/auth.js"
import { requireAdmin } from "../middleware/admin.js"
import * as sources from "../services/admin/news-sources.service.js"
import * as tickers from "../services/admin/ticker-symbols.service.js"
import * as usersService from "../services/admin/users.service.js"
import { getSystemHealth } from "../services/admin/system-health.service.js"
import { getOverview } from "../services/admin/overview.service.js"
import { getMetrics } from "../services/admin/metrics.service.js"
import { getAuditEvents } from "../services/admin/audit.service.js"
import { sendSlackAlert } from "../lib/slack.js"

const router: ExpressRouter = Router()
router.use(requireAuth, requireAdmin)

// news sources
router.get("/news-sources", async (_req, res, next) => {
  try {
    res.json({ sources: await sources.listNewsSources() })
  } catch (e) {
    next(e)
  }
})
router.post("/news-sources", async (req, res, next) => {
  try {
    res.json(await sources.createNewsSource(req.body))
  } catch (e) {
    next(e)
  }
})
router.patch("/news-sources/:id", async (req, res, next) => {
  try {
    res.json(await sources.updateNewsSource(req.params.id, req.body))
  } catch (e) {
    next(e)
  }
})
router.delete("/news-sources/:id", async (req, res, next) => {
  try {
    await sources.deleteNewsSource(req.params.id)
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

// ticker symbols
router.get("/ticker-symbols", async (_req, res, next) => {
  try {
    res.json({ symbols: await tickers.listTickerSymbols() })
  } catch (e) {
    next(e)
  }
})
router.post("/ticker-symbols", async (req, res, next) => {
  try {
    res.json(await tickers.createTickerSymbol(req.body))
  } catch (e) {
    next(e)
  }
})
router.patch("/ticker-symbols/:symbol", async (req, res, next) => {
  try {
    res.json(await tickers.updateTickerSymbol(req.params.symbol, req.body))
  } catch (e) {
    next(e)
  }
})
router.delete("/ticker-symbols/:symbol", async (req, res, next) => {
  try {
    await tickers.deleteTickerSymbol(req.params.symbol)
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

// users
router.get("/users", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1))
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)))
    res.json(await usersService.listUsers(page, limit))
  } catch (e) {
    next(e)
  }
})
router.get("/users/:id", async (req, res, next) => {
  try {
    const result = await usersService.getUserDrilldown(req.params.id)
    if (!result) {
      res.status(404).json({ error: "user_not_found" })
      return
    }
    res.json(result)
  } catch (e) {
    next(e)
  }
})

// system observability
router.get("/system-health", async (_req, res, next) => {
  try {
    res.json(await getSystemHealth())
  } catch (e) {
    next(e)
  }
})
router.get("/overview", async (_req, res, next) => {
  try {
    res.json(await getOverview())
  } catch (e) {
    next(e)
  }
})

// aggregate metrics
router.get("/metrics", async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days ?? 30)))
    res.json(await getMetrics(days))
  } catch (e) {
    next(e)
  }
})

// cross-user alert audit log
router.get("/alert-events", async (req, res, next) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100)))
    const since = typeof req.query.since === "string" ? req.query.since : null
    res.json({ events: await getAuditEvents(limit, since) })
  } catch (e) {
    next(e)
  }
})

// debug
router.post("/test-slack-webhook", async (_req, res, next) => {
  try {
    await sendSlackAlert("test ping from admin dashboard", { severity: "info" })
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

export { router as adminRouter }

import { Router } from "express"
import { listAlertsForUser, setAlerts } from "../services/alert.service.js"
import { validatePutAlerts } from "../validators/alerts.validators.js"

export const meAlertsRouter: ReturnType<typeof Router> = Router()

meAlertsRouter.get("/", async (_req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const items = await listAlertsForUser(userId)
    res.json({ alerts: items })
  } catch (err) {
    next(err)
  }
})

meAlertsRouter.put("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const input = validatePutAlerts(req.body)
    await setAlerts(userId, input.alerts)
    const items = await listAlertsForUser(userId)
    res.json({ alerts: items })
  } catch (err) {
    next(err)
  }
})

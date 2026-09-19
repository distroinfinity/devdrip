import { Router } from "express"
import {
  listChannels,
  getSubscriptionsForUser,
  setSubscriptions,
} from "../services/channel.service.js"
import { validatePutChannels } from "../validators/channels.validators.js"

// Public — anyone (incl. anon devices via authed router below) can see the catalog.
export const channelsPublicRouter: ReturnType<typeof Router> = Router()
channelsPublicRouter.get("/", async (_req, res, next) => {
  try {
    const items = await listChannels()
    res.json({ channels: items })
  } catch (err) {
    next(err)
  }
})

// Authed — caller's subscriptions + per-channel priority.
export const meChannelsRouter: ReturnType<typeof Router> = Router()

meChannelsRouter.get("/", async (_req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const items = await getSubscriptionsForUser(userId)
    res.json({ channels: items })
  } catch (err) {
    next(err)
  }
})

meChannelsRouter.put("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const input = validatePutChannels(req.body)
    await setSubscriptions(userId, input.channels)
    const items = await getSubscriptionsForUser(userId)
    res.json({ channels: items })
  } catch (err) {
    next(err)
  }
})

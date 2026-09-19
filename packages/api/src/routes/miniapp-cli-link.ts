import { Router } from "express"
import { requireCompletedMiniAppSession } from "../middleware/miniapp-auth.js"
import { linkPairSession } from "../services/cli-pair.service.js"
import { parsePairCodeParam } from "../validators/cli-pair.validators.js"

export const miniappCliLinkRouter: ReturnType<typeof Router> = Router()

miniappCliLinkRouter.post("/:code", requireCompletedMiniAppSession, async (req, res, next) => {
  try {
    const userId = res.locals["miniAppUserId"] as string
    const code = parsePairCodeParam(req.params["code"])
    const user = await linkPairSession(code, userId)
    res.json({ ok: true, user })
  } catch (err) {
    next(err)
  }
})

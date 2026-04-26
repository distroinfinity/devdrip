import { Router } from "express"
import { requireMiniAppSession } from "../middleware/miniapp-auth.js"
import { verifyWorldId } from "../services/world-id.service.js"
import { parseWorldIdVerify } from "../validators/miniapp.validators.js"

export const miniappWorldIdRouter: ReturnType<typeof Router> = Router()

miniappWorldIdRouter.post("/verify", requireMiniAppSession, async (req, res, next) => {
  try {
    const userId = res.locals["miniAppUserId"] as string
    const { proof } = parseWorldIdVerify(req.body)
    const { verificationLevel } = await verifyWorldId({ userId, proof })
    res.json({ verification_level: verificationLevel })
  } catch (err) {
    next(err)
  }
})

import { Router } from "express"
import { createPairSession, fetchPairTokens } from "../services/cli-pair.service.js"
import { parsePairCodeParam } from "../validators/cli-pair.validators.js"

export const cliPairRouter: ReturnType<typeof Router> = Router()

cliPairRouter.post("/", async (_req, res, next) => {
  try {
    const session = await createPairSession()
    res.json({
      code: session.code,
      link_url: session.linkUrl,
      qr_payload: session.qrPayload,
      expires_at: session.expiresAt.toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

// Long-poll up to LONG_POLL_BUDGET_MS for the pair_session to flip from pending
// to linked. Server-side polling avoids hammering the DB from the CLI client.
const LONG_POLL_BUDGET_MS = 25_000
const POLL_INTERVAL_MS = 1_000

cliPairRouter.get("/:code", async (req, res, next) => {
  try {
    const code = parsePairCodeParam(req.params["code"])
    const startedAt = Date.now()
    while (Date.now() - startedAt < LONG_POLL_BUDGET_MS) {
      const result = await fetchPairTokens(code)
      if (result.kind === "linked") {
        res.status(200).json({
          token: result.token,
          refresh_token: result.refreshToken,
          user: result.user,
        })
        return
      }
      if (result.kind === "expired") {
        res.status(410).json({ error: "pair_session_expired" })
        return
      }
      // pending — sleep and re-check
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    }
    res.status(202).json({ status: "pending" })
  } catch (err) {
    next(err)
  }
})

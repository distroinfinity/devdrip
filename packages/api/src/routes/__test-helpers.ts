import { Router } from "express"
import { env } from "../config/env.js"

export const testHelpersRouter: ReturnType<typeof Router> = Router()

// M2: test-helper endpoints rebuilt when magic-link auth + auth_tokens land.
// cli_pair_sessions, refresh_tokens, and walletAddress were removed in Batch 5.
testHelpersRouter.post("/setup-paired-link", async (_req, res) => {
  if (env.nodeEnv === "production") {
    res.status(404).json({ error: "not_found" })
    return
  }
  res.status(503).json({ error: "test_helper_unavailable_until_m2" })
})

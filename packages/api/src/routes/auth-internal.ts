import { Router } from "express"
import { z } from "zod"
import { env } from "../config/env.js"
import { createOAuthState, consumeOAuthState } from "../services/oauth-state.service.js"
import { bindPairToUser } from "../services/pairing.service.js"

export const authInternalRouter: ReturnType<typeof Router> = Router()

authInternalRouter.use((req, res, next) => {
  const provided = req.header("x-internal-secret")
  if (!provided || provided !== env.apiInternalSecret) {
    res.status(403).json({ error: "forbidden" })
    return
  }
  next()
})

authInternalRouter.post("/oauth-state-create", async (req, res) => {
  const schema = z.object({
    pair: z.string().min(8).max(64).optional(),
    next: z.string().max(255).optional(),
  })
  const parse = schema.safeParse(req.body)
  if (!parse.success) {
    await res.status(400).json({ error: "invalid_body" })
    return
  }
  const nonce = await createOAuthState({ pairCode: parse.data.pair, next: parse.data.next })
  await res.status(200).json({ nonce })
})

authInternalRouter.post("/oauth-state-consume", async (req, res) => {
  const schema = z.object({ nonce: z.string().min(16) })
  const parse = schema.safeParse(req.body)
  if (!parse.success) {
    await res.status(400).json({ error: "invalid_body" })
    return
  }
  const payload = await consumeOAuthState(parse.data.nonce)
  if (!payload) {
    await res.status(404).json({ error: "oauth_state_expired" })
    return
  }
  await res.status(200).json(payload)
})

// bind a pair code to an ALREADY-authenticated user (no OAuth round-trip). the
// dashboard calls this when /setup is hit with a live session + a pair code, so
// the CLI long-poll completes instead of hanging.
authInternalRouter.post("/pair-bind", async (req, res) => {
  const schema = z.object({ userId: z.string().min(1), pair: z.string().min(8).max(64) })
  const parse = schema.safeParse(req.body)
  if (!parse.success) {
    await res.status(400).json({ error: "invalid_body" })
    return
  }
  const pairBound = await bindPairToUser(parse.data.userId, parse.data.pair)
  await res.status(200).json({ pairBound })
})

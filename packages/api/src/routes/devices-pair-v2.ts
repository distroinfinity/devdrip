import { Router } from "express"
import { eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { users } from "../db/schema/users.js"
import {
  createPendingPair,
  consumePairIfReady,
  peekPair,
  PAIR_TTL_SECONDS,
} from "../services/pairing.service.js"
import { env } from "../config/env.js"
import { logger } from "../lib/logger.js"

export const devicesPairInitRouter: ReturnType<typeof Router> = Router()
export const devicesPairPollRouter: ReturnType<typeof Router> = Router()

// POST /devices/pair-init — public, no auth.
devicesPairInitRouter.post("/", async (_req, res) => {
  try {
    const code = await createPendingPair()
    const setupUrl = `${env.webUrl}/setup?pair=${code}`
    await res.status(200).json({ code, setupUrl, expiresInSec: PAIR_TTL_SECONDS })
  } catch (err) {
    // surface the real cause — a blank 503 hid an exhausted Upstash command
    // quota for days. redis writes here are the only thing that can throw.
    logger.error({ err }, "pair_init_failed")
    await res.status(503).json({ error: "pair_init_failed", retryable: true })
  }
})

// GET /devices/pair-poll?code=<code> — long-poll up to ~25s.
const POLL_TOTAL_MS = 25_000
const POLL_TICK_MS = 1_000

devicesPairPollRouter.get("/", async (req, res) => {
  const code = typeof req.query["code"] === "string" ? req.query["code"] : ""
  if (!code) {
    await res.status(400).json({ error: "missing_code" })
    return
  }
  const deadline = Date.now() + POLL_TOTAL_MS
  while (Date.now() < deadline) {
    const current = await peekPair(code)
    if (!current) {
      await res.status(410).json({ error: "pair_expired" })
      return
    }
    if (current.kind === "ready") {
      const ready = await consumePairIfReady(code)
      if (!ready) {
        await res.status(410).json({ error: "pair_expired" })
        return
      }
      const [user] = await getDb()
        .select({
          id: users.id,
          githubLogin: users.githubLogin,
          email: users.email,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, ready.userId))
        .limit(1)
      await res.status(200).json({
        deviceToken: ready.deviceToken,
        deviceId: ready.deviceId,
        user,
      })
      return
    }
    await new Promise((r) => setTimeout(r, POLL_TICK_MS))
  }
  await res.status(204).end()
})

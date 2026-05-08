import { env } from "../config/env.js"
import { getRedis } from "./redis.js"
import { logger } from "./logger.js"

type Severity = "info" | "warn" | "error"

const THROTTLE_TTL_SEC = 60 * 60 // 1 hour per dedupe key

const EMOJI: Record<Severity, string> = {
  info: "▸",
  warn: "⚠️",
  error: "🚨",
}

interface Options {
  severity?: Severity
  // optional dedupe key — suppresses repeats within THROTTLE_TTL_SEC
  dedupe?: string
}

// fire-and-forget. failures swallowed.
export async function sendSlackAlert(message: string, opts: Options = {}): Promise<void> {
  if (!env.slackWebhookUrl) return
  const severity = opts.severity ?? "info"

  if (opts.dedupe) {
    try {
      const redis = getRedis()
      const key = `slack:throttle:${opts.dedupe}`
      const set = await redis.set(key, "1", { nx: true, ex: THROTTLE_TTL_SEC })
      if (set !== "OK") return // already alerted within the window
    } catch (err) {
      // redis failure shouldn't block the slack send — log and continue (no throttle)
      logger.error({ err: String(err) }, "slack throttle redis check failed (continuing)")
    }
  }

  try {
    await fetch(env.slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `${EMOJI[severity]} ${message}` }),
    })
  } catch (err) {
    logger.error({ err: String(err) }, "slack webhook failed (swallowed)")
  }
}

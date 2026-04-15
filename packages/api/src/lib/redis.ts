import { Redis } from "@upstash/redis"
import { env } from "../config/env.js"

// eager init — crashes at startup if env vars are missing
export const redis = new Redis({
  url: env.upstashRedisRestUrl,
  token: env.upstashRedisRestToken,
})

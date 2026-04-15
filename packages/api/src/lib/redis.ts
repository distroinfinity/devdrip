import { Redis } from "@upstash/redis"
import { env } from "../config/env.js"

let _redis: Redis | undefined

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({ url: env.upstashRedisRestUrl, token: env.upstashRedisRestToken })
  }
  return _redis
}

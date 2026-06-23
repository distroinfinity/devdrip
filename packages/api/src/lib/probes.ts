import { sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { getRedis } from "./redis.js"

const PROBE_TIMEOUT_MS = 3_000

function withTimeout(promise: Promise<unknown>, label: string): Promise<void> {
  return Promise.race([
    promise.then(() => {}),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} probe timeout`)), PROBE_TIMEOUT_MS)
    ),
  ])
}

// monitoring can poll /health every few seconds; cache a successful db probe
// for 10s so we don't run SELECT 1 (and keep the db compute pinned) on every
// poll. only success is cached — a failure always re-probes and surfaces fast.
const DB_PING_CACHE_MS = 10_000
let lastDbOkAt = 0

export async function probeDb(): Promise<void> {
  if (Date.now() - lastDbOkAt < DB_PING_CACHE_MS) return
  await withTimeout(getDb().execute(sql`SELECT 1`), "db")
  lastDbOkAt = Date.now()
}

// platform/monitoring can poll /health every few seconds; cache a successful
// redis PING for 30s so we don't spend a Redis command on every probe. redis is
// non-critical (health treats it as fail-open), so 30s of staleness is fine.
const REDIS_PING_CACHE_MS = 30_000
let lastRedisOkAt = 0

export async function probeRedis(): Promise<void> {
  if (Date.now() - lastRedisOkAt < REDIS_PING_CACHE_MS) return
  await withTimeout(getRedis().ping(), "redis")
  lastRedisOkAt = Date.now()
}

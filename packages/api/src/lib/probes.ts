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

export async function probeDb(): Promise<void> {
  await withTimeout(getDb().execute(sql`SELECT 1`), "db")
}

export async function probeRedis(): Promise<void> {
  await withTimeout(getRedis().ping(), "redis")
}

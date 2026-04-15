import { sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { getRedis } from "./redis.js"

export async function probeDb(): Promise<void> {
  await getDb().execute(sql`SELECT 1`)
}

export async function probeRedis(): Promise<void> {
  await getRedis().ping()
}

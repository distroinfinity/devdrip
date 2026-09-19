import { drizzle as drizzlePg } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index.js"
import { env } from "../config/env.js"

// the api runs as a persistent server (railway), so we use the postgres-js
// (tcp) driver for every target. any non-local target (neon | railway) is a
// real tcp postgres reached via the unpooled url, falling back to the pooled one.
type DbInstance = ReturnType<typeof drizzlePg<typeof schema>>

let _db: DbInstance | undefined

export function dbUrlForTarget(target: "local" | "neon" | "railway"): string {
  const url =
    target === "local"
      ? process.env["DATABASE_URL_LOCAL"]
      : (process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"])
  if (!url) throw new Error(`database url required for DB_TARGET=${target}`)
  return url
}

export function getDb() {
  if (!_db) {
    const url = dbUrlForTarget(env.dbTarget)
    // explicit pool options: bound connections, fail fast on connect, and let
    // idle connections close so the db can scale down between bursts.
    _db = drizzlePg(postgres(url, { max: 10, connect_timeout: 10, idle_timeout: 30 }), {
      schema,
    })
  }
  return _db
}

export type Db = DbInstance

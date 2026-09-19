import { drizzle as drizzlePg } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index.js"
import { env } from "../config/env.js"

// the api runs as a persistent server (railway), so we use the postgres-js
// (tcp) driver for every target. the neon-http driver can't do transactions
// (setSubscriptions / setWatchlists need them); the unpooled neon endpoint is
// a real postgres connection that supports them. local dev already used this.
type DbInstance = ReturnType<typeof drizzlePg<typeof schema>>

let _db: DbInstance | undefined

export function getDb() {
  if (!_db) {
    const target = env.dbTarget
    const url =
      target === "local"
        ? process.env["DATABASE_URL_LOCAL"]
        : (process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"])
    if (!url) throw new Error(`database url required for DB_TARGET=${target}`)
    _db = drizzlePg(postgres(url), { schema })
  }
  return _db
}

export type Db = DbInstance

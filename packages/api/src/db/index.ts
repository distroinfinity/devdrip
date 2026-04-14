import { neon } from "@neondatabase/serverless"
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http"
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index.js"
import { env } from "../config/env.js"

type DbInstance =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzlePg<typeof schema>>

let _db: DbInstance | undefined

export function getDb() {
  if (!_db) {
    const target = env.dbTarget
    if (target === "local") {
      const url = process.env["DATABASE_URL_LOCAL"]
      if (!url) throw new Error("DATABASE_URL_LOCAL is required when DB_TARGET=local")
      _db = drizzlePg(postgres(url), { schema })
    } else {
      const url = process.env["DATABASE_URL"]
      if (!url) throw new Error("DATABASE_URL is required when DB_TARGET=neon")
      _db = drizzleNeon(neon(url), { schema })
    }
  }
  return _db
}

export type Db = DbInstance

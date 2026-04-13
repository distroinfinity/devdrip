import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema/index.js"

const url = process.env["DATABASE_URL"]
if (!url) throw new Error("DATABASE_URL is required")
const sql = neon(url)

export const db = drizzle(sql, { schema })

export type Db = typeof db

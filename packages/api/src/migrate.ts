import "dotenv/config"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"

// standalone runner: avoids importing config/env (which requireEnv's the whole
// app surface) so a deploy can migrate before every other env var is wired.
// migrations are transactional under postgres-js — never use the neon-http
// driver here (no multi-statement transactions over http).

const here = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = [join(here, "migrations"), join(here, "../src/db/migrations")].find((p) =>
  existsSync(join(p, "meta/_journal.json"))
)

const target = process.env["DB_TARGET"] === "neon" ? "neon" : "local"
const url =
  target === "neon"
    ? (process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"])
    : (process.env["DATABASE_URL_LOCAL_UNPOOLED"] ?? process.env["DATABASE_URL_LOCAL"])

async function main(): Promise<void> {
  if (!migrationsFolder) throw new Error("migrate: migrations folder not found")
  if (!url) throw new Error(`migrate: database url required for DB_TARGET=${target}`)
  const sql = postgres(url, { max: 1 })
  try {
    await migrate(drizzle(sql), { migrationsFolder })
    console.log(`[migrate] up to date (target=${target})`)
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err)
  process.exit(1)
})

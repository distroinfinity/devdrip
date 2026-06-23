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

export function resolveMigrateUrl(e: NodeJS.ProcessEnv = process.env): {
  target: "local" | "remote"
  url: string | undefined
} {
  const target = (e["DB_TARGET"] ?? "local") === "local" ? "local" : "remote"
  const url =
    target === "remote"
      ? (e["DATABASE_URL_UNPOOLED"] ?? e["DATABASE_URL"])
      : (e["DATABASE_URL_LOCAL_UNPOOLED"] ?? e["DATABASE_URL_LOCAL"])
  return { target, url }
}

async function main(): Promise<void> {
  if (!migrationsFolder) throw new Error("migrate: migrations folder not found")
  const { target, url } = resolveMigrateUrl()
  if (!url) throw new Error(`migrate: database url required for DB_TARGET=${target}`)
  const sql = postgres(url, { max: 1 })
  try {
    await migrate(drizzle(sql), { migrationsFolder })
    console.log(`[migrate] up to date (target=${target})`)
  } finally {
    await sql.end()
  }
}

// only auto-run when invoked directly (node dist/migrate.js); importing for
// tests must not trigger a live migration.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("[migrate] failed:", err)
    process.exit(1)
  })
}

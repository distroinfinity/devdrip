import { defineConfig } from "drizzle-kit"
import "dotenv/config"

const target = process.env["DB_TARGET"] ?? "local"
const url =
  target === "local"
    ? process.env["DATABASE_URL_LOCAL_UNPOOLED"]
    : process.env["DATABASE_URL_UNPOOLED"]

if (!url) throw new Error(`database url required for DB_TARGET=${target} — set it in .env`)

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
})

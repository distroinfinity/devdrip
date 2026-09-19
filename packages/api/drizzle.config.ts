import { defineConfig } from "drizzle-kit"
import "dotenv/config"

const url = process.env["DATABASE_URL_UNPOOLED"]
if (!url) throw new Error("DATABASE_URL_UNPOOLED is required — set it in .env or environment")

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
})

import { defineConfig } from "drizzle-kit"
import "dotenv/config"

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL_UNPOOLED"]!,
  },
  verbose: true,
  strict: true,
})

import { Command } from "commander"
import type { AdminUser } from "@devdrip/shared"
import { adminFetch, reportError } from "../../lib/admin-client.js"
import { printTable, printJson, shortId, formatDate, formatUsdc } from "../../lib/table.js"

export const userCmd: Command = new Command("user").description("manage users (read-only)")

userCmd
  .command("list")
  .description("list signed-up users with lifetime earnings")
  .option("--limit <n>", "max rows", "100")
  .option("--json", "emit json")
  .action(async (opts: { limit: string; json?: boolean }) => {
    try {
      const data = await adminFetch<{ users: AdminUser[]; total: number }>("/admin/users", {
        query: { limit: opts.limit },
      })
      if (opts.json) return printJson(data)
      printTable(data.users, [
        { header: "id", get: (r) => shortId(r.id) },
        { header: "github", get: (r) => r.githubLogin },
        { header: "email", get: (r) => r.email },
        { header: "wallet", get: (r) => (r.hasWallet ? "yes" : "no") },
        { header: "earnings", get: (r) => formatUsdc(r.lifetimeEarningsUsdc) },
        { header: "joined", get: (r) => formatDate(r.createdAt) },
      ])
      console.log(`\n${data.users.length} of ${data.total}`)
    } catch (err) {
      reportError(err)
    }
  })

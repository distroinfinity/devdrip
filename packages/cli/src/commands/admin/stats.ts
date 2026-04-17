import { Command } from "commander"
import type { AdminStats, AdminStatsBlock } from "@devdrip/shared"
import { adminFetch, reportError } from "../../lib/admin-client.js"
import { printTable, printJson, formatUsdc } from "../../lib/table.js"

type Row = AdminStatsBlock & { window: string }

export const statsCmd: Command = new Command("stats")
  .description("today + lifetime aggregates")
  .option("--json", "emit json")
  .action(async (opts: { json?: boolean }) => {
    try {
      const data = await adminFetch<AdminStats>("/admin/stats")
      if (opts.json) return printJson(data)
      const rows: Row[] = [
        { window: "today", ...data.today },
        { window: "lifetime", ...data.lifetime },
      ]
      printTable(rows, [
        { header: "window", get: (r) => r.window },
        { header: "impressions", get: (r) => r.impressionsCount },
        { header: "spend", get: (r) => formatUsdc(r.spendUsdc) },
        { header: "earnings", get: (r) => formatUsdc(r.earningsUsdc) },
        { header: "active campaigns", get: (r) => r.activeCampaignsCount },
      ])
    } catch (err) {
      reportError(err)
    }
  })

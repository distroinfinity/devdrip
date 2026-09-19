import { Command } from "commander"
import { adminFetch, reportError } from "../../lib/admin-client.js"
import { printTable, printJson, shortId, formatDate } from "../../lib/table.js"

interface Advertiser {
  id: string
  name: string
  contactEmail: string
  companyName: string | null
  createdAt: string
}

export const advertiserCmd: Command = new Command("advertiser").description("manage advertisers")

advertiserCmd
  .command("create")
  .description("create an advertiser")
  .requiredOption("--name <name>", "advertiser name")
  .requiredOption("--email <email>", "contact email")
  .option("--company <company>", "company name")
  .option("--json", "emit json")
  .action(async (opts: { name: string; email: string; company?: string; json?: boolean }) => {
    try {
      const { advertiser } = await adminFetch<{ advertiser: Advertiser }>("/advertisers", {
        method: "POST",
        body: {
          name: opts.name,
          contactEmail: opts.email,
          companyName: opts.company ?? null,
        },
      })
      if (opts.json) return printJson(advertiser)
      printTable(
        [advertiser],
        [
          { header: "id", get: (r) => r.id },
          { header: "name", get: (r) => r.name },
          { header: "email", get: (r) => r.contactEmail },
          { header: "company", get: (r) => r.companyName },
        ]
      )
    } catch (err) {
      reportError(err)
    }
  })

advertiserCmd
  .command("list")
  .description("list advertisers")
  .option("--limit <n>", "max rows", "100")
  .option("--json", "emit json")
  .action(async (opts: { limit: string; json?: boolean }) => {
    try {
      const data = await adminFetch<{ advertisers: Advertiser[]; total: number }>("/advertisers", {
        query: { limit: opts.limit },
      })
      if (opts.json) return printJson(data)
      printTable(data.advertisers, [
        { header: "id", get: (r) => shortId(r.id) },
        { header: "name", get: (r) => r.name },
        { header: "email", get: (r) => r.contactEmail },
        { header: "company", get: (r) => r.companyName },
        { header: "created", get: (r) => formatDate(r.createdAt) },
      ])
      console.log(`\n${data.advertisers.length} of ${data.total}`)
    } catch (err) {
      reportError(err)
    }
  })

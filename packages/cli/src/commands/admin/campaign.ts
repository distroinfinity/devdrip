import { Command } from "commander"
import { adminFetch, reportError } from "../../lib/admin-client.js"
import { printTable, printJson, shortId, formatDate, formatUsdc } from "../../lib/table.js"

interface Campaign {
  id: string
  advertiserId: string
  name: string
  budgetTotal: number
  budgetDaily: number
  budgetSpent: number
  cpmRate: number
  status: string
  startsAt: string | null
  endsAt: string | null
  createdAt: string
}

export const campaignCmd: Command = new Command("campaign").description("manage campaigns")

campaignCmd
  .command("create")
  .description("create a campaign")
  .requiredOption("--advertiser-id <id>", "advertiser uuid")
  .requiredOption("--name <name>", "campaign name")
  .requiredOption("--budget-total <n>", "total budget (usdc)")
  .requiredOption("--budget-daily <n>", "daily budget (usdc)")
  .requiredOption("--cpm <n>", "cpm rate (usdc)")
  .option("--categories <csv>", "comma-separated target categories", "")
  .option("--surfaces <csv>", "comma-separated target surfaces", "")
  .option("--pacing <strategy>", "even | front_loaded | asap", "even")
  .option("--starts-at <iso>", "start date (iso)")
  .option("--ends-at <iso>", "end date (iso)")
  .option("--json", "emit json")
  .action(
    async (opts: {
      advertiserId: string
      name: string
      budgetTotal: string
      budgetDaily: string
      cpm: string
      categories: string
      surfaces: string
      pacing: string
      startsAt?: string
      endsAt?: string
      json?: boolean
    }) => {
      try {
        const body = {
          advertiserId: opts.advertiserId,
          name: opts.name,
          budgetTotal: Number(opts.budgetTotal),
          budgetDaily: Number(opts.budgetDaily),
          cpmRate: Number(opts.cpm),
          targetCategories: opts.categories ? opts.categories.split(",").filter(Boolean) : [],
          targetSurfaces: opts.surfaces ? opts.surfaces.split(",").filter(Boolean) : [],
          pacingStrategy: opts.pacing,
          startsAt: opts.startsAt ?? null,
          endsAt: opts.endsAt ?? null,
        }
        const { campaign } = await adminFetch<{ campaign: Campaign }>("/campaigns", {
          method: "POST",
          body,
        })
        if (opts.json) return printJson(campaign)
        printTable(
          [campaign],
          [
            { header: "id", get: (r) => r.id },
            { header: "name", get: (r) => r.name },
            { header: "status", get: (r) => r.status },
            { header: "budget", get: (r) => formatUsdc(r.budgetTotal) },
            { header: "cpm", get: (r) => formatUsdc(r.cpmRate) },
          ]
        )
      } catch (err) {
        reportError(err)
      }
    }
  )

campaignCmd
  .command("list")
  .description("list campaigns")
  .option("--advertiser-id <id>", "filter by advertiser")
  .option("--status <status>", "filter by status (draft|active|paused|completed)")
  .option("--limit <n>", "max rows", "100")
  .option("--json", "emit json")
  .action(
    async (opts: { advertiserId?: string; status?: string; limit: string; json?: boolean }) => {
      try {
        const data = await adminFetch<{ campaigns: Campaign[]; total: number }>("/campaigns", {
          query: {
            advertiserId: opts.advertiserId,
            status: opts.status,
            limit: opts.limit,
          },
        })
        if (opts.json) return printJson(data)
        printTable(data.campaigns, [
          { header: "id", get: (r) => shortId(r.id) },
          { header: "name", get: (r) => r.name },
          { header: "status", get: (r) => r.status },
          {
            header: "spent/total",
            get: (r) => `${formatUsdc(r.budgetSpent)}/${formatUsdc(r.budgetTotal)}`,
          },
          { header: "cpm", get: (r) => formatUsdc(r.cpmRate) },
          { header: "starts", get: (r) => formatDate(r.startsAt) },
        ])
        console.log(`\n${data.campaigns.length} of ${data.total}`)
      } catch (err) {
        reportError(err)
      }
    }
  )

async function transition(id: string, status: "active" | "paused") {
  const { campaign } = await adminFetch<{ campaign: Campaign }>(`/campaigns/${id}/status`, {
    method: "PATCH",
    body: { status },
  })
  console.log(`${campaign.id} → ${campaign.status}`)
}

campaignCmd
  .command("pause <id>")
  .description("pause a campaign")
  .action(async (id: string) => {
    try {
      await transition(id, "paused")
    } catch (err) {
      reportError(err)
    }
  })

campaignCmd
  .command("resume <id>")
  .description("resume (activate) a campaign")
  .action(async (id: string) => {
    try {
      await transition(id, "active")
    } catch (err) {
      reportError(err)
    }
  })

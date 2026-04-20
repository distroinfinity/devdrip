import { Command } from "commander"
import { adminFetch, reportError } from "../../lib/admin-client.js"
import { printTable, printJson, shortId, formatUsdc } from "../../lib/table.js"

interface Creative {
  id: string
  campaignId: string
  headline: string
  body: string | null
  ctaText: string | null
  ctaUrl: string | null
  format: string
  surface: string
  category: string
  source: string
  cpmRate: number
  isActive: boolean
}

export const creativeCmd: Command = new Command("creative").description("manage creatives")

creativeCmd
  .command("create")
  .description("create a creative under a campaign")
  .requiredOption("--campaign-id <id>", "campaign uuid")
  .requiredOption("--headline <text>", "headline (≤60 chars)")
  .requiredOption("--format <format>", "text | banner | sponsored-link")
  .requiredOption("--surface <surface>", "terminal-tv | companion-tab | ...")
  .requiredOption("--category <cat>", "ad category slug")
  .requiredOption("--source <src>", "direct | carbon | ethicalads | ...")
  .requiredOption("--cpm <n>", "cpm rate (usdc)")
  .option("--body <text>", "body (≤140 chars)")
  .option("--cta-text <text>", "cta text (≤30 chars)")
  .option("--cta-url <url>", "cta url (https)")
  .option("--json", "emit json")
  .action(
    async (opts: {
      campaignId: string
      headline: string
      format: string
      surface: string
      category: string
      source: string
      cpm: string
      body?: string
      ctaText?: string
      ctaUrl?: string
      json?: boolean
    }) => {
      try {
        const { creative } = await adminFetch<{ creative: Creative }>(
          `/campaigns/${opts.campaignId}/creatives`,
          {
            method: "POST",
            body: {
              headline: opts.headline,
              body: opts.body ?? null,
              ctaText: opts.ctaText ?? null,
              ctaUrl: opts.ctaUrl ?? null,
              format: opts.format,
              surface: opts.surface,
              category: opts.category,
              source: opts.source,
              cpmRate: Number(opts.cpm),
            },
          }
        )
        if (opts.json) return printJson(creative)
        printTable(
          [creative],
          [
            { header: "id", get: (r) => r.id },
            { header: "headline", get: (r) => r.headline },
            { header: "format", get: (r) => r.format },
            { header: "surface", get: (r) => r.surface },
          ]
        )
      } catch (err) {
        reportError(err)
      }
    }
  )

creativeCmd
  .command("list")
  .description("list creatives for a campaign")
  .requiredOption("--campaign-id <id>", "campaign uuid")
  .option("--limit <n>", "max rows", "100")
  .option("--json", "emit json")
  .action(async (opts: { campaignId: string; limit: string; json?: boolean }) => {
    try {
      const data = await adminFetch<{ creatives: Creative[]; total: number }>(
        `/campaigns/${opts.campaignId}/creatives`,
        { query: { limit: opts.limit } }
      )
      if (opts.json) return printJson(data)
      printTable(data.creatives, [
        { header: "id", get: (r) => shortId(r.id) },
        { header: "headline", get: (r) => r.headline },
        { header: "format", get: (r) => r.format },
        { header: "surface", get: (r) => r.surface },
        { header: "source", get: (r) => r.source },
        { header: "cpm", get: (r) => formatUsdc(r.cpmRate) },
        { header: "active", get: (r) => (r.isActive ? "yes" : "no") },
      ])
      console.log(`\n${data.creatives.length} of ${data.total}`)
    } catch (err) {
      reportError(err)
    }
  })

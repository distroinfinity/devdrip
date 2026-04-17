import { Command } from "commander"
import type { InviteCode } from "@devdrip/shared"
import { adminFetch, reportError } from "../../lib/admin-client.js"
import { printJson } from "../../lib/table.js"

export const inviteCmd: Command = new Command("invite").description("manage invite codes")

inviteCmd
  .command("generate")
  .description("generate N invite codes (1..100)")
  .requiredOption("--count <n>", "number of codes to generate")
  .option("--json", "emit json")
  .action(async (opts: { count: string; json?: boolean }) => {
    try {
      const { invites } = await adminFetch<{ invites: InviteCode[] }>("/invites", {
        method: "POST",
        body: { count: Number(opts.count) },
      })
      if (opts.json) return printJson(invites)
      for (const inv of invites) console.log(inv.code)
    } catch (err) {
      reportError(err)
    }
  })

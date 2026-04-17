import { Command } from "commander"
import { adminFetch, reportError } from "../../lib/admin-client.js"
import { printTable, printJson, shortId, formatDate, formatUsdc } from "../../lib/table.js"

interface Payout {
  id: string
  userId: string
  amountUsdc: number
  walletAddress: string
  txHash: string | null
  status: string
  failureReason: string | null
  createdAt: string
  confirmedAt: string | null
}

export const payoutCmd: Command = new Command("payouts").description("manage payouts")

payoutCmd
  .command("list")
  .description("list payouts")
  .option("--status <status>", "pending | processing | confirmed | failed")
  .option("--limit <n>", "max rows", "100")
  .option("--json", "emit json")
  .action(async (opts: { status?: string; limit: string; json?: boolean }) => {
    try {
      const data = await adminFetch<{ payouts: Payout[]; total: number }>("/admin/payouts", {
        query: { status: opts.status, limit: opts.limit },
      })
      if (opts.json) return printJson(data)
      printTable(data.payouts, [
        { header: "id", get: (r) => shortId(r.id) },
        { header: "user", get: (r) => shortId(r.userId) },
        { header: "amount", get: (r) => formatUsdc(r.amountUsdc) },
        { header: "status", get: (r) => r.status },
        { header: "tx", get: (r) => (r.txHash ? r.txHash.slice(0, 14) + "…" : null) },
        { header: "created", get: (r) => formatDate(r.createdAt) },
      ])
      console.log(`\n${data.payouts.length} of ${data.total}`)
    } catch (err) {
      reportError(err)
    }
  })

payoutCmd
  .command("set-status <id>")
  .description("manually override a payout status (confirmed | failed)")
  .requiredOption("--status <status>", "confirmed | failed")
  .option("--tx-hash <hash>", "required when status=confirmed")
  .option("--failure-reason <text>", "optional when status=failed")
  .action(async (id: string, opts: { status: string; txHash?: string; failureReason?: string }) => {
    try {
      const { payout } = await adminFetch<{ payout: Payout }>(`/admin/payouts/${id}/status`, {
        method: "PATCH",
        body: {
          status: opts.status,
          txHash: opts.txHash ?? null,
          failureReason: opts.failureReason ?? null,
        },
      })
      console.log(`${payout.id} → ${payout.status}`)
    } catch (err) {
      reportError(err)
    }
  })

import { randomUUID } from "node:crypto"
import { Command } from "commander"
import { confirm } from "@clack/prompts"
import { MIN_PAYOUT_USDC, formatUsdc, worldscanTxUrl } from "@distrotv/shared"
import { apiFetch, NotAuthenticatedError, reportError } from "../lib/api-client.js"

interface Balance {
  availableUsdc: number
  lifetimeEarnedUsdc: number
  pendingPayoutsUsdc: number
}

interface ClaimResp {
  id: string
  status: string
  amount_usdc: number
  wallet_address: string
}

interface PayoutDetail {
  id: string
  status: "pending" | "processing" | "confirmed" | "failed"
  amountUsdc: number
  walletAddress: string
  txHash: string | null
  txBlockNumber: number | null
  failureReason: string | null
  createdAt: string
  confirmedAt: string | null
}

const POLL_INTERVAL_MS = 3_000
const POLL_BUDGET_MS = 90 * 1000

export const claimCmd = new Command("claim")
  .description("request a USDC payout to your World Wallet")
  .option("-y, --yes", "skip confirm prompt")
  .action(async (opts: { yes?: boolean }) => {
    try {
      await runClaim(opts.yes === true)
    } catch (err) {
      reportError(err)
    }
  })

async function runClaim(skipConfirm: boolean): Promise<void> {
  let balance: Balance
  try {
    balance = await apiFetch<Balance>("/me/balance")
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      console.error("not signed in. run `distro login` first.")
      process.exit(1)
    }
    throw err
  }

  if (balance.availableUsdc < MIN_PAYOUT_USDC) {
    console.error(
      `need ≥ ${formatUsdc(MIN_PAYOUT_USDC)} to claim, you have ${formatUsdc(balance.availableUsdc)}`
    )
    process.exit(1)
  }

  if (!skipConfirm) {
    const proceed = await confirm({
      message: `claim ${formatUsdc(balance.availableUsdc)} USDC?`,
    })
    if (proceed !== true) {
      console.log("cancelled")
      return
    }
  }

  const idempotencyKey = randomUUID()
  let claim: ClaimResp
  try {
    claim = await apiFetch<ClaimResp>("/me/payouts/claim", {
      method: "POST",
      body: {},
      headers: { "Idempotency-Key": idempotencyKey },
    })
  } catch (err) {
    reportError(err)
    process.exit(1)
  }

  console.log(`claim submitted: ${formatUsdc(claim.amount_usdc)} → ${claim.wallet_address}`)
  console.log(`payout id: ${claim.id}`)
  console.log("waiting for on-chain confirmation…")

  const startedAt = Date.now()
  while (Date.now() - startedAt < POLL_BUDGET_MS) {
    const detail = await apiFetch<PayoutDetail>(`/me/payouts/${claim.id}`)
    if (detail.status === "confirmed") {
      console.log("✓ confirmed")
      if (detail.txHash) {
        const url = worldscanTxUrl(detail.txHash)
        if (url) console.log(`  ${url}`)
      }
      return
    }
    if (detail.status === "failed") {
      console.error(`✗ failed: ${detail.failureReason ?? "unknown"}`)
      process.exit(1)
    }
    process.stdout.write(`  ${detail.status}…\r`)
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }

  console.log("\npolling timed out. check `distro status` later for the final state.")
}

// Per-payout broadcast pipeline. Called by the settlement worker for one
// payout at a time. Performs: pre-flight balance checks → sign + broadcast
// transfer → wait for receipt → mark confirmed/failed/retry.
//
// Retry semantics: on broadcast or receipt timeout, set status back to
// 'pending' and bump retry_count. The worker's next tick re-picks the row.
// After MAX_RETRIES failures, mark permanently failed.

import { eq, sql } from "drizzle-orm"
import type { Logger } from "pino"
import { parseUnits, type Hex } from "viem"
import type { PayoutFailureReason } from "@devdrip/shared"
import { USDC_DECIMALS } from "@devdrip/shared"
import { getDb } from "../db/index.js"
import { payouts } from "../db/schema/payouts.js"
import { env } from "../config/env.js"
import { getPublicClient, getWalletClient, WORLD_CHAIN_SEPOLIA, usdcAbi } from "../chain/index.js"
import { logger } from "../lib/logger.js"

const RECEIPT_TIMEOUT_MS = 30_000
const MAX_RETRIES = 3

export interface PendingPayout {
  id: string
  userId: string
  walletAddress: string
  amountUsdc: number
  retryCount: number
}

export async function broadcastPayout(row: PendingPayout): Promise<void> {
  const log = logger.child({ payoutId: row.id, retryCount: row.retryCount })
  const publicClient = getPublicClient()
  const walletClient = getWalletClient()

  const hotWallet = env.hotWalletAddress as `0x${string}`
  const recipient = row.walletAddress as `0x${string}`
  const amountUnits = parseUnits(row.amountUsdc.toString(), USDC_DECIMALS)

  // Pre-flight: USDC balance FIRST — gas estimation simulates the transfer
  // and would revert with "ERC20: transfer amount exceeds balance" if USDC is
  // short, which we'd otherwise mis-classify as a transient gas-estimation
  // error and retry 3× before failing with the wrong reason. Checking balance
  // first means insufficient_funds surfaces immediately and gas estimation
  // only fails for genuine RPC/contract-level issues.
  const usdcBalance = (await publicClient.readContract({
    address: WORLD_CHAIN_SEPOLIA.usdcAddress,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [hotWallet],
  })) as bigint
  if (usdcBalance < amountUnits) {
    await markFailed(row.id, "insufficient_funds", log)
    return
  }

  // Pre-flight: gas estimate + ETH balance
  let gasEstimate: bigint
  let gasPrice: bigint
  try {
    ;[gasEstimate, gasPrice] = await Promise.all([
      publicClient.estimateContractGas({
        address: WORLD_CHAIN_SEPOLIA.usdcAddress,
        abi: usdcAbi,
        functionName: "transfer",
        args: [recipient, amountUnits],
        account: hotWallet,
      }),
      publicClient.getGasPrice(),
    ])
  } catch (err) {
    log.error({ err }, "gas estimation failed; treating as transient retry")
    await retryOrFail(row, "broadcast_timeout_after_3_retries", log)
    return
  }

  const ethBalance = await publicClient.getBalance({ address: hotWallet })
  if (ethBalance < gasEstimate * gasPrice) {
    await markFailed(row.id, "insufficient_gas", log)
    return
  }

  // Bump gas by 20% per prior retry — handles network congestion + replacement.
  const gasMultiplierBps = 100n + 20n * BigInt(row.retryCount)
  const gasWithBump = (gasEstimate * gasMultiplierBps) / 100n

  let txHash: Hex
  try {
    txHash = await walletClient.writeContract({
      address: WORLD_CHAIN_SEPOLIA.usdcAddress,
      abi: usdcAbi,
      functionName: "transfer",
      args: [recipient, amountUnits],
      gas: gasWithBump,
      // viem v2 requires `chain` to be explicit even when the wallet client
      // already has it bound; null means "use the client's chain".
      chain: null,
      account: walletClient.account ?? null,
    })
  } catch (err) {
    log.warn({ err }, "broadcast failed; will retry")
    await retryOrFail(row, "broadcast_timeout_after_3_retries", log)
    return
  }

  // Stash the tx hash + retry timestamp so an admin can correlate even if the
  // receipt poll later crashes the worker.
  const db = getDb()
  await db
    .update(payouts)
    .set({ txHash, lastRetryAt: new Date(), updatedAt: sql`now()` })
    .where(eq(payouts.id, row.id))

  // Wait for receipt
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: RECEIPT_TIMEOUT_MS,
    })
    if (receipt.status === "success") {
      await db
        .update(payouts)
        .set({
          status: "confirmed",
          txBlockNumber: Number(receipt.blockNumber),
          confirmedAt: new Date(),
          updatedAt: sql`now()`,
        })
        .where(eq(payouts.id, row.id))
      log.info({ txHash, blockNumber: Number(receipt.blockNumber) }, "payout confirmed")
      return
    }
    const reason = `reverted: tx ${txHash} status=0x0`
    await markFailed(row.id, reason as PayoutFailureReason, log)
  } catch (err) {
    log.warn({ err, txHash }, "receipt wait timed out; will retry")
    await retryOrFail(row, "broadcast_timeout_after_3_retries", log)
  }
}

async function markFailed(
  payoutId: string,
  reason: PayoutFailureReason,
  log: Logger
): Promise<void> {
  const db = getDb()
  await db
    .update(payouts)
    .set({ status: "failed", failureReason: reason, updatedAt: sql`now()` })
    .where(eq(payouts.id, payoutId))
  log.warn({ reason }, "payout failed")
}

async function retryOrFail(
  row: PendingPayout,
  terminalReason: PayoutFailureReason,
  log: Logger
): Promise<void> {
  const nextRetry = row.retryCount + 1
  const db = getDb()
  if (nextRetry >= MAX_RETRIES) {
    await db
      .update(payouts)
      .set({
        status: "failed",
        failureReason: terminalReason,
        retryCount: nextRetry,
        lastRetryAt: new Date(),
        updatedAt: sql`now()`,
      })
      .where(eq(payouts.id, row.id))
    log.warn({ retryCount: nextRetry, reason: terminalReason }, "payout permanently failed")
    return
  }
  await db
    .update(payouts)
    .set({
      status: "pending",
      retryCount: nextRetry,
      lastRetryAt: new Date(),
      updatedAt: sql`now()`,
    })
    .where(eq(payouts.id, row.id))
  log.info({ retryCount: nextRetry }, "payout requeued for retry")
}

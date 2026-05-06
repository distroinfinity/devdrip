// Per-payout broadcast pipeline. Called by the settlement worker for one
// payout at a time.
//
// Two paths:
//   (A) row.txHash IS NULL — fresh broadcast: pre-flight checks → sign + send
//       → wait for receipt → mark confirmed/failed/retry.
//   (B) row.txHash IS NOT NULL — reconciliation only: a previous attempt
//       already broadcast a tx for this payout. Poll for the receipt; NEVER
//       sign a second tx. This is the safe-money invariant — once a tx hash
//       exists for a payout we either confirm it, see it revert on-chain, or
//       fail permanently after retries — but we never duplicate the send.
//
// If a tx is genuinely dropped from the mempool the row will exhaust retries
// and land in `failed` with `broadcast_timeout_after_3_retries`. Operator
// recovery: NULL out tx_hash + reset status to 'pending' to allow a fresh
// broadcast.

import { eq, sql } from "drizzle-orm"
import type { Logger } from "pino"
import { parseUnits, type Hex } from "viem"
import type { PayoutFailureReason } from "@distrotv/shared"
import { USDC_DECIMALS } from "@distrotv/shared"
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
  // Set when a previous broadcast attempt got far enough to obtain a tx hash.
  // Presence forces the reconciliation-only path so we never double-send.
  txHash: Hex | null
}

export async function broadcastPayout(row: PendingPayout): Promise<void> {
  const log = logger.child({ payoutId: row.id, retryCount: row.retryCount })

  // Path B — reconciliation only. Never sign a second tx for this payout.
  if (row.txHash) {
    await reconcileExistingTx(row, log)
    return
  }

  // Path A — fresh broadcast.
  await freshBroadcast(row, log)
}

async function reconcileExistingTx(row: PendingPayout, log: Logger): Promise<void> {
  const txHash = row.txHash
  if (!txHash) return
  log.info({ txHash }, "reconciling existing tx; not broadcasting")
  const publicClient = getPublicClient()
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: RECEIPT_TIMEOUT_MS,
    })
    if (receipt.status === "success") {
      await markConfirmed(row.id, txHash, Number(receipt.blockNumber), log)
      return
    }
    // Reverted on-chain — deterministic with the same args. Don't retry.
    const reason = `reverted: tx ${txHash} status=0x0`
    await markFailed(row.id, reason as PayoutFailureReason, log)
  } catch (err) {
    // Receipt unavailable — tx may still be in mempool, may be dropped. Bump
    // the retry count (or fail permanently after MAX_RETRIES) but DO NOT
    // broadcast a new tx. Operator recovery: NULL the tx_hash to allow a
    // fresh broadcast.
    log.warn({ err, txHash }, "reconcile receipt unavailable; bumping retry without broadcast")
    await retryOrFail(row, "broadcast_timeout_after_3_retries", log)
  }
}

async function freshBroadcast(row: PendingPayout, log: Logger): Promise<void> {
  const publicClient = getPublicClient()
  const walletClient = getWalletClient()

  const hotWallet = env.hotWalletAddress as `0x${string}`
  const recipient = row.walletAddress as `0x${string}`
  const amountUnits = parseUnits(row.amountUsdc.toString(), USDC_DECIMALS)

  // Pre-flight: USDC balance FIRST — gas estimation simulates the transfer
  // and would revert with "ERC20: transfer amount exceeds balance" if USDC is
  // short, which we'd otherwise mis-classify as a transient gas-estimation
  // error and retry 3× before failing with the wrong reason.
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

  // Stash the tx hash IMMEDIATELY so the next worker tick (or any retry path)
  // sees this attempt and switches to reconciliation-only mode.
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
      await markConfirmed(row.id, txHash, Number(receipt.blockNumber), log)
      return
    }
    const reason = `reverted: tx ${txHash} status=0x0`
    await markFailed(row.id, reason as PayoutFailureReason, log)
  } catch (err) {
    log.warn(
      { err, txHash },
      "receipt wait timed out; will retry (no re-broadcast — tx_hash already set)"
    )
    await retryOrFail(row, "broadcast_timeout_after_3_retries", log)
  }
}

async function markConfirmed(
  payoutId: string,
  txHash: Hex,
  blockNumber: number,
  log: Logger
): Promise<void> {
  const db = getDb()
  await db
    .update(payouts)
    .set({
      status: "confirmed",
      txBlockNumber: blockNumber,
      confirmedAt: new Date(),
      updatedAt: sql`now()`,
    })
    .where(eq(payouts.id, payoutId))
  log.info({ txHash, blockNumber }, "payout confirmed")
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

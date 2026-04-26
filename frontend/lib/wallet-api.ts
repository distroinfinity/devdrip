// Shared between Mini App pages and the dashboard /wallet page.
// Mini App calls these from server components via /api/me/* (rewritten to backend
// preserving the dd_miniapp cookie scope). Dashboard calls them via the existing
// /me/* path with the dashboard's Bearer cookie. Both paths reach the same backend
// endpoints; the same-origin rewrite is handled by next.config.mjs for /api/me/*.

export interface Balance {
  availableUsdc: number
  lifetimeEarnedUsdc: number
  pendingPayoutsUsdc: number
}

export interface PayoutSummary {
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

export interface PayoutListResult {
  items: PayoutSummary[]
  nextCursor: string | null
}

export interface ClaimResponse {
  id: string
  status: string
  amount_usdc: number
  wallet_address: string
}

export async function fetchPayout(id: string): Promise<PayoutSummary> {
  const r = await fetch(`/api/me/payouts/${id}`, { credentials: "include", cache: "no-store" })
  if (!r.ok) throw new Error(`payout_${r.status}`)
  return (await r.json()) as PayoutSummary
}

export async function claim(idempotencyKey: string): Promise<ClaimResponse> {
  const r = await fetch("/api/me/payouts/claim", {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: "{}",
  })
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `claim_${r.status}`)
  }
  return (await r.json()) as ClaimResponse
}

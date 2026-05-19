# World Chain stack

> **Status: superseded.** This page documents the World Chain Sepolia on-chain payout stack (USDC hot-wallet, settlement worker, auto-disburse cron). The entire chain integration — and the subsequent agent-treasury pivot that aimed to replace it — were both abandoned in May 2026 when the product became Distro TV, an ambient channel surface with no on-chain payments. See [Architecture Overview](overview.md) for current state. Kept for historical reference only.

DevDrip's payout side runs on **World Chain Sepolia** (chainId `4801`). USDC is the bridged Circle contract at `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88` (6 decimals).

This page is the operational runbook. PR1 laid the foundation (chain config, viem clients, schema), PR2 added the API endpoints (claim, balance, payouts list), PR3 lit up the settlement worker + auto-disburse cron + hot wallet ops.

## Components

- `packages/api/src/chain/` — viem clients, USDC ABI, World Chain Sepolia config
- `packages/api/src/scripts/check-hot-wallet.ts` — `pnpm --filter @devdrip/api chain:check` smoke test
- `packages/api/src/worker.ts` — worker process entry (separate Railway service from the API)
- `packages/api/src/workers/settlement.ts` — settlement loop, every 30s
- `packages/api/src/workers/auto-disburse.ts` — auto-disburse cron, Sun 00:00 UTC
- `packages/api/src/services/payout-broadcast.service.ts` — pre-flight checks + sign + broadcast + receipt poll + retry
- `packages/api/src/routes/admin-hot-wallet.ts` — `GET /admin/hot-wallet/balance`
- `packages/shared/src/{types,constants}/chain.ts` — types + constants used across api/cli/frontend

## Process model

The API and the worker are **two separate Node processes** sharing the same database. Local dev needs both running — open two terminals:

- terminal 1: `pnpm --filter @devdrip/api dev` (Express API on port 3001)
- terminal 2: `pnpm --filter @devdrip/api worker:dev` (worker, no port)

Production: each is a Railway service. The worker service has `start: node dist/worker.js` and shares the API's env vars.

## Settlement loop

Every 30 seconds, the worker:

1. `BEGIN; SELECT … FOR UPDATE SKIP LOCKED LIMIT 1` over `payouts` rows that are either `pending` OR `processing` and older than 5 minutes (crash-recovery fallback). Ordered by `(created_at, id)`. Marks the row `processing` inside the same transaction. Lock window is short (just the SELECT+UPDATE) — broadcast happens after commit.
2. Pre-flight: estimate gas, read hot wallet ETH balance + USDC balance. If short → mark `failed` with `insufficient_gas` or `insufficient_funds` (no broadcast attempted).
3. Sign + broadcast `transfer(to, amount)` via viem `walletClient.writeContract`. Gas multiplier is `1 + 0.2 × retry_count` so retries replace the prior tx with a higher fee.
4. Wait up to 30s for receipt via `waitForTransactionReceipt({ timeout: 30_000 })`.
   - On `status='success'` → `confirmed` + `tx_block_number` + `confirmed_at`
   - On `status='reverted'` → `failed` with `reverted: …`
   - On timeout → `pending` again, `retry_count++`. After 3 retries, `failed` with `broadcast_timeout_after_3_retries`.

The worker drains: it keeps processing payouts back-to-back until `claimNextPending` returns null, then waits for the next 30s tick.

## Auto-disburse cron

`node-cron` schedule `0 0 * * 0` UTC. Computes `confirmed earnings - (paid + pending payouts)` per user, inserts one `pending` payout per user with balance ≥ `MIN_AUTO_DISBURSE_USDC` ($5). The `(user_id, scheduled_for_week)` UNIQUE constraint guarantees only one row per user per ISO week — re-running the cron within the same week is a no-op.

Manual trigger for testing: `pnpm --filter @devdrip/api worker:once-disburse` runs the SQL once and exits.

## Hot wallet (testnet)

- Stored as `HOT_WALLET_PRIVATE_KEY` env var in Railway secret. Public address mirrored as `HOT_WALLET_ADDRESS` for read-only ops endpoints.
- Float kept low: ≤ $50 USDC and ≤ 0.01 ETH. Leak is recoverable on testnet — drain and rotate.
- Faucets: World Chain Sepolia ETH faucet + Sepolia → World Chain bridge for USDC.
- Health check (admin): `GET /admin/hot-wallet/balance` with header `x-admin-secret: $ADMIN_SECRET`.
- Smoke check (CLI): `pnpm --filter @devdrip/api chain:check` prints address + balances; warns if ETH < 0.001 or USDC < $5.
- Production hardening (KMS / Turnkey) is a Phase 2 ticket.

## Alerts (manual until automated)

Until alerting is wired (Phase 2), check the hot wallet daily:

```bash
curl -s https://api.devdrip.app/admin/hot-wallet/balance \
  -H "x-admin-secret: $ADMIN_SECRET" | jq
```

Trigger refill if `ethFormatted < 0.001` or `usdcFormatted < 5`.

## Refill procedure (testnet)

1. ETH: visit https://www.alchemy.com/faucets/world-chain-sepolia (or current World Chain Sepolia ETH faucet) with the hot wallet address.
2. USDC: bridge from Sepolia (Sepolia → World Chain Sepolia bridge UI) — or use a testnet USDC faucet if one is configured. Target $20 per refill so the float stays bounded.
3. Confirm via `chain:check`.

## Drain procedure (key rotation or compromise)

1. Generate a new private key locally (e.g., `viem.generatePrivateKey()`).
2. From the OLD key (using ethers / viem CLI), `transfer` all ETH and all USDC to the new address. Keep some ETH for the gas of the USDC transfer.
3. Update `HOT_WALLET_PRIVATE_KEY` and `HOT_WALLET_ADDRESS` in Railway. Restart both API and worker services.
4. Confirm via `chain:check` that the new wallet shows the moved balances.

## Mainnet (Phase 2)

Chain `480`, native Circle USDC, real money. Out of scope for this epic. Production hot-wallet hardening (KMS / Turnkey) lands in the same Phase 2 ticket.

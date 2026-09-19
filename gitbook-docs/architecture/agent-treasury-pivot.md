# Agent Treasury Pivot

> **Status: superseded.** This page documents an intermediate pivot direction (agent-treasury / KeeperHub / Uniswap on Base Sepolia) that was itself superseded in May 2026 when the product pivoted to Distro TV — an ambient channel surface with no on-chain payments. See [Architecture Overview](overview.md) for current state. Kept for historical reference only.

DevDrip was pivoting away from a World ID + World Chain payout flow toward an **agent-treasury** model on **Base Sepolia** powered by KeeperHub and Uniswap. This page is the engineering-facing summary of the direction. The full design lives in the local-only spec at `docs/superpowers/specs/2026-04-30-agent-treasury-pivot-design.md`.

The pivot is being implemented on the `pivot/agent-treasury` branch. World code is preserved on `archive/world-integration` and stripped from main as part of the pivot.

## What changes

| Area                 | Before                                                    | After                                                                                       |
| -------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Chain                | World Chain Sepolia (`4801`)                              | Base Sepolia (`84532`) only                                                                 |
| Identity             | World ID + GitHub + walletAuth (3 credentials)            | Privy (email or external wallet); GitHub still optional                                     |
| Payout flow          | Hot wallet broadcasts USDC `transfer` via internal worker | KeeperHub workflow executes Uniswap swap via Universal Router; Turnkey-managed wallet signs |
| Sign-up surface      | Mini App at `/m/*` (World App webview)                    | Standard dashboard auth at `/dashboard` (no mini app)                                       |
| Earnings destination | User's World wallet                                       | User's external wallet via vault rule                                                       |
| New primitive        | n/a                                                       | **Vault rule**: a KeeperHub workflow whose execute step is a Uniswap swap                   |
| New surface          | n/a                                                       | `@devdrip/mcp` — agent-callable tools (swap, vault create, fills)                           |

## Channel modes

`earn` (ads) and `learn` (news) stay. **`trade` is added**: chart sparkline + vault status + recent fills. `mix` rotates all three.

## New packages

- `packages/keeperhub` — REST client + workflow templates (`cron-swap`, `conditional-swap`, `manual-swap`). x402 helper for KH-billed calls.
- `packages/uniswap` — Trading API client. `checkApproval`, `quote`, `swap`. Permit2 max-approval helper. Single chain (`84532`).
- `packages/mcp` — npm package `@devdrip/mcp`. 8 tools, API-key auth, `npx -y @devdrip/mcp` install.

## New API routes

- `POST /api/vault-rules` — create
- `GET  /api/vault-rules` — list
- `DELETE /api/vault-rules/:id` — cancel (also deletes KH workflow)
- `POST /api/vault-rules/:id/execute` — manual fire
- `POST /api/swap-prepare` — internal endpoint called by KH workflow mid-execution to fetch fresh Uniswap quote + calldata (shared-secret auth)
- `POST /api/swap-execute` — one-shot swap (no recurring rule)
- `POST /api/keeperhub-webhook` — receives execution status updates, mirrors to `vault_fills`

## New tables

- `vault_rules` — `id, user_id, type ('cron'|'conditional'|'manual'), schedule, condition, swap_config, dest_address, status, kh_workflow_id, created_at`
- `vault_fills` — `id, vault_rule_id, kh_execution_id, quote_input_amount, quote_output_amount, executed_amount_in, executed_amount_out, tx_hash, status, audit_url, fired_at, completed_at`
- `wallet_connections` — `id, user_id (Privy id), wallet_address, wallet_type, is_vault_wallet, created_at`
- `keeperhub_links` — `id, user_id, kh_project_id, kh_turnkey_wallet_address, api_key_encrypted, created_at`

## Removed surface

- All `frontend/app/m/*` pages and the World App entrypoint
- `frontend/components/landing/worldwide-section.tsx`
- `packages/api/src/routes/miniapp-*.ts` and `admin-hot-wallet.ts`
- `packages/api/src/services/world-id.service.ts`, `walletauth.service.ts`, `miniapp-*.service.ts`
- `packages/api/src/services/payout-broadcast.service.ts` and `workers/settlement.ts` (KeeperHub now owns broadcast and retry)
- `packages/api/src/db/schema/nullifiers.ts` and World ID columns on `users` / `payouts`
- `packages/shared/src/constants/chain.ts` World Chain entries

`packages/api/src/services/cli-pair.service.ts` is **kept** — generic CLI↔account pairing, not World-specific.

## Why this primitive is judge-legible

A KeeperHub workflow with two nodes — (1) HTTP-request to our `/api/swap-prepare` for a fresh Uniswap quote, (2) `execute_contract_call` on Universal Router with that calldata — is a single load-bearing primitive that lights up depth in **both** sponsor tracks. No bolt-on integrations. The same primitive backs both manual swaps (`swap_now`) and recurring vaults (cron) and conditional vaults.

## Quote staleness, signing, and Permit2

- Cron-fired swaps re-fetch a fresh Uniswap quote at trigger time (HTTP-request node hits our `/swap-prepare`). Quotes are valid ~60s — by the time the execute node runs, the quote is fresh.
- Per-trade user signatures are eliminated: at vault-create time the user does a **one-time max Permit2 approval** to Universal Router from their vault wallet. The Turnkey-managed wallet signs subsequent execute calls.
- Audit trail: KeeperHub is the source of truth for executions; we mirror each completed execution into `vault_fills` so the dashboard reads stay snappy and survive KH downtime.

## Out of scope

- Mainnet (Base, Unichain, Ethereum). Base Sepolia only, no flip path.
- World ID, Worldchain, World Wallet. All archived.
- Multi-chain support.
- Generic onchain-ops dashboard. Vault rules + swap fills only — that's the scope.
- Migration of existing payout records. Old payouts stay where they are; new flow applies forward.

## Cut order if timeline slips

1. Drop `/dashboard/swap` (one-shot manual UI)
2. Drop conditional vaults (cron only)
3. Drop CLI swap command
4. Keep dashboard cron vaults + MCP `swap_now` + `create_recurring_vault` — that's the irreducible demo

# World Chain stack

DevDrip's payout side runs on **World Chain Sepolia** (chainId `4801`). USDC is the bridged Circle contract at `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88` (6 decimals).

This page is a living runbook. PR1 lays the foundation; PR2 adds endpoints; PR3 lights up the settlement worker; PR4 wires the user-facing surfaces.

## Components

- `packages/api/src/chain/` — viem clients, USDC ABI, World Chain Sepolia config
- `packages/api/src/scripts/check-hot-wallet.ts` — `pnpm --filter @devdrip/api chain:check` smoke test
- `packages/shared/src/{types,constants}/chain.ts` — types + constants used across api/cli/frontend
- (PR3) `packages/api/src/worker.ts` + `workers/settlement.ts` + `workers/auto-disburse.ts`
- (PR2) Mini App auth at `routes/miniapp-*` + CLI pairing at `routes/cli-pair.ts`

## Hot wallet (testnet)

- Stored as `HOT_WALLET_PRIVATE_KEY` env var in Railway secret. Public address mirrored as `HOT_WALLET_ADDRESS` for read-only ops endpoints.
- Float kept low: ≤ $50 USDC and ≤ 0.01 ETH. Leak is recoverable on testnet — drain and rotate.
- Faucets: World Chain Sepolia ETH faucet + Sepolia → World Chain bridge for USDC.
- Health check: `pnpm --filter @devdrip/api chain:check` prints address + balances; warns if ETH < 0.001 or USDC < $5.
- Production hardening (KMS / Turnkey) is a Phase 2 ticket.

## Mainnet (Phase 2)

Chain `480`, native Circle USDC, real money. Out of scope for this epic.

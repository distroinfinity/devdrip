# Onchain LP Guard

`CH 03 ONCHAIN — LP GUARD` is the third Distro TV channel (mode `onchain_only`). While you code, the terminal renders your Uniswap v4 LP position; a v4 hook protects the LP on-chain with a volatility- and size-aware dynamic fee; a range breach fires a terminal alert; you act with a one-click CLI subcommand. It is **independent of the news/markets pipeline** — its own contracts, viem read client, worker tick, and selection path.

**Advisor model.** The hook sets the fee and emits state. The human acts. No autonomy, no hook-owned liquidity — the hook never holds or moves LP funds; it only reads pool flow and overrides the swap fee.

Live on **X Layer testnet, chainId 1952** (Alchemy RPC). The canonical CREATE2 proxy `0x4e59b448…` is present, so the deterministic hook-address mine works. No official Uniswap v4 deployment was relied on — the deploy script self-deploys a PoolManager + v4-core test routers.

## The hook

`DistroGuardHook` — `packages/contracts/src/DistroGuardHook.sol`. Built on **v4-core 1.0.2**. v4-periphery 1.0.4 ships no `BaseHook`/`HookMiner`, so the hook extends v4-core's `src/test/BaseTestHooks.sol` and `HookMiner` is vendored at `packages/contracts/script/HookMiner.sol`. v4-core, v4-periphery, and forge-std are vendored under `packages/contracts/lib/`.

**Why a hook is unavoidable.** v3 exposed only static fee tiers. Per-swap, state-driven fees are a v4-only capability — the dynamic-fee flag plus the `beforeSwap` fee override is the mechanism that does not exist in v3.

### Hook points

Permissions: `afterInitialize` + `beforeSwap` + `afterSwap`. The hook address is CREATE2-mined so its low 14 bits encode exactly those three flags (Uniswap derives hook permissions from the deployed address, hence the mine).

- **`afterInitialize`** — asserts `key.fee == LPFeeLibrary.DYNAMIC_FEE_FLAG` (the pool must be a dynamic-fee pool), seeds `VolState` with the initial tick.
- **`beforeSwap`** — computes the fee and returns `fee | OVERRIDE_FEE_FLAG`, overriding the pool's LP fee for this swap. Emits `FeeApplied(poolId, feePips)`.
- **`afterSwap`** — reads the post-swap tick via `StateLibrary.getSlot0`, folds `|tickΔ|` into the per-pool EWMA, stores `lastTick`, emits `VolUpdated(poolId, tick, ewmaVolBps)`.

### Fee formula

Fees are in **pips** (1e-6), so the clamp band is **0.30%–1.00%**:

```
fee = clamp(BASE_FEE + VOL_K × ewmaVolBps + SIZE_K × sizeUnit, BASE_FEE, MAX_FEE)

BASE_FEE = 3000   (0.30%)
MAX_FEE  = 10000  (1.00%)
VOL_K    = 50
SIZE_K   = 20
sizeUnit = absAmountSpecified > 1e21 ? absAmountSpecified / 1e21 : 0
```

Volatility pushes the fee up; large swaps (`> 1e21` absolute amount) add a size premium. Both terms are saturated at `MAX_FEE`.

### EWMA volatility

State is `mapping(PoolId => VolState{ int24 lastTick; uint32 ewmaVolBps; bool seeded })`, exposed by the public getter `volOf`. Each `afterSwap`:

```
delta  = tick - lastTick
absBps = |delta|
ewmaVolBps = (ewmaVolBps × 3 + absBps) / 4   // alpha = 1/4
lastTick   = tick
```

The EWMA is the running signal the off-chain side reads for display and breach context.

## Self-deploy + addresses

`packages/contracts` is a Foundry project. `script/Deploy.s.sol`:

1. Self-deploys `PoolManager` + `PoolModifyLiquidityTest` + `PoolSwapTest` (v4-core test routers) + two `MockERC20`s (`src/mocks/MockERC20.sol`).
2. Mines a salt with the vendored `HookMiner` so the hook address encodes the permission flags, then CREATE2-deploys `DistroGuardHook`.
3. Initializes the dynamic-fee pool (`LPFeeLibrary.DYNAMIC_FEE_FLAG`, tickSpacing 60), seeds liquidity at ticks **-600..600**, and runs demo swaps.
4. Writes `export/addresses.<chainId>.json` and exports the ABI to `export/abis/DistroGuardHook.json`.

### Live addresses (X Layer testnet, chainId 1952)

| Entity                      | Address                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| hook (`DistroGuardHook`)    | `0xc567825Da89E42529E3b4359d8310C4F87a0D0c0`                         |
| PoolManager                 | `0x933a9F248be97bd0964bbd55Aa8aa1330c650154`                         |
| token0 (mWETH)              | `0xA0bEb7969E3c6daFAFd5f01813261ee61ec6753b`                         |
| token1 (mUSDC)              | `0xE7998A16570cb12be37daAEa8f11a5813b26e55C`                         |
| swapRouter (`PoolSwapTest`) | `0xeb3326ce92f382FD5b1d5cA38F244E1C6bdB210E`                         |
| poolId                      | `0xe6d570f5d75318142a44ff50c345bbdca0e57786430d14adb7786d39dec6a2b7` |
| tickSpacing                 | 60                                                                   |

## Backend

### Data model (migration `0023_*`, `0024_*`)

- **`onchain_pools`** — `poolId` PK, `chainId`, `hookAddress`, `label`, `token0`/`token1`, `decimals`, `tickSpacing`. The registry the snapshot route reads.
- **`onchain_positions`** — `id`, `userId` FK, `chainId`, `poolId`, `positionTokenId?`, `tickLower`/`tickUpper`, `walletAddress`, `label`, `status`. A user's tracked LP range.
- **`onchain_events`** — fire log for debounce (per-`(device, type)`, 60-min window), mirroring the ticker `alert_events` role.
- Migration `0024_*` extends the `preferences_channel_mode_check` constraint to allow `onchain_only`.

See [Data Model](../backend/data-model.md).

### Read-only viem client

`lib/onchain-chain.ts` is a viem **read** client — **no keeper, no server signing key**.

- `readVol(hookAddr, poolId)` reads the hook's `volOf` getter and returns `{ tick: lastTick, volBps: ewmaVolBps }`.
- `priceFromTick` converts a tick to a display price.

Config in `config/onchain.ts`: `XLAYER_RPC_URL`, `XLAYER_CHAIN_ID`, `ONCHAIN_ENABLED`. When `XLAYER_RPC_URL` is unset, `ONCHAIN_ENABLED` resolves false and the worker + actions are inert.

### Worker tick (read-only)

`runOnchainEvaluation` runs on a **1-min cron** (`*/1 * * * *`), guarded by `ONCHAIN_ENABLED`, registered in `lib/background-jobs.ts`. It is **read-only** — it never signs or broadcasts. Each tick, for every active position:

1. Reads the live tick.
2. Detects a range breach (tick outside `[tickLower, tickUpper]`).
3. On breach, **LPUSHes a `range_breach` alert to `pendingAlertsKey(deviceId)`** — reusing the ticker alert pipeline, with the same **LPUSH-before-INSERT ordering** (a failing lpush must not consume the debounce window; see [Alerts](alerts.md)).
4. Debounces 60-min per `(device, type)` via `onchain_events`.

A failure inside the evaluator is logged and swallowed — the next tick proceeds.

### Snapshot + selection

- **`GET /onchain/pools/:poolId`** (public) — returns a snapshot: `price`, `tick`, live `feeBps`, `volBps`. `feeBpsFromVol` mirrors the on-chain fee math off-chain for display (so the dashboard/terminal show the same fee the hook would charge without simulating a swap).
- **`/me/content/next`** with `channelMode === 'onchain_only'` dispatches to `nextOnchainForDevice`: it first `LPOP`s a pending alert from the existing alert pipeline key (consume-once, same as the ticker promotion path); if none, it builds an `OnchainPayload` from a live `readVol`. See [Channel Modes](channel-modes.md).

### Action flow — `actions/prepare` → CLI-sign → broadcast

The advisor loop's "act" step is split server/client so **the server never holds a key**:

1. CLI calls **`POST /me/onchain/actions/prepare`** (auth). The server resolves the active position and returns **unsigned swap calldata** targeting the swapRouter. Only **`hedge`** is implemented; `exit` and `rebalance` return an error (pending server impl).
2. The CLI signs with the **local testnet key** (`~/.distro/onchain-key.json`) and broadcasts to X Layer. See [CLI: onchain](../cli/onchain.md).

The broadcast moves real swap flow through the pool, which the hook's `afterSwap` folds back into `ewmaVolBps` — closing the loop the terminal then re-renders.

## Verified live

- Deploy succeeded on X Layer: hook live, demo swaps showed `FeeApplied` rising `3000 → 3250` as `VolUpdated` `ewmaVolBps` rose to **53**.
- `readVol` / snapshot return live data (observed `feeBps` 57).
- The range-breach evaluator fires alerts through the real ticker pipeline.
- `distro onchain hedge` broadcast real swaps (e.g. tx `0xf14c0c9d…`) that moved the hook's on-chain volatility.

## Failure modes

| failure                                | behavior                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `XLAYER_RPC_URL` unset                 | `ONCHAIN_ENABLED` resolves false → worker tick is a no-op; `actions/prepare` and CLI broadcast reject                     |
| hook address mismatch on mine          | CREATE2 salt mine must produce an address whose low 14 bits match the permission flags; a mismatch fails deploy, not init |
| no v4-periphery `BaseHook`/`HookMiner` | hook extends v4-core `BaseTestHooks`; `HookMiner` vendored at `script/HookMiner.sol`; deploy self-deploys test routers    |
| CLI key unfunded                       | broadcast reverts on insufficient gas / balance — testnet faucet the local key; no server-side fallback (advisor model)   |
| `exit` / `rebalance` requested         | `actions/prepare` returns an error — only `hedge` is implemented server-side                                              |
| range breach while device offline      | `LPUSH` succeeds; daemon picks the alert off the queue on next sync (60-min list TTL), debounced per `(device, type)`     |
| Redis lpush fails in evaluator         | no `onchain_events` row written → next tick re-evaluates with no debounce penalty (LPUSH-before-INSERT invariant)         |
| `drizzle-kit migrate` flaky locally    | apply `0023`/`0024` via `psql` or the Railway migration runner instead of `drizzle-kit migrate`                           |

## Demo trigger

`POST /__test/fire-onchain` (production-gated; 404 in `NODE_ENV=production`) forces a `range_breach` alert through the real pipeline for deterministic demos, mirroring what the evaluator does — including the LPUSH-before-INSERT ordering.

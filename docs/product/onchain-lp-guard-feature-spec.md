# CH 03 ONCHAIN — LP GUARD: Feature Spec

Companion to the [PRD](./onchain-lp-guard-prd.md). Engineering detail in [Onchain LP Guard](../../gitbook-docs/architecture/onchain-lp-guard.md) and [CLI: onchain](../../gitbook-docs/cli/onchain.md). All behavior here is **as-built and verified live** on X Layer testnet (chainId 1952).

## User stories

- As a terminal-native LP, I want my Uniswap v4 position **defended on-chain by a fee that reacts to volatility**, so I'm compensated for toxic flow without managing fee tiers myself.
- As a developer with an agent running, I want my **LP position rendered as an ambient channel** while I code, so I keep an eye on it without leaving the terminal.
- As an LP, I want a **terminal alert the instant price exits my range**, so I don't discover a dead position hours later.
- As an LP, I want to **act in one command** (`distro onchain hedge`) that signs and broadcasts, so reacting to a breach is friction-free.
- As a cautious user, I want the hook to be an **advisor, not a custodian** — it never holds or moves my funds.

## Acceptance criteria

- [x] **Hook deployed + verifiable on X Layer.** `DistroGuardHook` live at `0xc567825Da89E42529E3b4359d8310C4F87a0D0c0` on chainId 1952; pool `0xe6d570f5…` initialized as a dynamic-fee pool.
- [x] **Fee rises with volatility on-chain.** Demo swaps emitted `FeeApplied` rising `3000 → 3250` as `VolUpdated` `ewmaVolBps` climbed to 53; live snapshot reported `feeBps` 57. Fee = `clamp(3000 + 50×ewmaVolBps + 20×sizeUnit, 3000, 10000)` pips.
- [x] **Range breach → terminal alert.** The 1-min read-only evaluator detects tick outside `[lower, upper]` and pushes a `range_breach` alert through the real ticker alert pipeline; the daemon renders the alert (red) slot variant.
- [x] **One-click hedge broadcasts.** `distro onchain hedge` resolves the active position, fetches unsigned calldata, signs with the local key, and broadcast real swaps (e.g. tx `0xf14c0c9d…`) that moved the hook's on-chain volatility.

## Slot / alert UX

- **Normal slot** (`OnchainPayload`, `kind: "onchain"`) renders pool label, price, tick, range with in/out indicator, live `feeBps`, `volBps`, `feesEarnedUsd`, `ilPct`, `asOf`.
- **Alert slot** carries an `OnchainAlert` (`range_breach` | `near_breach` | `vol_spike`); the renderer wraps the box in red, mirroring the ticker alert path.
- Alerts are **debounced 60 min** per `(device, type)` so a flapping price doesn't spam slots.
- Alerts ride the **existing ticker alert pipeline** (LPUSH-to-device-queue, consume-once LPOP on selection, LPUSH-before-INSERT ordering).

## Action semantics

- **`hedge`** — implemented end-to-end. Server returns unsigned swap calldata targeting the swapRouter; CLI signs + broadcasts.
- **`exit`, `rebalance`** — CLI subcommands exist and are wired, but the server `actions/prepare` returns an error for them today (pending server impl).
- Actions are **client-signed**: the server never holds a key. The CLI uses a local testnet key at `~/.distro/onchain-key.json` (mode 600), created/imported via `distro onchain init`.
- The position is resolved from `--position <id>` or the first `active` position via `GET /me/onchain/positions`.

## Edge cases

- **No key** → CLI prints `run: distro onchain init`, no broadcast.
- **No active position** → CLI prints a hint to register one in the dashboard.
- **Unfunded key** → broadcast reverts on gas/balance; faucet the address (advisor model — no server fallback).
- **`XLAYER_RPC_URL` unset** → backend `ONCHAIN_ENABLED` is false (worker no-op, actions reject); CLI broadcast can't connect.
- **Device offline at breach** → alert sits on the device queue (60-min TTL), delivered on next sync.
- **Redis lpush fails in evaluator** → no `onchain_events` row → next tick re-evaluates without a debounce penalty.
- **Demo** → `POST /__test/fire-onchain` (404 in production) forces a `range_breach` deterministically.

## Out of scope (pilot)

- **Autonomy** — no keeper executing on the user's behalf; the human acts. (Advisor → autonomous is roadmap.)
- **Mainnet** — X Layer testnet only.
- **Multi-position** — actions resolve a single active position; portfolio-wide management is not modeled.
- **Live keypress capture** — the daemon does not capture `h`/`e`/`r`; those keys are wired but dormant. The one-click is the `distro onchain` subcommand.
- **`exit` / `rebalance` server impl** — only `hedge` is implemented server-side.

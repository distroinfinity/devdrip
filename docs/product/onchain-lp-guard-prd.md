# CH 03 ONCHAIN — LP GUARD: Product Requirements

## 1. Problem

Concentrated-liquidity LPs on Uniswap (v3/v4) face three structural costs that compound while they are away from the screen:

- **Toxic flow.** Informed swappers pick off LPs during volatility. A static fee tier can't widen when the pool turns adversarial, so the LP subsidizes arbitrageurs exactly when it hurts most.
- **Impermanent loss.** Price drift against the position erodes value relative to holding.
- **Range babysitting.** A concentrated position only earns fees while the price sits inside its tick range. The moment price exits, the position stops earning and starts behaving like a single-sided bag — and the LP has no idea until they next check a dashboard.

Terminal-native DeFi LPs and builders live in their editor and terminal, not in a DEX UI. They want their position defended automatically and to be told — where they already are — the instant something needs a decision.

## 2. Target user

Terminal-native DeFi LPs and builders: people running Uniswap v4 positions who spend their day in a coding terminal, often with an AI agent working in the background. They are comfortable with a CLI, a private key, and reading on-chain state — but they don't want to babysit a position or sit in a DEX dashboard.

## 3. Value proposition — LP GUARD

**A Uniswap v4 hook that defends LPs with a volatility-reactive fee, piloted from the terminal you code in.**

- The **hook** raises the swap fee on-chain as the pool gets volatile (and adds a premium for outsized swaps), so the LP is compensated for toxic flow at the moment it arrives — not on a delay, not via a static tier.
- The **terminal** renders the live position — price, range, in/out, current fee, volatility — as an ambient channel while the agent works.
- A **range breach fires a terminal alert**, surfaced where the user already is.
- The user **acts with one CLI command** (`distro onchain hedge`), signing and broadcasting from a local key.

**Advisor model.** The hook sets the fee and emits state; the human decides and acts. The hook never custodies or moves LP funds. This is deliberate — it keeps the trust surface minimal and the loop legible.

## 4. Positioning within Distro TV

Distro TV is a **channel surface** that runs in the developer's terminal while AI tools work. The product is the surface; channels are the verticals. CH 01 NEWS and CH 02 MARKETS were the launch channels. **CH 03 ONCHAIN — LP GUARD is the first channel that is also an on-chain product** — it doesn't just display a feed, it ships a Uniswap v4 hook and a control surface for acting on it.

It validates the channel-surface thesis: a new vertical slots into the same ambient terminal surface (same daemon, same selection path, same alert pipeline) without disturbing the others. ONCHAIN runs independently of the news/markets data pipeline — its own contracts, viem read client, and worker tick.

## 5. UX flows

### Monitor

User selects `onchain_only` (mode `onchain_only`) via `distro channel onchain` or the prefs picker. The terminal renders the LP GUARD slot: pool, price, tick, range with in/out indicator, live fee (bps), volatility, fees earned, IL.

### Alert

A background evaluator checks the live tick every minute. When price exits the position's range, a `range_breach` alert is pushed to the device and the next slot renders the alert variant (red box). Debounced 60 min per breach type so a flapping price doesn't spam.

### One-click act

The user runs `distro onchain hedge`. The CLI resolves the active position, fetches unsigned swap calldata from the API, signs with the local testnet key, and broadcasts to X Layer. The broadcast moves real flow through the pool, which the hook folds back into its volatility signal — the terminal then re-renders the updated state. (Keystroke capture is intentionally off; the one-click is the subcommand, run directly or inline as `!distro onchain hedge` inside Claude Code.)

## 6. Hackathon framing — Build X / Hook the Future

CH 03 was built for the **Build X / Hook the Future** hackathon:

- **X Layer** — deployed and verified live on X Layer testnet (chainId 1952).
- **Uniswap v4** — a real v4 hook (`DistroGuardHook`) with a state-driven dynamic fee, the v4-only capability that makes the product possible.
- **Flap** — part of the hackathon's sponsor/ecosystem framing.

Judged on **Innovation**, **Market**, and **Completion**. The pitch leans on all three: a novel LP-defense primitive (innovation), a real and underserved LP pain (market), and a fully working, on-chain-verified loop from hook to terminal to broadcast (completion).

## 7. Roadmap

- **Advisor → autonomous.** Today the human acts. A future mode could let a funded keeper execute the hedge on breach, with explicit user-set bounds. (Out of scope for the pilot — see the feature spec.)
- **`exit` and `rebalance` actions.** `hedge` is implemented end-to-end; `exit` and `rebalance` are wired in the CLI but await the server-side `actions/prepare` implementation.
- **Mainnet.** The pilot is X Layer testnet only. Mainnet requires a real fee/volatility calibration pass and a hardened key story (no hot key in a dotfile).

## 8. Related docs

- [Onchain LP Guard — engineering](../../gitbook-docs/architecture/onchain-lp-guard.md)
- [CLI: onchain](../../gitbook-docs/cli/onchain.md)
- [Feature spec](./onchain-lp-guard-feature-spec.md)

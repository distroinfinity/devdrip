# CLI: onchain

`distro onchain` is the terminal control surface for `CH 03 ONCHAIN — LP GUARD`. It manages a local testnet signing key and runs the one-click LP actions that close the advisor loop (monitor → alert → act). See [Onchain LP Guard](../architecture/onchain-lp-guard.md) for the full feature.

Commands live in `packages/cli/src/commands/onchain.ts`; signing + broadcast in `lib/onchain/clients.ts` + `lib/onchain/actions.ts` (`runAction`).

## Selecting the channel

`onchain_only` is a selectable channel mode in the preferences picker (`lib/prompts/preferences.ts`):

```sh
distro channel onchain          # or pick "onchain only" in the prefs picker
```

Once selected, `/me/content/next` returns `OnchainPayload` slots and the daemon renders the LP GUARD box (`lib/render-onchain.ts`, routed by `render-line.ts` on `kind === "onchain"`). The alert variant wraps the box in red, mirroring the ticker alert renderer.

## `distro onchain init [--import <pk>]`

Creates (or imports) a **local testnet signing key** at `~/.distro/onchain-key.json`, mode `600`. **Testnet only** — this is a hot key for X Layer testnet swaps, never a mainnet wallet.

```sh
distro onchain init                 # generate a fresh key
distro onchain init --import 0x...  # import an existing 0x private key
```

After init, fund the address on X Layer testnet, then select the channel (`distro channel onchain`). Re-running `init` without `--import` is a no-op if a key already exists (prints the address).

## `distro onchain status`

Prints the active signer address, or a hint to run `init` if no key exists.

```sh
distro onchain status
```

## `distro onchain hedge | exit | rebalance [--position <id>]`

The **one-click action**. It:

1. Checks a local key exists (else prints `run: distro onchain init`).
2. Resolves the target position — `--position <id>`, else the first `active` position from `GET /me/onchain/positions`.
3. Fetches **unsigned** swap calldata from `POST /me/onchain/actions/prepare`.
4. Signs with the local key and **broadcasts to X Layer**.
5. Prints the tx hash.

```sh
distro onchain hedge                      # acts on your first active position
distro onchain hedge --position <id>      # target a specific position
```

> **`hedge` works end-to-end. `exit` and `rebalance` are wired client-side but the server `actions/prepare` only implements `hedge`** — calling them today returns an error from the server.

## Design note: the daemon does not capture keystrokes

The ambient surface **never steals host TUI input**. The daemon publishes a pinned status line; it does not read keys. The `h` / `e` / `r` keys are wired in `lib/daemon/input.ts` and the orchestrator but are **dormant** (key capture is disabled).

So the terminal "one-click" is the **`distro onchain` subcommand**, not a live keypress — run it directly, or inline inside Claude Code with `!distro onchain hedge`. The keystroke path is reserved for if/when an interactive mode is enabled.

## `XLAYER_RPC_URL`

`runAction` needs `XLAYER_RPC_URL` available in the environment to broadcast. Without it the broadcast cannot reach X Layer.

## Failure modes

| Symptom                                     | Cause                                          | Fix                                                 |
| ------------------------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| `no signing key — run: distro onchain init` | no key at `~/.distro/onchain-key.json`         | `distro onchain init`                               |
| `no active position`                        | no `active` row from `/me/onchain/positions`   | register a position in the dashboard first          |
| `exit failed` / `rebalance failed`          | server `actions/prepare` only implements hedge | use `hedge`; `exit`/`rebalance` pending server impl |
| broadcast reverts                           | local key unfunded on X Layer testnet          | faucet the address from `distro onchain status`     |
| broadcast cannot connect                    | `XLAYER_RPC_URL` unset                         | export `XLAYER_RPC_URL` before running the action   |

# @distrotv/contracts

Uniswap v4 hook (`DistroGuardHook`) + pool deploy scripts for X Layer.

## Dependencies

`lib/` is gitignored. Install the pinned deps once after cloning:

```shell
forge install uniswap/v4-core@v1.0.2 uniswap/v4-periphery@v1.0.4 foundry-rs/forge-std --no-git
```

## Build & test

```shell
forge build
forge test -vvv
```

## Deploy (X Layer testnet)

```shell
cp .env.example .env   # fill RPC + key (+ v4 addresses if official ones exist)
forge script script/Deploy.s.sol --rpc-url xlayer --broadcast --ffi
```

Outputs `export/addresses.<chainId>.json` consumed by @distrotv/shared.

# @distrotv/contracts

Uniswap v4 hook (`DistroGuardHook`) + pool deploy scripts for X Layer.

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

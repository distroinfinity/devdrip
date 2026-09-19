// X Layer testnet chain + deployed v4 addresses. Hook/pool addresses come from
// packages/contracts/export/addresses.<chainId>.json after deploy.
export const XLAYER_CHAIN_ID = Number(process.env["XLAYER_CHAIN_ID"] ?? 1952)
export const XLAYER_RPC_URL = process.env["XLAYER_RPC_URL"] ?? ""
export const XLAYER_EXPLORER =
  process.env["XLAYER_EXPLORER"] ?? "https://www.oklink.com/xlayer-test"

export interface OnchainDeployment {
  chainId: number
  poolManager: `0x${string}`
  hook: `0x${string}`
  token0: `0x${string}`
  token1: `0x${string}`
  tickSpacing: number
}

export const XLAYER_RPC_URL = process.env["XLAYER_RPC_URL"] ?? ""
export const XLAYER_CHAIN_ID = Number(process.env["XLAYER_CHAIN_ID"] ?? 1952)
export const ONCHAIN_ENABLED = XLAYER_RPC_URL.length > 0

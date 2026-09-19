import { createPublicClient, createWalletClient, defineChain, http } from "viem"
import { loadAccount } from "./keystore.js"

const RPC = process.env["XLAYER_RPC_URL"] ?? ""
const CHAIN_ID = Number(process.env["XLAYER_CHAIN_ID"] ?? 1952)

const xlayer = defineChain({
  id: CHAIN_ID,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
})

export const publicClient = createPublicClient({ transport: http(RPC), chain: xlayer })

export function walletClient() {
  return createWalletClient({ account: loadAccount(), transport: http(RPC), chain: xlayer })
}

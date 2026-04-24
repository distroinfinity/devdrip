// packages/api/src/chain/clients.ts

import { createPublicClient, createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { env } from "../config/env.js"
import { worldChainSepoliaViem } from "./config.js"

let _publicClient: ReturnType<typeof createPublicClient> | null = null
let _walletClient: ReturnType<typeof createWalletClient> | null = null

// Read-only client. Lazy so the API can boot without a hot wallet configured
// (only the worker process needs the wallet client).
export function getPublicClient() {
  if (_publicClient) return _publicClient
  const chain = worldChainSepoliaViem(env.worldChainRpc)
  _publicClient = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) })
  return _publicClient
}

// Signing client. Throws if HOT_WALLET_PRIVATE_KEY isn't set — only the worker
// should call this, and the worker process won't start without that env var.
export function getWalletClient() {
  if (_walletClient) return _walletClient
  const pk = env.hotWalletPrivateKey
  if (!pk.startsWith("0x")) {
    throw new Error("HOT_WALLET_PRIVATE_KEY must be a 0x-prefixed hex string")
  }
  const account = privateKeyToAccount(pk as `0x${string}`)
  const chain = worldChainSepoliaViem(env.worldChainRpc)
  _walletClient = createWalletClient({
    account,
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  })
  return _walletClient
}

// Test/dev escape hatch — clear cached clients so a process can re-init with
// new env values (e.g., between vitest runs that swap RPC URLs).
export function resetChainClients() {
  _publicClient = null
  _walletClient = null
}

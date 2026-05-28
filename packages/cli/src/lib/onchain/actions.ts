import { apiFetch } from "../api-client.js"
import { walletClient, publicClient } from "./clients.js"

export type OnchainAction = "hedge" | "exit" | "rebalance"

interface PreparedTx {
  chainId: number
  to: `0x${string}`
  data: `0x${string}`
  value: string
}

// fetch unsigned swap calldata, sign with the local keystore key, broadcast,
// and wait for the receipt. returns the tx hash.
export async function runAction(positionId: string, action: OnchainAction): Promise<`0x${string}`> {
  const tx = await apiFetch<PreparedTx>("/me/onchain/actions/prepare", {
    method: "POST",
    body: { positionId, action },
  })
  const wc = walletClient()
  const hash = await wc.sendTransaction({ to: tx.to, data: tx.data, value: BigInt(tx.value) })
  await publicClient().waitForTransactionReceipt({ hash })
  return hash
}

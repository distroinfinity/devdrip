import { Command } from "commander"
import { hasKey, createKey, loadAccount } from "../lib/onchain/keystore.js"
import { apiFetch } from "../lib/api-client.js"
import { runAction, type OnchainAction } from "../lib/onchain/actions.js"

export const onchainCmd = new Command("onchain").description(
  "LP GUARD — monitor + act on a v4 position"
)

interface PositionRow {
  id: string
  status: string
  label: string | null
}

// one-click action: resolve the target position, sign + broadcast via the local key.
// keypress capture is intentionally off in the ambient daemon (never steals host input),
// so the terminal one-click is this subcommand (run directly or via `!distro onchain hedge`).
async function actCmd(action: OnchainAction, opts: { position?: string }): Promise<void> {
  if (!hasKey()) {
    console.log("no signing key — run: distro onchain init")
    return
  }
  let positionId = opts.position
  if (!positionId) {
    const { positions } = await apiFetch<{ positions: PositionRow[] }>("/me/onchain/positions", {
      method: "GET",
    })
    const active = positions.find((p) => p.status === "active")
    if (!active) {
      console.log("no active position — register one in the dashboard first")
      return
    }
    positionId = active.id
  }
  console.log(`${action} → position ${positionId}  (signer ${loadAccount().address})`)
  try {
    const hash = await runAction(positionId, action)
    console.log(`🔔 ${action} sent · ${hash}`)
  } catch (err) {
    console.log(`${action} failed: ${(err as Error).message}`)
  }
}

for (const a of ["hedge", "exit", "rebalance"] as const) {
  onchainCmd
    .command(a)
    .description(`${a} your watched LP position — signs + broadcasts on X Layer`)
    .option("--position <id>", "position id (defaults to your first active position)")
    .action((opts: { position?: string }) => actCmd(a, opts))
}

onchainCmd
  .command("init")
  .description("create or import a testnet signing key")
  .option("--import <pk>", "import an existing 0x private key")
  .action((opts: { import?: `0x${string}` }) => {
    if (hasKey() && !opts.import) {
      console.log(`already configured: ${loadAccount().address}`)
      return
    }
    const addr = createKey(opts.import)
    console.log(`onchain key ready: ${addr}`)
    console.log(`fund it on X Layer testnet, then: distro channel onchain`)
  })

onchainCmd
  .command("status")
  .description("show the active key")
  .action(() => {
    console.log(hasKey() ? loadAccount().address : "no key — run: distro onchain init")
  })

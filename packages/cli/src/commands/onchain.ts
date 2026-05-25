import { Command } from "commander"
import { hasKey, createKey, loadAccount } from "../lib/onchain/keystore.js"

export const onchainCmd = new Command("onchain").description(
  "LP GUARD — monitor + act on a v4 position"
)

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

import { Command } from "commander"
import { openLedger } from "../lib/ledger.js"
import { createSyncLoop } from "../lib/daemon/sync.js"
import { appendLog } from "../lib/daemon/lifecycle.js"
import { reportError } from "../lib/api-client.js"

export const syncCmd = new Command("sync")
  .description("sync local ledger impressions and clicks to backend")
  .option("-f, --force", "run immediately (default)", true)
  .action(async () => {
    const ledger = openLedger()
    const log = {
      debug: (msg: string, fields?: Record<string, unknown>) => appendLog("debug", msg, fields),
      info: (msg: string, fields?: Record<string, unknown>) => appendLog("info", msg, fields),
      warn: (msg: string, fields?: Record<string, unknown>) => appendLog("warn", msg, fields),
      error: (msg: string, fields?: Record<string, unknown>) => appendLog("error", msg, fields),
    }
    const loop = createSyncLoop({ ledger, log })
    try {
      const r = await loop.forceSync()
      console.log(
        `synced ${r.impressionsSynced} impressions, ${r.clicksSynced} clicks (${r.errors} errors, ${r.terminal} dropped)`
      )
    } catch (err) {
      reportError(err)
    } finally {
      ledger.close()
    }
  })
